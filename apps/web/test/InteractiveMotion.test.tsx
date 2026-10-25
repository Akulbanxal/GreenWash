/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CommandPalette } from "../src/components/CommandPalette";
import { DiffViewer } from "../src/components/DiffViewer";
import { ContextualEvidenceInspector } from "../src/components/ContextualEvidenceInspector";
import { AuditFinding, AuditReport } from "@greenwash/core/dist/browser.js";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Interactive Motion & Command Palette Tests", () => {
  const mockScenarios = [
    {
      id: "weakened-assertion",
      title: "Weakened Assertion",
      description: "Agent loosened equality check",
      threatCategory: "test-integrity" as const,
      expectedOutcome: "BLOCKED" as const,
      expectedRuleIds: ["AST-ASSERT-WEAKENED"],
      fixturePath: "fixtures/scenarios/weakened-assertion/test.patched.ts",
      diffPath: "fixtures/scenarios/weakened-assertion/patch.diff",
    },
    {
      id: "honest-fix",
      title: "Honest Bug Fix",
      description: "Agent fixed bug without weakening tests",
      threatCategory: "honest-fix" as const,
      expectedOutcome: "PASS" as const,
      expectedRuleIds: [],
      fixturePath: "fixtures/scenarios/honest-fix/test.patched.ts",
      diffPath: "fixtures/scenarios/honest-fix/patch.diff",
    },
  ];

  it("opens CommandPalette, filters by search query, and executes action", () => {
    const handleClose = vi.fn();
    const handleSelectScreen = vi.fn();
    const handleSelectScenario = vi.fn();
    const handleRunAudit = vi.fn();

    const { rerender } = render(
      <CommandPalette
        isOpen={false}
        onClose={handleClose}
        onSelectScreen={handleSelectScreen}
        scenarios={mockScenarios}
        selectedScenarioId="weakened-assertion"
        onSelectScenario={handleSelectScenario}
        onRunAudit={handleRunAudit}
      />
    );

    // When closed, nothing should be rendered
    expect(screen.queryByTestId("command-palette-modal")).toBeNull();

    // Open palette
    rerender(
      <CommandPalette
        isOpen={true}
        onClose={handleClose}
        onSelectScreen={handleSelectScreen}
        scenarios={mockScenarios}
        selectedScenarioId="weakened-assertion"
        onSelectScenario={handleSelectScenario}
        onRunAudit={handleRunAudit}
      />
    );

    expect(screen.getByTestId("command-palette-dialog")).toBeDefined();
    expect(screen.getByText("Run Integrity Audit")).toBeDefined();

    // Search for Honest
    const searchInput = screen.getByTestId("command-palette-input");
    fireEvent.change(searchInput, { target: { value: "Honest" } });

    expect(screen.getByText("Honest Bug Fix")).toBeDefined();
    expect(screen.queryByText("Run Integrity Audit")).toBeNull();

    // Click on Honest Bug Fix
    fireEvent.click(screen.getByText("Honest Bug Fix"));
    expect(handleSelectScenario).toHaveBeenCalledWith("honest-fix");
    expect(handleClose).toHaveBeenCalled();
  });

  it("supports keyboard navigation (Escape to close) in CommandPalette", () => {
    const handleClose = vi.fn();

    render(
      <CommandPalette
        isOpen={true}
        onClose={handleClose}
        onSelectScreen={vi.fn()}
        scenarios={mockScenarios}
        selectedScenarioId="weakened-assertion"
        onSelectScenario={vi.fn()}
        onRunAudit={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalled();
  });

  it("triggers onSelectLine when a diff line is clicked in DiffViewer", () => {
    const handleSelectLine = vi.fn();
    const lines = [
      {
        oldLineNumber: 6,
        newLineNumber: 6,
        type: "unchanged" as const,
        content: "  const discount = 100;",
        isFlagged: false,
      },
      {
        newLineNumber: 8,
        type: "added" as const,
        content: "+ expect(discounted).toBeGreaterThanOrEqual(0);",
        isFlagged: true,
      },
    ];

    render(
      <DiffViewer
        filePath="tests/discount.test.ts"
        lines={lines}
        splitView={false}
        onToggleSplit={vi.fn()}
        selectedLine={8}
        onSelectLine={handleSelectLine}
      />
    );

    // Click on line 8
    const addedLine = screen.getByText("+ expect(discounted).toBeGreaterThanOrEqual(0);");
    fireEvent.click(addedLine);

    expect(handleSelectLine).toHaveBeenCalledWith(8);
  });

  it("renders rich PASS summary in ContextualEvidenceInspector without inventing values", () => {
    const mockReport: AuditReport = {
      id: "rep-clean-pass",
      status: "PASS",
      summary: "Clean pass without behavioral drift.",
      findings: [],
      checks: [
        { id: "c1", label: "AST Test Integrity", status: "passed" },
        { id: "c2", label: "Contract Replay Invariant", status: "passed" },
      ],
      createdAt: new Date().toISOString(),
    };

    render(
      <ContextualEvidenceInspector
        finding={null}
        report={mockReport}
        onReturnToScenario={vi.fn()}
      />
    );

    expect(screen.getByTestId("evidence-inspector-pass-summary")).toBeDefined();
    expect(screen.getByText("All Integrity Checks Satisfied")).toBeDefined();
    expect(screen.getByText("Clean pass without behavioral drift.")).toBeDefined();
    expect(screen.getByText("2 / 2 passed")).toBeDefined();
    expect(screen.getByText("AST Test Integrity")).toBeDefined();
    expect(screen.getByText("Contract Replay Invariant")).toBeDefined();
  });

  it("renders purposeful no-audit-yet state with action button when report is null", () => {
    const handleRunAudit = vi.fn();

    render(
      <ContextualEvidenceInspector
        finding={null}
        report={null}
        onRunAudit={handleRunAudit}
      />
    );

    expect(screen.getByTestId("no-audit-yet-panel")).toBeDefined();
    expect(screen.getByText("No Finding Selected")).toBeDefined();
    expect(screen.getByText("Audit Not Run Yet")).toBeDefined();

    const runBtn = screen.getByTestId("inspector-run-audit-btn");
    fireEvent.click(runBtn);
    expect(handleRunAudit).toHaveBeenCalledTimes(1);
  });
});
