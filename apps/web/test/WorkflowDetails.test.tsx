/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  AuditWorkflowDetailsPanel,
  WorkflowOptionsState,
} from "../src/components/AuditWorkflowDetailsPanel";
import { WorkflowStepRecord, WorkflowTrace } from "@greenwash/core/dist/browser.js";

describe("AuditWorkflowDetailsPanel Component", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultOptions: WorkflowOptionsState = {
    enableGemma: true,
    enableEntire: true,
    stepTimeoutMs: 5000,
    totalTimeoutMs: 25000,
  };

  const sampleTrace: WorkflowTrace = {
    runId: "run-smoke-12345",
    workflowId: "greenwash-audit-pipeline",
    totalDurationMs: 84,
    stepsExecuted: 5,
    stepsSucceeded: 4,
    stepsFailed: 0,
    stepsOmitted: 1,
    timestamp: new Date().toISOString(),
  };

  it("renders all 6 canonical pipeline steps in defined order", () => {
    render(
      <AuditWorkflowDetailsPanel
        stepRecords={[]}
        selectedScenarioId="weakened-assertion"
        options={defaultOptions}
        onChangeOptions={vi.fn()}
        onExecutePipeline={vi.fn()}
        isExecuting={false}
      />
    );

    expect(screen.getByTestId("audit-workflow-panel")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-step-card-validate-scenario-diff")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-step-card-deterministic-scan")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-step-card-contract-replay")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-step-card-semantic-analysis")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-step-card-normalize-report")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-step-card-emit-trace")).toBeInTheDocument();
  });

  it("CRITICAL RULE: Never displays a step as completed if it was not run", () => {
    // Only step 1 and step 2 ran
    const partialRecords: WorkflowStepRecord[] = [
      {
        stepId: "validate-scenario-diff",
        name: "Scenario & Diff Validation",
        status: "success",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 4,
        retries: 0,
        outputSummary: "Validated diff (240 bytes)",
      },
      {
        stepId: "deterministic-scan",
        name: "Deterministic AST Scan",
        status: "success",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 12,
        retries: 0,
        outputSummary: "Detected 1 finding(s)",
      },
    ];

    render(
      <AuditWorkflowDetailsPanel
        stepRecords={partialRecords}
        selectedScenarioId="weakened-assertion"
        options={defaultOptions}
        onChangeOptions={vi.fn()}
        onExecutePipeline={vi.fn()}
        isExecuting={false}
      />
    );

    // Steps 1 & 2 must be COMPLETED
    expect(screen.getByTestId("step-status-pill-validate-scenario-diff")).toHaveTextContent("COMPLETED");
    expect(screen.getByTestId("step-status-pill-deterministic-scan")).toHaveTextContent("COMPLETED");

    // Steps 3, 4, 5, 6 MUST be NOT RUN - NEVER completed!
    expect(screen.getByTestId("step-status-pill-contract-replay")).toHaveTextContent("NOT RUN");
    expect(screen.getByTestId("step-status-pill-semantic-analysis")).toHaveTextContent("NOT RUN");
    expect(screen.getByTestId("step-status-pill-normalize-report")).toHaveTextContent("NOT RUN");
    expect(screen.getByTestId("step-status-pill-emit-trace")).toHaveTextContent("NOT RUN");

    // Must NOT have success icons for unexecuted steps
    expect(screen.queryByTestId("step-status-icon-contract-replay-success")).toBeNull();
    expect(screen.queryByTestId("step-status-icon-semantic-analysis-success")).toBeNull();
  });

  it("accurately marks omitted steps and displays omission rationale", () => {
    const recordsWithOmitted: WorkflowStepRecord[] = [
      {
        stepId: "validate-scenario-diff",
        name: "Scenario & Diff Validation",
        status: "success",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 2,
        retries: 0,
      },
      {
        stepId: "semantic-analysis",
        name: "Gemma Semantic Review",
        status: "omitted",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        retries: 0,
        outputSummary: "Omitted: Gemma semantic analysis disabled by options",
      },
    ];

    render(
      <AuditWorkflowDetailsPanel
        stepRecords={recordsWithOmitted}
        selectedScenarioId="weakened-assertion"
        options={{ ...defaultOptions, enableGemma: false }}
        onChangeOptions={vi.fn()}
        onExecutePipeline={vi.fn()}
        isExecuting={false}
      />
    );

    expect(screen.getByTestId("step-status-pill-semantic-analysis")).toHaveTextContent("OMITTED");
    expect(screen.getByTestId("step-summary-semantic-analysis")).toHaveTextContent(
      "Omitted: Gemma semantic analysis disabled by options"
    );
    expect(screen.getByTestId("no-gemma-pill")).toBeInTheDocument();
  });

  it("accurately marks failed steps and displays failure error trace", () => {
    const recordsWithFailure: WorkflowStepRecord[] = [
      {
        stepId: "semantic-analysis",
        name: "Gemma Semantic Review",
        status: "failed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 1500,
        retries: 1,
        error: "Gemma review failed: Connection refused at http://127.0.0.1:11434",
      },
    ];

    render(
      <AuditWorkflowDetailsPanel
        stepRecords={recordsWithFailure}
        selectedScenarioId="weakened-assertion"
        options={defaultOptions}
        onChangeOptions={vi.fn()}
        onExecutePipeline={vi.fn()}
        isExecuting={false}
      />
    );

    expect(screen.getByTestId("step-status-pill-semantic-analysis")).toHaveTextContent("FAILED");
    expect(screen.getByTestId("step-error-semantic-analysis")).toHaveTextContent(
      "Error: Gemma review failed: Connection refused at http://127.0.0.1:11434"
    );
  });

  it("selects step to inspect detailed drawer metrics", () => {
    const sampleRecords: WorkflowStepRecord[] = [
      {
        stepId: "deterministic-scan",
        name: "Deterministic AST Scan",
        status: "success",
        startedAt: new Date("2026-10-22T10:00:00Z").toISOString(),
        completedAt: new Date("2026-10-22T10:00:01Z").toISOString(),
        durationMs: 14,
        retries: 0,
        outputSummary: "Detected 1 finding(s) across 7 check(s)",
      },
    ];

    render(
      <AuditWorkflowDetailsPanel
        stepRecords={sampleRecords}
        trace={sampleTrace}
        runId="run-test-999"
        selectedScenarioId="weakened-assertion"
        options={defaultOptions}
        onChangeOptions={vi.fn()}
        onExecutePipeline={vi.fn()}
        isExecuting={false}
      />
    );

    // Click deterministic scan step
    fireEvent.click(screen.getByTestId("workflow-step-card-deterministic-scan"));

    const inspector = screen.getByTestId("step-detail-inspector");
    expect(inspector).toBeInTheDocument();
    expect(inspector).toHaveTextContent("Deterministic AST Scan");
    expect(inspector).toHaveTextContent("14ms");
    expect(inspector).toHaveTextContent("Detected 1 finding(s) across 7 check(s)");
  });

  it("toggles environment configuration and triggers callbacks", () => {
    const handleChangeOptions = vi.fn();
    const handleExecutePipeline = vi.fn();

    render(
      <AuditWorkflowDetailsPanel
        stepRecords={[]}
        selectedScenarioId="weakened-assertion"
        options={defaultOptions}
        onChangeOptions={handleChangeOptions}
        onExecutePipeline={handleExecutePipeline}
        isExecuting={false}
      />
    );

    // Open config drawer
    fireEvent.click(screen.getByTestId("toggle-workflow-config-btn"));
    expect(screen.getByTestId("workflow-config-bar")).toBeInTheDocument();

    // Toggle Gemma checkbox
    fireEvent.click(screen.getByTestId("toggle-gemma-checkbox"));
    expect(handleChangeOptions).toHaveBeenCalledWith(
      expect.objectContaining({ enableGemma: false })
    );

    // Trigger pipeline run
    fireEvent.click(screen.getByTestId("run-pipeline-workflow-btn"));
    expect(handleExecutePipeline).toHaveBeenCalledTimes(1);
  });
});
