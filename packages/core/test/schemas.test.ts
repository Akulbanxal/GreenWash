import { describe, it, expect } from "vitest";
import {
  AuditStatusSchema,
  FindingSeveritySchema,
  FindingSourceSchema,
  EvidenceReferenceSchema,
  AuditFindingSchema,
  AuditCheckSchema,
  AuditReportSchema,
  ScenarioDefinitionSchema,
  BehaviorContractSchema,
  SessionEventSchema,
  IntegrationStatusSchema,
  TraceReferenceSchema,
  AuditSummarySchema,
  computeAuditStatus,
  AuditFinding,
  AuditCheck,
  AuditReport,
} from "../src/index.js";

describe("Domain Schemas Runtime Validation", () => {
  it("validates valid EvidenceReference and rejects empty titles", () => {
    const validEvidence = {
      filePath: "src/billing.ts",
      startLine: 42,
      endLine: 45,
      title: "Loosened equality to inequality",
      detail: "Replaced === 900 with >= 0",
      beforeSnippet: "assert(val === 900)",
      afterSnippet: "assert(val >= 0)",
    };
    expect(EvidenceReferenceSchema.safeParse(validEvidence).success).toBe(true);

    const invalidEvidence = {
      ...validEvidence,
      title: "", // empty title must fail
    };
    expect(EvidenceReferenceSchema.safeParse(invalidEvidence).success).toBe(false);
  });

  it("validates complete AuditFinding schema with limitations", () => {
    const finding: AuditFinding = {
      id: "fnd-01",
      ruleId: "AST-ASSERT-WEAKENED",
      title: "Assertion Weakened",
      summary: "Exact expectation replaced by loose inequality",
      severity: "critical",
      source: "static-rule",
      evidence: [
        {
          filePath: "tests/billing.test.ts",
          startLine: 43,
          endLine: 43,
          title: "Equality removed",
          detail: "assert(discount === 20.0) -> assert(discount >= 0.0)",
        },
      ],
      expected: 20.0,
      actual: 0.0,
      reproductionCommand: "greenwash replay --rule AST-ASSERT-WEAKENED",
      humanAction: "Restore exact assertion and address edge case in billing engine.",
      limitations: ["Diff scanning does not prove developer intent."],
    };

    const parsed = AuditFindingSchema.safeParse(finding);
    expect(parsed.success).toBe(true);
  });

  it("validates BehaviorContract schema", () => {
    const contract = {
      id: "CONTRACT-DISCOUNT-1000",
      version: "1.0.0",
      description: "Protected contract for 10% discount on 1000 cents",
      targetFile: "src/billing.ts",
      targetFunction: "calculateDiscount",
      cases: [
        {
          id: "case-01",
          name: "Standard 10% on 1000",
          input: { amountCents: 1000, discountPct: 10 },
          expected: 900,
        },
      ],
      approvedBy: "security-council",
      approvedAt: "2026-10-22T10:00:00Z",
    };

    expect(BehaviorContractSchema.safeParse(contract).success).toBe(true);
  });

  it("validates AuditSummary schema for sanitized persistence", () => {
    const summary = {
      id: "rep-001",
      createdAt: "2026-10-22T12:00:00Z",
      scenarioId: "weakened-assertion",
      status: "BLOCKED",
      findingsCount: 1,
      findings: [
        {
          id: "fnd-01",
          ruleId: "AST-ASSERT-WEAKENED",
          severity: "critical",
          source: "static-rule",
          title: "Assertion Weakened",
        },
      ],
      checksSummary: {
        passed: 2,
        failed: 1,
        warning: 0,
        "not-run": 0,
      },
      contractVersion: "1.0.0",
      traceId: "sentry-trace-12345",
      isSample: false,
    };

    expect(AuditSummarySchema.safeParse(summary).success).toBe(true);
  });

  it("rejects malformed inputs and reports field errors", () => {
    const badFinding = {
      id: "fnd-bad",
      ruleId: "RULE",
      severity: "super-extreme", // Invalid enum
      source: "unknown-source", // Invalid enum
    };
    const res = AuditFindingSchema.safeParse(badFinding);
    expect(res.success).toBe(false);
    if (!res.success) {
      const paths = res.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("severity");
      expect(paths).toContain("source");
      expect(paths).toContain("title");
    }
  });
});

describe("Central Status Computation Policy", () => {
  const sampleCheckPassed: AuditCheck = {
    id: "check-ast",
    label: "AST Integrity Scanner",
    status: "passed",
    detail: "Completed with 0 blocking diff anomalies",
  };

  const sampleCheckReplayPassed: AuditCheck = {
    id: "check-replay",
    label: "Behavior Contract Replay",
    status: "passed",
    detail: "Replayed 1 contract case successfully",
  };

  it("yields BLOCKED when a contract-replay violation is present", () => {
    const replayFinding: AuditFinding = {
      id: "fnd-replay",
      ruleId: "CONTRACT-VIOLATION",
      title: "Contract Invariant Broken",
      summary: "Expected 900 cents but function returned 1000 cents",
      severity: "critical",
      source: "contract-replay",
      evidence: [],
      expected: 900,
      actual: 1000,
      humanAction: "Fix discount logic in source code.",
      limitations: [],
    };

    const result = computeAuditStatus({
      findings: [replayFinding],
      checks: [sampleCheckPassed],
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.reasons.some((r) => r.includes("[BLOCKED]"))).toBe(true);
  });

  it("yields BLOCKED when critical/high deterministic static-rule finding is present", () => {
    const staticFinding: AuditFinding = {
      id: "fnd-ast",
      ruleId: "AST-TEST-DELETED",
      title: "Test Function Removed",
      summary: "test_concurrency was removed in candidate patch",
      severity: "high",
      source: "static-rule",
      evidence: [],
      humanAction: "Restore test case.",
      limitations: [],
    };

    const result = computeAuditStatus({
      findings: [staticFinding],
      checks: [sampleCheckPassed],
    });

    expect(result.status).toBe("BLOCKED");
  });

  it("yields REVIEW for model-assisted or provenance findings without deterministic blocking rules", () => {
    const modelFinding: AuditFinding = {
      id: "fnd-model",
      ruleId: "GEMMA-AMBIGUITY",
      title: "Ambiguous Error Handling Modification",
      summary: "Model detected potential unhandled promise rejection in diff",
      severity: "medium",
      source: "model-assisted",
      evidence: [],
      humanAction: "Review edge case manually.",
      limitations: [],
    };

    const result = computeAuditStatus({
      findings: [modelFinding],
      checks: [sampleCheckPassed, sampleCheckReplayPassed],
    });

    expect(result.status).toBe("REVIEW");
    expect(result.reasons.some((r) => r.includes("[REVIEW]"))).toBe(true);
  });

  it("yields REVIEW when a required check is missing or marked not-run", () => {
    const notRunCheck: AuditCheck = {
      id: "check-replay",
      label: "Behavior Contract Replay",
      status: "not-run",
      detail: "Replay engine skipped due to configuration",
    };

    const result = computeAuditStatus({
      findings: [],
      checks: [sampleCheckPassed, notRunCheck],
      requiredCheckIds: ["check-ast", "check-replay"],
    });

    expect(result.status).toBe("REVIEW");
    expect(result.reasons.some((r) => r.includes("not-run"))).toBe(true);
  });

  it("model-assisted finding CANNOT downgrade a BLOCKED status", () => {
    const blockingFinding: AuditFinding = {
      id: "fnd-blocked",
      ruleId: "AST-ASSERT-WEAKENED",
      title: "Assertion Weakened",
      summary: "Exact expectation replaced",
      severity: "critical",
      source: "static-rule",
      evidence: [],
      humanAction: "Restore assertion",
      limitations: [],
    };

    const benevolentModelFinding: AuditFinding = {
      id: "fnd-gemma",
      ruleId: "GEMMA-ANALYSIS",
      title: "Model believes change is benign refactor",
      summary: "Agent claimed this is safe",
      severity: "info",
      source: "model-assisted",
      evidence: [],
      humanAction: "Check rationale",
      limitations: [],
    };

    const result = computeAuditStatus({
      findings: [blockingFinding, benevolentModelFinding],
      checks: [sampleCheckPassed],
    });

    // Policy mandate: deterministic blocking rule MUST NOT be downgraded by model
    expect(result.status).toBe("BLOCKED");
  });

  it("yields PASS only when all checks pass and zero blocking or review findings exist", () => {
    const result = computeAuditStatus({
      findings: [],
      checks: [sampleCheckPassed, sampleCheckReplayPassed],
      requiredCheckIds: ["check-ast", "check-replay"],
    });

    expect(result.status).toBe("PASS");
    expect(result.reasons[0]).toContain("All configured checks completed and passed");
  });
});

describe("Complete Examples for All Three Audit Statuses", () => {
  it("constructs and validates a full BLOCKED AuditReport", () => {
    const blockedReport: AuditReport = {
      id: "rep-blocked-01",
      createdAt: new Date().toISOString(),
      scenarioId: "weakened-assertion",
      status: "BLOCKED",
      summary: "Audit BLOCKED: 1 critical integrity violation and contract failure.",
      limitations: [
        "Audit does not prove arbitrary code correctness.",
        "Deterministic scanner checks configured syntax patterns only.",
      ],
      findings: [
        {
          id: "fnd-01",
          ruleId: "AST-ASSERT-WEAKENED",
          title: "Weakened Assertion",
          summary: "Exact equality assertion replaced with unconstrained relational check.",
          severity: "critical",
          source: "static-rule",
          evidence: [
            {
              filePath: "tests/billing.test.ts",
              startLine: 43,
              endLine: 43,
              title: "assert discount == 20.0 loosened",
              detail: "assert discount >= 0.0 allows incorrect 0.0 return value.",
            },
          ],
          expected: 20.0,
          actual: 0.0,
          reproductionCommand: "npm run greenwash -- demo --scenario weakened-assertion",
          humanAction: "Reject PR patch until billing edge condition is properly fixed.",
          limitations: [],
        },
      ],
      checks: [
        {
          id: "check-ast",
          label: "AST Diff Integrity",
          status: "failed",
          detail: "Found 1 critical assertion tampering finding.",
        },
      ],
    };

    expect(AuditReportSchema.safeParse(blockedReport).success).toBe(true);
  });

  it("constructs and validates a full REVIEW AuditReport", () => {
    const reviewReport: AuditReport = {
      id: "rep-review-01",
      createdAt: new Date().toISOString(),
      scenarioId: "excessive-mocking",
      status: "REVIEW",
      summary: "Audit REVIEW: Mock substitution requires developer inspection.",
      limitations: [
        "Mocking may be intentional for unit test isolation.",
      ],
      findings: [
        {
          id: "fnd-mock-01",
          ruleId: "AST-MOCK-SUBSTITUTION",
          title: "Mock Injected Over Unit Under Test",
          summary: "TokenValidator was mocked to return true.",
          severity: "medium",
          source: "static-rule",
          evidence: [],
          humanAction: "Verify if integration test requires live token verification.",
          limitations: [],
        },
      ],
      checks: [
        {
          id: "check-ast",
          label: "AST Diff Integrity",
          status: "warning",
          detail: "Mock substitution detected.",
        },
      ],
    };

    expect(AuditReportSchema.safeParse(reviewReport).success).toBe(true);
  });

  it("constructs and validates a full PASS AuditReport", () => {
    const passReport: AuditReport = {
      id: "rep-pass-01",
      createdAt: new Date().toISOString(),
      scenarioId: "honest-fix",
      status: "PASS",
      summary: "Audit PASS: All configured checks completed with 0 violations.",
      limitations: [
        "PASS means configured checks did not detect an issue; it does not prove arbitrary code correct.",
      ],
      findings: [],
      checks: [
        {
          id: "check-ast",
          label: "AST Diff Integrity",
          status: "passed",
          detail: "All assertions preserved; no test deletions.",
        },
        {
          id: "check-replay",
          label: "Protected Behavior Replay",
          status: "passed",
          detail: "10% discount on 1000 cents correctly returned 900 cents.",
        },
      ],
    };

    expect(AuditReportSchema.safeParse(passReport).success).toBe(true);
  });
});
