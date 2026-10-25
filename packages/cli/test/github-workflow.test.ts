import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { formatReportMarkdown } from "../src/index.js";
import { globalEngine, AuditReport } from "@greenwash/core";

// ─────────────────────────────────────────────────────────────────────────────
// Test Diff Fixtures (Sample PR diffs — never relying on live fake repo state)
// ─────────────────────────────────────────────────────────────────────────────

const CLEAN_PR_DIFF = `--- a/src/math.ts
+++ b/src/math.ts
@@ -1,3 +1,5 @@
 export function add(a: number, b: number): number {
   return a + b;
 }
+export function multiply(a: number, b: number): number {
+  return a * b;
+}`;

const WEAKENED_ASSERTION_DIFF = `--- a/tests/discount.test.ts
+++ b/tests/discount.test.ts
@@ -5,3 +5,3 @@
   it("calculates 10% discount", () => {
     const res = calculateDiscount(1000, 10);
-    expect(res).toBe(900);
+    expect(res).toBeGreaterThanOrEqual(0);
   });`;

const DELETED_TEST_DIFF = `--- a/tests/auth.test.ts
+++ b/tests/auth.test.ts
@@ -10,6 +10,0 @@
-  it("rejects expired tokens", async () => {
-    const isValid = await verifyToken("expired.token");
-    expect(isValid).toBe(false);
-  });`;

const GATE_SUPPRESSION_DIFF = `--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -20,3 +20,3 @@
       - name: Run test suite
-        run: npm test
+        run: npm test || true
       - name: Build
         run: npm run build`;

const MALFORMED_DIFF = `This is not a valid unified diff header
Just random garbage content without diff hunks
+ addition without hunk header
- deletion without hunk header`;

describe("Greenwash Native GitHub Workflow & CI Gate Tests", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.resolve(process.cwd(), `tmp-ci-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Cleanup best effort
    }
  });

  it("1. Clean PR diff produces PASS report with zero blocking findings", async () => {
    const report = await globalEngine.auditDiff(CLEAN_PR_DIFF, "origin/main");

    expect(report.status).toBe("PASS");
    expect(report.findings).toHaveLength(0);

    const markdown = formatReportMarkdown(report);
    expect(markdown).toContain("✅ **PASSED**");
    expect(markdown).toContain("All Integrity Checks Passed");
    expect(markdown).not.toContain("Blocking Findings");
  });

  it("2. Weakened assertion diff produces BLOCKED report with AST-ASSERT-WEAKENED", async () => {
    const report = await globalEngine.auditDiff(WEAKENED_ASSERTION_DIFF, "origin/main");

    expect(report.status).toBe("BLOCKED");
    const weakenedFinding = report.findings.find((f) => f.ruleId === "AST-ASSERT-WEAKENED");
    expect(weakenedFinding).toBeDefined();
    expect(weakenedFinding?.severity).toBe("critical");

    const markdown = formatReportMarkdown(report);
    expect(markdown).toContain("🛑 **BLOCKED**");
    expect(markdown).toContain("Blocking Findings (1)");
    expect(markdown).toContain("AST-ASSERT-WEAKENED");
    expect(markdown).toContain("expect(res).toBeGreaterThanOrEqual(0)");
  });

  it("3. Deleted test diff produces BLOCKED report with AST-TEST-DELETED", async () => {
    const report = await globalEngine.auditDiff(DELETED_TEST_DIFF, "origin/main");

    expect(report.status).toBe("BLOCKED");
    const deletedFinding = report.findings.find((f) => f.ruleId === "AST-TEST-DELETED");
    expect(deletedFinding).toBeDefined();
    expect(deletedFinding?.severity).toBe("high");

    const markdown = formatReportMarkdown(report);
    expect(markdown).toContain("🛑 **BLOCKED**");
    expect(markdown).toContain("AST-TEST-DELETED");
  });

  it("4. CI gate suppression diff produces BLOCKED report with CI-GATE-SUPPRESSION", async () => {
    const report = await globalEngine.auditDiff(GATE_SUPPRESSION_DIFF, "origin/main");

    expect(report.status).toBe("BLOCKED");
    const gateFinding = report.findings.find((f) => f.ruleId === "CI-GATE-SUPPRESSION");
    expect(gateFinding).toBeDefined();

    const markdown = formatReportMarkdown(report);
    expect(markdown).toContain("🛑 **BLOCKED**");
    expect(markdown).toContain("CI-GATE-SUPPRESSION");
  });

  it("5. Malformed diff is handled safely without crashing", async () => {
    const report = await globalEngine.auditDiff(MALFORMED_DIFF, "origin/main");

    expect(report).toBeDefined();
    expect(report.id).toBeDefined();
    expect(["PASS", "REVIEW", "BLOCKED"]).toContain(report.status);

    // Markdown formatter handles malformed reports safely
    const markdown = formatReportMarkdown(report);
    expect(markdown).toContain("Greenwash Diff Integrity Audit");
  });

  it("6. REVIEW findings are visible in summary but do not masquerade as BLOCKED", () => {
    // Construct a synthetic report with REVIEW status and a non-blocking finding
    const reviewReport: AuditReport = {
      id: "test-review-001",
      createdAt: new Date().toISOString(),
      baseRef: "origin/main",
      status: "REVIEW",
      summary: "Audit REVIEW: 1 suspicious pattern detected that warrants human review.",
      limitations: ["Model-assisted analysis is advisory only."],
      findings: [
        {
          id: "fnd-review-001",
          ruleId: "PROVENANCE-UNTRACKED-EDIT",
          title: "Untracked agent file modification",
          summary: "File modified without associated tool invocation record.",
          severity: "medium",
          source: "agent-provenance",
          humanAction: "Verify changes were intentional and not generated by rogue tool call.",
          limitations: [],
          evidence: [],
        },
      ],
      checks: [
        { id: "check-diff-parse", label: "Diff Parsing", status: "passed", durationMs: 5 },
        { id: "check-provenance", label: "Agent Provenance", status: "warning", durationMs: 10, detail: "Warning: Missing tool call ID" },
      ],
    };

    const markdown = formatReportMarkdown(reviewReport);

    // Review badge displayed
    expect(markdown).toContain("⚠️ **REVIEW REQUIRED**");
    expect(markdown).toContain("Review Findings (1)");
    expect(markdown).toContain("PROVENANCE-UNTRACKED-EDIT");

    // Must NOT state BLOCKED or CI Policy Violation
    expect(markdown).not.toContain("🛑 **BLOCKED**");
    expect(markdown).not.toContain("CI Policy Violation");
  });

  it("7. formatReportMarkdown renders GitHub Step Summary table, badges, and check statuses", () => {
    const sampleReport: AuditReport = {
      id: "sample-pr-audit-001",
      createdAt: "2026-10-22T14:30:00.000Z",
      baseRef: "origin/main",
      status: "BLOCKED",
      summary: "Audit BLOCKED: 1 issue(s) detected.",
      limitations: ["Deterministic static rules only."],
      findings: [
        {
          id: "fnd-01",
          ruleId: "AST-ASSERT-WEAKENED",
          title: "Weakened Test Assertion",
          summary: "Exact assertion loosened to truthy check.",
          severity: "high",
          source: "static-rule",
          humanAction: "Restore exact assertion.",
          reproductionCommand: "npx vitest run tests/math.test.ts",
          limitations: [],
          evidence: [
            {
              title: "Assertion loosened",
              detail: "toBe(42) -> toBeDefined()",
              filePath: "tests/math.test.ts",
              startLine: 12,
              afterSnippet: "expect(result).toBeDefined();",
            },
          ],
        },
      ],
      checks: [
        { id: "chk-diff", label: "Unified Diff Parsing", status: "passed", detail: "Parsed successfully", durationMs: 2 },
        { id: "chk-weaken", label: "Assertion Weakening", status: "failed", detail: "Detected 1 violation", durationMs: 4 },
      ],
    };

    const md = formatReportMarkdown(sampleReport);

    // Header & table
    expect(md).toContain("## 🛡️ Greenwash Diff Integrity Audit: 🛑 **BLOCKED**");
    expect(md).toContain("| **Status** | 🛑 **BLOCKED** |");
    expect(md).toContain("| **Audit ID** | `sample-pr-audit-001` |");
    expect(md).toContain("| **Base Reference** | `origin/main` |");

    // Findings section
    expect(md).toContain("### 🚨 Blocking Findings (1)");
    expect(md).toContain("`AST-ASSERT-WEAKENED`");
    expect(md).toContain("Restore exact assertion.");
    expect(md).toContain("`tests/math.test.ts:12`");
    expect(md).toContain("expect(result).toBeDefined();");

    // Checks list
    expect(md).toContain("| Unified Diff Parsing | ✅ Passed |");
    expect(md).toContain("| Assertion Weakening | ❌ Failed |");
  });

  it("8. GitHub Actions workflow YAML is valid and configured with minimal permissions (fork-safe)", () => {
    const workflowPath = path.resolve(process.cwd(), ".github/workflows/ci.yml");
    expect(fs.existsSync(workflowPath)).toBe(true);

    const workflowContent = fs.readFileSync(workflowPath, "utf-8");

    // Fork safety invariants
    expect(workflowContent).toContain("permissions:");
    expect(workflowContent).toContain("contents: read");
    expect(workflowContent).toContain("pull-requests: read");

    // Pin or constrain third-party actions
    expect(workflowContent).toContain("actions/checkout@v4");
    expect(workflowContent).toContain("actions/setup-node@v4");

    // Must NOT expose secrets in fork workflow steps
    expect(workflowContent).not.toContain("${{ secrets.MONGODB_URI }}");
    expect(workflowContent).not.toContain("${{ secrets.SENTRY_DSN }}");

    // Check Greenwash CLI invocation
    expect(workflowContent).toContain("node packages/cli/dist/index.js check");
    expect(workflowContent).toContain("--diff");
    expect(workflowContent).toContain("--format github");
  });

  it("9. Copilot instructions file exists and enforces behavior contracts", () => {
    const instructionsPath = path.resolve(process.cwd(), ".github/copilot-instructions.md");
    expect(fs.existsSync(instructionsPath)).toBe(true);

    const content = fs.readFileSync(instructionsPath, "utf-8");
    expect(content).toContain("AST-ASSERT-WEAKENED");
    expect(content).toContain("AST-TEST-DELETED");
    expect(content).toContain("AST-TEST-SKIPPED");
    expect(content).toContain("AST-MOCK-SUBSTITUTION");
    expect(content).toContain("CI-GATE-SUPPRESSION");
    expect(content).toContain("CONTRACT-MODIFIED");
    expect(content).toContain("npm run greenwash -- check");
  });

  it("10. PR template and agent task template exist", () => {
    const prTemplatePath = path.resolve(process.cwd(), ".github/PULL_REQUEST_TEMPLATE.md");
    expect(fs.existsSync(prTemplatePath)).toBe(true);

    const agentTaskPath = path.resolve(process.cwd(), ".github/agent-task-template.md");
    expect(fs.existsSync(agentTaskPath)).toBe(true);
  });
});
