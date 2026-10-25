/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import App from "../src/App";
import * as api from "../src/api";

const MOCK_SCENARIOS = [
  {
    id: "weakened-assertion",
    title: "Weakened Assertion (Silent Evasion)",
    description: "Agent loosened exact equality check to relational inequality.",
    threatCategory: "test-integrity",
    expectedOutcome: "BLOCKED",
    expectedRuleIds: ["AST-ASSERT-WEAKENED", "CONTRACT-VIOLATION"],
    fixturePath: "fixtures/scenarios/weakened-assertion/test.patched.ts",
    diffPath: "fixtures/scenarios/weakened-assertion/patch.diff",
  },
  {
    id: "honest-fix",
    title: "Honest Bug Fix",
    description: "Agent correctly fixed discount math.",
    threatCategory: "honest-fix",
    expectedOutcome: "PASS",
    expectedRuleIds: [],
    fixturePath: "fixtures/scenarios/honest-fix/test.patched.ts",
    diffPath: "fixtures/scenarios/honest-fix/patch.diff",
  },
];

const MOCK_DIFF = `--- a/tests/discount.test.ts
+++ b/tests/discount.test.ts
@@ -6,3 +6,3 @@
     const discounted = calculateDiscount(1000, 10);
-    expect(discounted).toBe(900);
+    expect(discounted).toBeGreaterThanOrEqual(0);
   });`;

const MOCK_REPORT = {
  id: "rep_test_workbench_999",
  createdAt: "2026-10-22T12:00:00.000Z",
  scenarioId: "weakened-assertion",
  status: "BLOCKED",
  summary: "Diff audit detected 2 critical integrity defects and 1 review suspicion.",
  limitations: [
    "Evaluated against static AST diff rules and approved behavior contract.",
  ],
  checks: [
    {
      id: "chk-diff-rules",
      label: "Deterministic AST & Git Diff Integrity",
      status: "failed",
      detail: "Violations discovered in proposed diff",
    },
    {
      id: "chk-behavior-replay",
      label: "Protected Contract Behavior Replay",
      status: "failed",
      detail: "Contract replay failed expectation",
    },
  ],
  findings: [
    {
      id: "fnd-ast-weakened-1",
      ruleId: "AST-ASSERT-WEAKENED",
      title: "Exact assertion loosened to non-discriminating check",
      summary: "toBe(900) was replaced by toBeGreaterThanOrEqual(0).",
      severity: "critical",
      source: "static-rule",
      evidence: [
        {
          filePath: "tests/discount.test.ts",
          startLine: 7,
          endLine: 7,
          title: "Strict assertion loosened",
          detail: 'Before: "expect(discounted).toBe(900);" -> After: "expect(discounted).toBeGreaterThanOrEqual(0);"',
          beforeSnippet: "expect(discounted).toBe(900);",
          afterSnippet: "expect(discounted).toBeGreaterThanOrEqual(0);",
          diffHunk: "@@ -6,3 +6,3 @@",
        },
      ],
      expected: "toBe(900)",
      actual: "toBeGreaterThanOrEqual(0)",
      reproductionCommand: "npx vitest run tests/discount.test.ts",
      humanAction: "Restore exact assertion toBe(900) and verify true logic fix.",
      limitations: ["Static pattern inspection."],
    },
    {
      id: "fnd-contract-violation-1",
      ruleId: "CONTRACT-VIOLATION",
      title: "Candidate code violates approved Behavior Contract",
      summary: "Approved contract specifies calculateDiscount(1000, 10) === 900, but candidate returned 1000.",
      severity: "critical",
      source: "contract-replay",
      evidence: [
        {
          filePath: "tests/discount.test.ts",
          startLine: 7,
          endLine: 7,
          title: "Counterexample Replay Mismatch",
          detail: "Expected 900 cents but returned 1000 cents under contract-discount-v1.",
        },
      ],
      expected: "900 cents",
      actual: "1000 cents",
      reproductionCommand: "npm run greenwash -- demo --scenario weakened-assertion",
      humanAction: "Fix discount logic in calculateDiscount() to subtract discount from price.",
      limitations: ["Sandboxed execution within isolated subprocess."],
    },
    {
      id: "fnd-unknown-location-1",
      ruleId: "AGENT-UNEXPECTED-ACTION",
      title: "Model-assisted suspicion with unknown line number",
      summary: "Agent altered script tags without recorded edit traces.",
      severity: "medium",
      source: "model-assisted",
      evidence: [
        {
          title: "Trace provenance absence",
          detail: "File edited without associated tool trace ID.",
        },
      ],
      reproductionCommand: "git diff HEAD~1 package.json",
      humanAction: "Manually verify build scripts.",
      limitations: ["Inferred from agent session trace logs."],
    },
  ],
};

describe("Audit Workbench Core Investigation Workspace (Prompt 9)", () => {
  let clipboardText = "";

  beforeEach(() => {
    clipboardText = "";
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn((text: string) => {
          clipboardText = text;
          return Promise.resolve();
        }),
      },
    });

    global.fetch = vi.fn().mockImplementation((input: any, options?: any) => {
      const urlStr = typeof input === "string" ? input : input.url || "";
      if (urlStr.includes("scenarios") && urlStr.includes("/diff")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(MOCK_DIFF),
        });
      }
      if (urlStr.includes("scenarios")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_SCENARIOS),
        });
      }
      if (urlStr.includes("audits/demo")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_REPORT),
        });
      }
      return Promise.reject(new Error("Unknown route: " + urlStr));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders 3-pane workbench and synchronizes selected finding across sidebar, diff, and inspector", async () => {
    render(<App />);

    // Trigger audit to populate real findings
    const runBtn = screen.getByTestId("lab-run-audit-btn");
    fireEvent.click(runBtn);

    // Wait for audit result card to appear
    await waitFor(() => {
      expect(screen.getByTestId("lab-inspect-workbench-btn")).toBeDefined();
    });

    // Navigate into Workbench
    fireEvent.click(screen.getByTestId("lab-inspect-workbench-btn"));

    await waitFor(() => {
      // Title appears in both sidebar row and inspector h2; use getAllByText
      expect(screen.getAllByText("Exact assertion loosened to non-discriminating check").length).toBeGreaterThan(0);
    });

    // Verify finding list contains our findings
    expect(screen.getByText("Candidate code violates approved Behavior Contract")).toBeDefined();

    // Verify Evidence Inspector displays finding details (inspector h2)
    const inspectorHeading = screen.getByRole("heading", { name: "Exact assertion loosened to non-discriminating check" });
    expect(inspectorHeading).toBeDefined();
    expect(screen.getByText("Evidence Details (1)")).toBeDefined();
    expect(screen.getByText("Restore exact assertion toBe(900) and verify true logic fix.")).toBeDefined();

    // Verify expected and actual values are rendered
    expect(screen.getByText(/"toBe\(900\)"/)).toBeDefined();
    expect(screen.getByText(/"toBeGreaterThanOrEqual\(0\)"/)).toBeDefined();

    // Verify source label displays deterministic badge
    expect(screen.getByText("[DET] Deterministic Rule")).toBeDefined();

    // Click second finding (Contract Replay) via testId to avoid duplicate-text ambiguity
    const secondFindingBtn = screen.getByTestId("finding-row-fnd-contract-violation-1");
    fireEvent.click(secondFindingBtn);

    // Verify Inspector updates synchronously
    await waitFor(() => {
      expect(screen.getByText(/"900 cents"/)).toBeDefined();
      expect(screen.getByText(/"1000 cents"/)).toBeDefined();
      expect(screen.getByText("[REPLAY] Contract Confirmed")).toBeDefined();
    });
  });

  it("labels unknown line numbers as unavailable rather than guessing", async () => {
    render(<App />);

    fireEvent.click(screen.getByTestId("run-audit-button"));
    fireEvent.click(screen.getByText("Workbench"));

    await waitFor(() => {
      expect(screen.getByText("Model-assisted suspicion with unknown line number")).toBeDefined();
    });

    // Click finding with undefined lineStart/lineEnd
    fireEvent.click(screen.getByText("Model-assisted suspicion with unknown line number"));

    await waitFor(() => {
      expect(screen.getByText("Location unavailable")).toBeDefined();
    });
  });

  it("filters findings list by severity dropdown", async () => {
    render(<App />);

    fireEvent.click(screen.getByTestId("run-audit-button"));
    fireEvent.click(screen.getByText("Workbench"));

    await waitFor(() => {
      // Title appears in sidebar row AND inspector; getAllByText avoids ambiguity
      expect(screen.getAllByText("Exact assertion loosened to non-discriminating check").length).toBeGreaterThan(0);
    });

    const filterSelect = screen.getByLabelText("Filter findings by severity");
    expect(filterSelect).toBeDefined();

    // Filter to medium severity only
    fireEvent.change(filterSelect, { target: { value: "medium" } });

    // Medium finding should be visible
    expect(screen.getByText("Model-assisted suspicion with unknown line number")).toBeDefined();
    // Critical findings should be filtered out from sidebar (inspector may still show them)
    // Use queryAllByText for robust check; sidebar span should be gone
    const matchesAfterFilter = screen.queryAllByText("Exact assertion loosened to non-discriminating check");
    // After filtering critical out, only the inspector h2 (if still selected) would remain
    // The sidebar span must be gone — find only in sidebar via testId
    const sidebarSpan = matchesAfterFilter.find(el => el.tagName === "SPAN");
    expect(sidebarSpan).toBeUndefined();

    // Switch back to all
    fireEvent.change(filterSelect, { target: { value: "all" } });
    expect(screen.getAllByText("Exact assertion loosened to non-discriminating check").length).toBeGreaterThan(0);
  });

  it("copies reproduction command and report ID with visual feedback", async () => {
    render(<App />);

    fireEvent.click(screen.getByTestId("run-audit-button"));
    fireEvent.click(screen.getByText("Workbench"));

    await waitFor(() => {
      expect(screen.getByTestId("copy-repro-btn")).toBeDefined();
    });

    // Copy repro command
    const copyReproBtn = screen.getByTestId("copy-repro-btn");
    fireEvent.click(copyReproBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("npx vitest run tests/discount.test.ts");
    expect(clipboardText).toBe("npx vitest run tests/discount.test.ts");
    expect(screen.getByText("Copied!")).toBeDefined();

    // Copy report ID
    const copyReportBtn = screen.getByTestId("copy-report-id-btn");
    fireEvent.click(copyReportBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("rep_test_workbench_999");
  });

  it("handles copy failure gracefully without throwing uncaught exceptions", async () => {
    // Force writeText to reject
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(() => Promise.reject(new Error("Clipboard permission denied"))),
      },
    });

    render(<App />);

    fireEvent.click(screen.getByTestId("run-audit-button"));
    fireEvent.click(screen.getByText("Workbench"));

    await waitFor(() => {
      expect(screen.getByTestId("copy-repro-btn")).toBeDefined();
    });

    const copyReproBtn = screen.getByTestId("copy-repro-btn");
    expect(() => fireEvent.click(copyReproBtn)).not.toThrow();
  });

  it("handles empty / clean audit state with deliberate no-findings message", async () => {
    const cleanReport = {
      ...MOCK_REPORT,
      id: "rep_clean_pass",
      status: "PASS",
      findings: [],
      summary: "Clean pass. No integrity defects found.",
      checks: [
        {
          id: "chk-diff-rules",
          label: "Deterministic AST & Git Diff Integrity",
          status: "passed",
          detail: "No violations",
        },
      ],
    };

    global.fetch = vi.fn().mockImplementation((input: any) => {
      const urlStr = typeof input === "string" ? input : input.url || "";
      if (urlStr.includes("scenarios") && urlStr.includes("/diff")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(MOCK_DIFF),
        });
      }
      if (urlStr.includes("scenarios")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_SCENARIOS),
        });
      }
      if (urlStr.includes("audits/demo")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(cleanReport),
        });
      }
      return Promise.reject(new Error("Unknown route: " + urlStr));
    });

    render(<App />);

    // Run the audit then navigate to workbench
    fireEvent.click(screen.getByTestId("run-audit-button"));

    // Wait for the report card (Inspect in Workbench button shows)
    await waitFor(() => {
      expect(screen.getByTestId("lab-inspect-workbench-btn")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("lab-inspect-workbench-btn"));

    await waitFor(() => {
      expect(screen.getByText("No Integrity Findings")).toBeDefined();
    });

    expect(screen.getByText("Diff cleanly passed all static and contract checks.")).toBeDefined();
    expect(screen.getByText("Return to Demo Lab")).toBeDefined();
  });
});
