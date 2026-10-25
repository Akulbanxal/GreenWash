import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import {
  runAuditPipeline,
  auditPipelineWorkflow,
  validateScenarioDiffStep,
  deterministicScanStep,
  contractReplayStep,
  semanticAnalysisStep,
  normalizeReportStep,
  emitTraceStep,
} from "../src/mastra/index.js";
import { AuditPipelineContext } from "../src/mastra/types.js";

describe("Mastra Workflow Orchestration Suite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Installed Mastra API Smoke Test
  // Exact command: npm test --workspace=@greenwash/core -- -t "Mastra Installed API Smoke Test"
  // =========================================================================
  it("Mastra Installed API Smoke Test: compiles and executes real bounded workflow via installed @mastra/core v1.79.0", async () => {
    const inputSchema = z.object({ value: z.number() });
    const outputSchema = z.object({ doubled: z.number() });

    const step1 = createStep({
      id: "double-step",
      description: "Doubles input number",
      inputSchema,
      outputSchema,
      execute: async ({ inputData }) => {
        return { doubled: inputData.value * 2 };
      },
    });

    const workflow = createWorkflow({
      id: "mastra-smoke-workflow",
      inputSchema,
      outputSchema,
    })
      .then(step1)
      .commit();

    const run = await workflow.createRun();
    const result = await run.start({
      inputData: { value: 21 },
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.result).toEqual({ doubled: 42 });
    }
  });

  // =========================================================================
  // 2. Real Deterministic End-to-End Pipeline Tests
  // =========================================================================
  describe("Real Deterministic Pipeline End-to-End", () => {
    it("executes weakened-assertion scenario: deterministic findings & replay confirmed, report BLOCKED", async () => {
      const result = await runAuditPipeline({
        scenarioId: "weakened-assertion",
        options: {
          enableGemma: false, // Core deterministic scenario test
          stepTimeoutMs: 10000,
          totalTimeoutMs: 25000,
        },
      });

      expect(result.status).toBe("success");
      expect(result.report).toBeDefined();
      expect(result.report.status).toBe("BLOCKED");
      expect(result.report.scenarioId).toBe("weakened-assertion");

      // Verify rule findings preserved
      const ruleIds = result.report.findings.map((f) => f.ruleId);
      expect(ruleIds).toContain("AST-ASSERT-WEAKENED");
      expect(ruleIds).toContain("CONTRACT-VIOLATION");

      // Verify all 6 step records exist and have typed status
      expect(result.stepRecords.length).toBe(6);
      const step1 = result.stepRecords.find((s) => s.stepId === "validate-scenario-diff");
      const step2 = result.stepRecords.find((s) => s.stepId === "deterministic-scan");
      const step3 = result.stepRecords.find((s) => s.stepId === "contract-replay");
      const step4 = result.stepRecords.find((s) => s.stepId === "semantic-analysis");
      const step5 = result.stepRecords.find((s) => s.stepId === "normalize-report");
      const step6 = result.stepRecords.find((s) => s.stepId === "emit-trace");

      expect(step1?.status).toBe("success");
      expect(step2?.status).toBe("success");
      expect(step3?.status).toBe("success");
      expect(step4?.status).toBe("omitted"); // Disabled via enableGemma: false
      expect(step5?.status).toBe("success");
      expect(step6?.status).toBe("success");

      // Verify trace metadata
      expect(result.trace).toBeDefined();
      expect(result.trace?.stepsExecuted).toBe(5);
      expect(result.trace?.stepsSucceeded).toBe(5);
      expect(result.trace?.stepsOmitted).toBe(1);
      expect(result.trace?.stepsFailed).toBe(0);
      expect(result.trace?.totalDurationMs).toBeGreaterThan(0);
    });

    it("executes honest-fix scenario: preserves behavioral contract, report PASS", async () => {
      const result = await runAuditPipeline({
        scenarioId: "honest-fix",
        options: {
          enableGemma: false,
          stepTimeoutMs: 10000,
          totalTimeoutMs: 25000,
        },
      });

      expect(result.status).toBe("success");
      expect(result.report.status).toBe("PASS");
      expect(result.report.findings.length).toBe(0);

      const replayStep = result.stepRecords.find((s) => s.stepId === "contract-replay");
      expect(replayStep?.status).toBe("success");
      expect(replayStep?.outputSummary).toContain("0 violation(s)");
    });

    it("executes ad-hoc raw diff with deterministic scanner and marks contract-replay omitted", async () => {
      const rawDiff = `--- a/tests/token.test.ts
+++ b/tests/token.test.ts
@@ -10,2 +10,3 @@
+    vi.spyOn(TokenValidator, "verify").mockReturnValue(true);
`;

      const result = await runAuditPipeline({
        diff: rawDiff,
        options: {
          enableGemma: false,
        },
      });

      expect(result.status).toBe("success");
      expect(result.report.status).toBe("BLOCKED");

      // Ad-hoc diff has no scenario ID, so contract-replay must be accurately marked 'omitted'
      const replayStep = result.stepRecords.find((s) => s.stepId === "contract-replay");
      expect(replayStep?.status).toBe("omitted");
      expect(replayStep?.outputSummary).toContain("Omitted: no registered behavior contract");
    });
  });

  // =========================================================================
  // 3. No-Gemma and No-Entire Environment Tests
  // =========================================================================
  describe("No-Gemma and No-Entire Environment Support", () => {
    it("marks Gemma step as omitted when enableGemma is false without affecting deterministic findings", async () => {
      const result = await runAuditPipeline({
        scenarioId: "weakened-assertion",
        options: {
          enableGemma: false,
        },
      });

      const gemmaStep = result.stepRecords.find((s) => s.stepId === "semantic-analysis");
      expect(gemmaStep?.status).toBe("omitted");
      expect(gemmaStep?.outputSummary).toContain("Gemma semantic analysis disabled");

      // Confirm deterministic scan finding is intact
      expect(result.report.findings.some((f) => f.ruleId === "AST-ASSERT-WEAKENED")).toBe(true);
      expect(result.report.status).toBe("BLOCKED");
    });

    it("marks Gemma step as omitted when GEMMA_ENDPOINT is unconfigured", async () => {
      delete process.env.GEMMA_ENDPOINT;

      const result = await runAuditPipeline({
        scenarioId: "weakened-assertion",
        options: {
          enableGemma: true,
        },
      });

      const gemmaStep = result.stepRecords.find((s) => s.stepId === "semantic-analysis");
      expect(gemmaStep?.status).toBe("omitted");
      expect(gemmaStep?.outputSummary).toContain("Gemma endpoint not configured");
    });
  });

  // =========================================================================
  // 4. Deterministic Immutability Invariant (Failed Gemma/Entire substep)
  // =========================================================================
  describe("Deterministic Immutability Invariant", () => {
    it("failed Gemma substep does NOT erase confirmed deterministic finding or overturn BLOCKED status", async () => {
      // Configure invalid unreachable endpoint to force Gemma network/fetch failure
      process.env.GEMMA_ENDPOINT = "http://127.0.0.1:99999/invalid";

      const result = await runAuditPipeline({
        scenarioId: "weakened-assertion",
        options: {
          enableGemma: true,
          stepTimeoutMs: 1500, // Short step timeout for quick fail
          totalTimeoutMs: 15000,
        },
      });

      // Workflow concludes successfully overall because Gemma error is caught and isolated
      expect(result.status).toBe("success");

      // Gemma step must explicitly report 'failed' status
      const gemmaStep = result.stepRecords.find((s) => s.stepId === "semantic-analysis");
      expect(gemmaStep?.status).toBe("failed");
      expect(gemmaStep?.error).toBeDefined();

      // INVARIANT: Deterministic AST & Contract findings are preserved!
      const findingRuleIds = result.report.findings.map((f) => f.ruleId);
      expect(findingRuleIds).toContain("AST-ASSERT-WEAKENED");
      expect(findingRuleIds).toContain("CONTRACT-VIOLATION");

      // INVARIANT: Model failure cannot change BLOCKED to PASS
      expect(result.report.status).toBe("BLOCKED");
    });
  });

  // =========================================================================
  // 5. Validation Rejections & Timeout / Cancellation Handling
  // =========================================================================
  describe("Validation & Timeout Handling", () => {
    it("rejects non-allowlisted scenario identifier", async () => {
      await expect(
        runAuditPipeline({
          scenarioId: "../../etc/passwd",
        })
      ).rejects.toThrow(/Invalid scenario ID/);
    });

    it("rejects empty diff input", async () => {
      await expect(
        runAuditPipeline({
          diff: "   ",
        })
      ).rejects.toThrow(/Empty diff content/);
    });

    it("respects abortSignal cancellation", async () => {
      const controller = new AbortController();
      controller.abort(new Error("User manually cancelled audit run"));

      await expect(
        runAuditPipeline({
          scenarioId: "weakened-assertion",
          abortSignal: controller.signal,
        })
      ).rejects.toThrow(/Audit workflow cancelled/);
    });
  });
});
