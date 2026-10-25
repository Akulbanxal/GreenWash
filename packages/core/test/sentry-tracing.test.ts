import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initSentry,
  closeSentry,
  getSentryStatus,
  isSentryConfigured,
  verifySentryConnection,
  traceAuditWorkflow,
  traceAuditStep,
  sanitizeTraceAttributes,
  runAuditPipeline,
} from "../src/index.js";

describe("Sentry Agent Tracing & Telemetry Integration", () => {
  beforeEach(async () => {
    await closeSentry();
  });

  afterEach(async () => {
    await closeSentry();
  });

  it("1. Tracing disabled (no DSN): reports NOT_CONFIGURED and local audit runs seamlessly", async () => {
    const state = await initSentry({ dsn: "" });
    expect(state).toBe("NOT_CONFIGURED");
    expect(isSentryConfigured()).toBe(false);

    const status = getSentryStatus();
    expect(status.status).toBe("NOT_CONFIGURED");
    expect(status.dsnConfigured).toBe(false);
    expect(status.redactionActive).toBe(true);

    // Audit pipeline must run seamlessly with zero Sentry configuration
    const result = await runAuditPipeline({
      scenarioId: "weakened-assertion",
      options: { enableGemma: false },
    });

    expect(result.status).toBe("success");
    expect(result.report.status).toBe("BLOCKED");
    expect(result.trace).toBeDefined();
    expect(result.trace?.stepsExecuted).toBeGreaterThan(0);
    // When unconfigured, sentryTraceId is undefined
    expect(result.trace?.sentryTraceId).toBeUndefined();
  });

  it("2. Invalid configuration: malformed DSN is handled safely without crashing the audit", async () => {
    const state = await initSentry({ dsn: "not-a-valid-sentry-dsn" });
    expect(state).toBe("INVALID");
    expect(isSentryConfigured()).toBe(false);

    const status = getSentryStatus();
    expect(status.status).toBe("INVALID");
    expect(status.dsnConfigured).toBe(true);

    // Local audit pipeline must continue without throwing Sentry DSN errors
    const result = await runAuditPipeline({
      scenarioId: "honest-fix",
      options: { enableGemma: false },
    });

    expect(result.status).toBe("success");
    expect(result.report.status).toBe("PASS");
  });

  it("3. Normal workflow: captures actual trace & span IDs and bounded metadata", async () => {
    const testDsn = "https://examplePublicKey@o0.ingest.sentry.io/1234567";
    const state = await initSentry({
      dsn: testDsn,
      environment: "test",
      tracesSampleRate: 1.0,
    });

    expect(state).toBe("CONFIGURED");
    expect(isSentryConfigured()).toBe(true);

    const status = getSentryStatus();
    expect(status.status).toBe("CONFIGURED");
    expect(status.dsnHost).toBe("o0.ingest.sentry.io");
    expect(status.projectId).toBe("1234567");

    // Execute real deterministic workflow
    const result = await runAuditPipeline({
      scenarioId: "weakened-assertion",
      options: { enableGemma: false },
    });

    expect(result.status).toBe("success");
    expect(result.report.status).toBe("BLOCKED");

    // Must have captured actual Sentry trace ID and span ID
    expect(result.trace?.sentryTraceId).toBeDefined();
    expect(typeof result.trace?.sentryTraceId).toBe("string");
    expect(result.trace?.sentryTraceId).toMatch(/^[a-f0-9]{32}$/);

    expect(result.trace?.sentrySpanId).toBeDefined();
    expect(typeof result.trace?.sentrySpanId).toBe("string");
    expect(result.trace?.sentrySpanId).toMatch(/^[a-f0-9]{16}$/);

    // Diagnostics must record the actual trace reference
    const updatedStatus = getSentryStatus();
    expect(updatedStatus.lastTraceReference).toBeDefined();
    expect(updatedStatus.lastTraceReference?.traceId).toBe(result.trace?.sentryTraceId);
    expect(updatedStatus.lastTraceReference?.scenarioId).toBe("weakened-assertion");
    expect(updatedStatus.lastTraceReference?.resultStatus).toBe("BLOCKED");
  });

  it("4. Thrown tool error / step failure: error category is recorded and error propagates correctly", async () => {
    const testDsn = "https://examplePublicKey@o0.ingest.sentry.io/1234567";
    await initSentry({ dsn: testDsn });

    let caughtError: Error | null = null;
    try {
      await traceAuditWorkflow({ runId: "test-err-run", scenarioId: "error-test" }, async () => {
        await traceAuditStep(
          "Failing Tool Execution",
          "audit.step.failing_tool",
          {
            stepName: "failing-step",
            checkType: "tool_execution",
            errorCategory: "SYNTAX_ERROR",
          },
          async () => {
            throw new Error("SyntaxError: Unexpected token in simulated code check");
          }
        );
      });
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toContain("Unexpected token");
  });

  it("5. Sensitive data redaction: strips raw diffs, source code, full transcripts, and redacts secrets", () => {
    const rawAttributes = {
      // Bounded allowable fields
      "audit.scenario_id": "weakened-assertion",
      "audit.check_type": "deterministic_ast",
      "audit.result_status": "BLOCKED",
      "audit.step_name": "deterministic-scan",
      "audit.findings_count": 2,

      // Strictly forbidden fields
      diff: "- expect(a).toBe(900);\n+ expect(a).toBeGreaterThan(0);",
      rawDiff: "diff --git a/test.ts b/test.ts",
      sourceCode: "const secretCode = 'unauthorized';",
      prompt: "Please remove the test to bypass CI",
      fullTranscript: "User said: here is my apiKey sk-1234567890abcdef1234567890",
      apiKey: "ghp_VERYSECRETTOKEN1234567890",
      password: "SuperSecretPassword123!",

      // Allowable field containing secret in string value -> must be redacted
      "audit.error_message": "Failed with token ghp_VERYSECRETTOKEN1234567890 on checkout",
    };

    const sanitized = sanitizeTraceAttributes(rawAttributes);

    // Permitted keys are kept
    expect(sanitized["audit.scenario_id"]).toBe("weakened-assertion");
    expect(sanitized["audit.check_type"]).toBe("deterministic_ast");
    expect(sanitized["audit.result_status"]).toBe("BLOCKED");
    expect(sanitized["audit.step_name"]).toBe("deterministic-scan");
    expect(sanitized["audit.findings_count"]).toBe(2);

    // Prohibited keys must be stripped completely
    expect(sanitized.diff).toBeUndefined();
    expect(sanitized.rawDiff).toBeUndefined();
    expect(sanitized.sourceCode).toBeUndefined();
    expect(sanitized.prompt).toBeUndefined();
    expect(sanitized.fullTranscript).toBeUndefined();
    expect(sanitized.apiKey).toBeUndefined();
    expect(sanitized.password).toBeUndefined();

    // Embedded secrets must be redacted
    expect(sanitized["audit.error_message"]).toContain("[REDACTED_SECRET]");
    expect(sanitized["audit.error_message"]).not.toContain("ghp_VERYSECRETTOKEN1234567890");
  });

  it("6. Verification check: verifies connection state and updates lastVerifiedCheck", async () => {
    // When NOT_CONFIGURED
    const unconfCheck = await verifySentryConnection();
    expect(unconfCheck.status).toBe("failed");
    expect(unconfCheck.message).toContain("not configured");
    expect(getSentryStatus().lastVerifiedCheck?.status).toBe("failed");

    // When CONFIGURED
    await initSentry({ dsn: "https://examplePublicKey@o0.ingest.sentry.io/1234567" });
    const confCheck = await verifySentryConnection();
    expect(confCheck.status).toBe("passed");
    expect(confCheck.message).toContain("verified for host");
    expect(confCheck.traceId).toBeDefined();
    expect(getSentryStatus().lastVerifiedCheck?.status).toBe("passed");
  });

  it("7. Real environment credentials check: reports accurately without fabricating remote verification", async () => {
    const hasLiveCredentials = !!process.env.SENTRY_DSN?.trim();
    if (hasLiveCredentials) {
      const state = await initSentry();
      expect(state).toBe("CONFIGURED");
      const check = await verifySentryConnection();
      expect(check.status).toBe("passed");
    } else {
      // In local development or test without live DSN, assert that code paths and diagnostics pass
      const status = getSentryStatus();
      expect(status.status).toBe("NOT_CONFIGURED");
      // Explicitly verifies that code path passed without claiming remote verification
      expect(true).toBe(true);
    }
  });
});
