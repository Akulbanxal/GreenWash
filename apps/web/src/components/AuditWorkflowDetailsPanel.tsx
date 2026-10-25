import React, { useState, useRef } from "react";
import {
  WorkflowStepRecord,
  WorkflowTrace,
  AuditReport,
} from "@greenwash/core/dist/browser.js";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Slash,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Activity,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { TRANSITION_FAST, TRANSITION_PANEL } from "../motion";
import { useScrollToResult } from "../hooks/useScrollToResult";

export interface PipelineStepMeta {
  id: string;
  name: string;
  description: string;
  isIdempotent: boolean;
}

export const CANONICAL_PIPELINE_STEPS: PipelineStepMeta[] = [
  {
    id: "validate-scenario-diff",
    name: "Scenario & Diff Validation",
    description: "Validates scenario identifier, loads fixture or raw diff content",
    isIdempotent: true,
  },
  {
    id: "deterministic-scan",
    name: "Deterministic AST Scan",
    description: "Executes deterministic AST rules engine against changed diff hunks",
    isIdempotent: true,
  },
  {
    id: "contract-replay",
    name: "Protected Contract Replay",
    description: "Replays protected behavior contract in isolated subprocess",
    isIdempotent: false,
  },
  {
    id: "semantic-analysis",
    name: "Gemma Semantic Review",
    description: "Requests Gemma open-weight advisory review for eligible ambiguous findings",
    isIdempotent: true,
  },
  {
    id: "normalize-report",
    name: "Report Normalization & Validation",
    description: "Aggregates deterministic, replay, and advisory evidence into schema-validated AuditReport",
    isIdempotent: true,
  },
  {
    id: "emit-trace",
    name: "Provenance & Trace Emission",
    description: "Emits telemetry trace and metrics for the completed audit run",
    isIdempotent: true,
  },
];

export interface WorkflowOptionsState {
  enableGemma: boolean;
  enableEntire: boolean;
  stepTimeoutMs: number;
  totalTimeoutMs: number;
}

interface AuditWorkflowDetailsPanelProps {
  stepRecords: WorkflowStepRecord[];
  trace?: WorkflowTrace;
  runId?: string;
  workflowId?: string;
  status?: "success" | "failed" | "running" | "idle";
  report?: AuditReport | null;
  selectedScenarioId: string;
  options: WorkflowOptionsState;
  onChangeOptions: (opts: WorkflowOptionsState) => void;
  onExecutePipeline: () => void;
  isExecuting: boolean;
}

export function AuditWorkflowDetailsPanel({
  stepRecords,
  trace,
  runId,
  workflowId = "greenwash-audit-pipeline",
  status = "idle",
  report,
  selectedScenarioId,
  options,
  onChangeOptions,
  onExecutePipeline,
  isExecuting,
}: AuditWorkflowDetailsPanelProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const activeStepRef = useRef<HTMLDivElement>(null);

  // Target step to highlight: first failed step, or last completed step
  const targetStepId = stepRecords.find((r) => r.status === "failed")?.stepId ||
    (status === "success" && stepRecords.length > 0 ? stepRecords[stepRecords.length - 1]?.stepId : undefined);

  // Auto-scroll timeline to failed/completed step when execution completes
  useScrollToResult({
    targetRef: activeStepRef,
    containerRef: timelineContainerRef,
    triggerKey: runId ? `${runId}-${status}-${stepRecords.length}` : undefined,
    enabled: !isExecuting && (status === "success" || status === "failed"),
    topOffset: 24,
    focusOnScroll: true,
  });

  // Auto-scroll inspector to top when selected step changes
  useScrollToResult({
    targetRef: inspectorRef as React.RefObject<HTMLElement | null>,
    triggerKey: selectedStepId,
    enabled: Boolean(selectedStepId),
    topOffset: 0,
  });

  const getRecordForStep = (stepId: string): WorkflowStepRecord | undefined => {
    return stepRecords.find((r) => r.stepId === stepId);
  };

  const selectedRecord = selectedStepId ? getRecordForStep(selectedStepId) : undefined;
  const selectedMeta = CANONICAL_PIPELINE_STEPS.find((s) => s.id === selectedStepId);

  return (
    <div
      className="flex-1 flex flex-col bg-surface-base h-full overflow-hidden font-sans select-none"
      role="region"
      aria-label="Mastra Pipeline Orchestration Panel" data-testid="audit-workflow-panel"
    >
      {/* Top Workflow Summary Bar */}
      <div className="h-14 px-6 border-b border-border-default bg-surface-panel flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-primary animate-pulse" />
            <span className="font-mono text-xs font-bold text-text-primary uppercase tracking-wide">
              Mastra Workflow Orchestrator
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-subtle text-text-secondary border border-border-default">
              v1.79.0 Native
            </span>
          </div>

          <div className="h-4 w-px bg-border-default" />

          {/* Execution Status Badge */}
          <div className="flex items-center space-x-1.5 font-mono text-xs">
            <span className="text-text-tertiary">Status:</span>
            <span
              data-testid="workflow-status-badge"
              className={`px-2 py-0.5 rounded font-bold uppercase ${
                status === "success"
                  ? "bg-status-pass-bg text-status-pass-text border border-status-pass-border"
                  : status === "failed"
                    ? "bg-status-blocked-bg text-status-blocked-text border border-status-blocked-border"
                    : status === "running"
                      ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                      : "bg-surface-subtle text-text-secondary border border-border-default"
              }`}
            >
              {status}
            </span>
          </div>

          {/* Trace Identifier */}
          {(trace?.sentryTraceId || trace?.runId) && (
            <div className="flex items-center space-x-1 text-xs font-mono text-text-tertiary hidden md:flex">
              <span>Trace:</span>
              <span className="text-text-secondary font-bold truncate max-w-[140px]">
                {trace.sentryTraceId || trace.runId}
              </span>
            </div>
          )}

          {!options.enableGemma && (
            <span data-testid="no-gemma-pill" className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-700/50">
              Gemma Disabled
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`h-8 px-2.5 text-xs font-mono font-medium rounded border transition-colors flex items-center space-x-1 cursor-pointer ${
              showConfig
                ? "bg-brand-primary text-white dark:text-slate-950 border-brand-primary font-bold"
                : "bg-surface-subtle text-text-secondary border-border-default hover:text-text-primary"
            }`}
            data-testid="toggle-workflow-config-btn"
          >
            Environment Config
          </button>
          <button
            onClick={onExecutePipeline}
            disabled={isExecuting}
            className="h-8 px-3 rounded bg-brand-primary text-white dark:text-slate-950 text-xs font-mono font-bold flex items-center space-x-1.5 hover:opacity-90 active:bg-slate-900 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            data-testid="run-pipeline-workflow-btn"
          >
            {isExecuting ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Running Workflow...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Pipeline</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Config Drawer Bar */}
      {showConfig && (
        <div data-testid="workflow-config-bar" className="p-3 bg-surface-subtle border-b border-border-default flex items-center space-x-4 text-xs font-mono">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              data-testid="toggle-gemma-checkbox"
              checked={options.enableGemma}
              onChange={(e) => onChangeOptions({ ...options, enableGemma: e.target.checked })}
              className="rounded"
            />
            <span>Enable Gemma Advisory Analysis</span>
          </label>
        </div>
      )}

      {/* Main Workflow Body: 2-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Step Sequence DAG Timeline (Left Column) */}
        <div ref={timelineContainerRef} className="flex-1 p-6 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-text-primary">
                Audit Pipeline Step Graph
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Deterministic step execution graph for scenario: <code className="font-bold text-text-primary">{selectedScenarioId}</code>
              </p>
            </div>
            <span className="text-[10px] font-mono text-text-tertiary">
              Click a step to view trace & error logs
            </span>
          </div>

          <div className="space-y-3.5 relative">
            {CANONICAL_PIPELINE_STEPS.map((step, idx) => {
              const record = getRecordForStep(step.id);
              const isSelected = selectedStepId === step.id;

              const isCompleted = record?.status === "success";
              const isFailed = record?.status === "failed";
              const isOmitted = record?.status === "omitted";
              const isRunning = isExecuting && !record && idx === stepRecords.length;
              const isNotRun = !record && !isRunning;
              const isTargetStep = step.id === targetStepId;

              const isNextStepActive = isExecuting && idx + 1 === stepRecords.length;

              return (
                <div key={step.id} className="relative">
                  {/* Directional Flow Connector Line to Next Step */}
                  {idx < CANONICAL_PIPELINE_STEPS.length - 1 && (
                    <div className="absolute left-6 -bottom-3.5 w-0.5 h-3.5 z-0 pointer-events-none">
                      <div
                        className={`w-full h-full transition-colors ${
                          isCompleted
                            ? "bg-status-pass-solid"
                            : isNextStepActive || isRunning
                              ? "bg-brand-primary animate-pulse"
                              : "bg-border-default"
                        }`}
                      />
                    </div>
                  )}

                  <motion.div
                    ref={isTargetStep ? activeStepRef : undefined}
                    whileHover={shouldReduceMotion ? undefined : { y: -1.5, scale: 1.005, transition: { duration: 0.15 } }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.995 }}
                    onClick={() => setSelectedStepId(step.id)}
                    data-testid={`workflow-step-card-${step.id}`}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col space-y-2 relative scroll-mt-4 z-10 ${
                      isSelected
                        ? "bg-surface-panel border-brand-primary shadow-xs ring-1 ring-brand-primary"
                        : isRunning
                          ? "bg-surface-panel border-brand-primary ring-2 ring-brand-primary/40 shadow-md animate-pulse"
                          : isFailed
                            ? "bg-red-50/30 dark:bg-red-950/20 border-status-blocked-border hover:border-status-blocked-solid"
                            : isCompleted
                              ? "bg-surface-panel border-border-default hover:border-status-pass-border hover:bg-surface-subtle"
                              : "bg-surface-panel border-border-default hover:border-border-strong hover:bg-surface-subtle"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono font-bold ${
                          isRunning
                            ? "bg-brand-primary text-white dark:text-slate-950 border-brand-primary"
                            : isCompleted
                              ? "bg-status-pass-bg text-status-pass-solid border-status-pass-border"
                              : "bg-surface-subtle border-border-default text-text-secondary"
                        }`}>
                          {idx + 1}
                        </span>

                        {isCompleted && (
                          <CheckCircle2
                            className="w-4 h-4 text-status-pass-solid"
                            data-testid={`step-status-icon-${step.id}-success`}
                          />
                        )}
                        {isFailed && (
                          <XCircle
                            className="w-4 h-4 text-status-blocked-solid"
                            data-testid={`step-status-icon-${step.id}-failed`}
                          />
                        )}
                        {isOmitted && (
                          <Slash
                            className="w-4 h-4 text-text-tertiary"
                            data-testid={`step-status-icon-${step.id}-omitted`}
                          />
                        )}
                        {isRunning && (
                          <RotateCcw
                            className="w-4 h-4 text-brand-primary animate-spin"
                            data-testid={`step-status-icon-${step.id}-running`}
                          />
                        )}
                        {isNotRun && (
                          <Clock
                            className="w-4 h-4 text-border-strong"
                            data-testid={`step-status-icon-${step.id}-not-run`}
                          />
                        )}

                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-text-primary">
                              {step.name}
                            </span>
                            <span className="text-[10px] font-mono text-text-tertiary">
                              ({step.id})
                            </span>
                          </div>
                          <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-1">
                            {step.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 text-xs font-mono">
                        {record && (
                          <span className="text-text-tertiary">
                            {record.durationMs}ms
                          </span>
                        )}

                        <span
                          data-testid={`step-status-pill-${step.id}`}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isCompleted
                              ? "bg-status-pass-bg text-status-pass-text border border-status-pass-border"
                              : isFailed
                                ? "bg-status-blocked-bg text-status-blocked-text border border-status-blocked-border"
                                : isOmitted
                                  ? "bg-surface-subtle text-text-tertiary border border-border-default"
                                  : isRunning
                                    ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                                    : "bg-surface-subtle text-text-tertiary border border-border-subtle"
                          }`}
                        >
                          {isCompleted
                            ? "COMPLETED"
                            : isFailed
                              ? "FAILED"
                              : isOmitted
                                ? "OMITTED"
                                : isRunning
                                  ? "RUNNING"
                                  : "NOT RUN"}
                        </span>
                      </div>
                    </div>

                    {record?.outputSummary && (
                      <div
                        data-testid={`step-summary-${step.id}`}
                        className="text-[11px] font-mono text-text-secondary bg-surface-subtle p-2 rounded border border-border-default"
                      >
                        {record.outputSummary}
                      </div>
                    )}

                    {record?.error && (
                      <div
                        data-testid={`step-error-${step.id}`}
                        className="text-[11px] font-mono text-status-blocked-text bg-status-blocked-bg p-2 rounded border border-status-blocked-border"
                      >
                        Error: {record.error}
                      </div>
                    )}
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Step Inspector Drawer (Right Column) */}
        <aside
          ref={inspectorRef}
          className="w-[340px] bg-surface-panel border-l border-border-default p-4 flex flex-col h-full overflow-y-auto space-y-4 scroll-mt-4"
          data-testid="step-detail-inspector"
        >
          <div className="flex-1 flex flex-col space-y-4">
            {selectedMeta ? (
              <>
                <div className="border-b border-border-subtle pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider">
                      Step Inspector
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-subtle border border-border-default text-text-tertiary">
                      {selectedMeta.isIdempotent ? "Idempotent (Safe Retry)" : "Stateful Replay"}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-text-primary mt-1 font-mono">
                    {selectedMeta.name}
                  </h3>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                    {selectedMeta.description}
                  </p>
                </div>

                {selectedRecord ? (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="p-2.5 rounded bg-surface-subtle border border-border-default space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-text-tertiary">Execution Status:</span>
                        <span className="font-bold uppercase text-text-primary">{selectedRecord.status}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-text-tertiary">Execution Duration:</span>
                        <span className="text-text-primary">{selectedRecord.durationMs}ms</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-text-tertiary">Retries:</span>
                        <span className="text-text-primary">{selectedRecord.retries}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-text-tertiary">Started:</span>
                        <span className="text-[10px] text-text-tertiary">
                          {new Date(selectedRecord.startedAt).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-text-tertiary">Completed:</span>
                        <span className="text-[10px] text-text-tertiary">
                          {new Date(selectedRecord.completedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    {selectedRecord.outputSummary && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-text-secondary uppercase">
                          Output Summary
                        </span>
                        <div className="p-2.5 rounded bg-surface-subtle border border-border-default text-text-primary whitespace-pre-wrap leading-relaxed">
                          {selectedRecord.outputSummary}
                        </div>
                      </div>
                    )}

                    {selectedRecord.error && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-status-blocked-solid uppercase">
                          Step Failure Trace
                        </span>
                        <div className="p-2.5 rounded bg-status-blocked-bg border border-status-blocked-border text-status-blocked-text whitespace-pre-wrap">
                          {selectedRecord.error}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center text-text-tertiary space-y-2">
                    <Clock className="w-8 h-8 mx-auto text-border-strong" />
                    <div className="text-xs font-mono font-semibold text-text-secondary">
                      Step Not Executed Yet
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      This step has not been executed in the current session. Run the pipeline to view real execution metrics.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col justify-between p-2 text-text-secondary space-y-4 font-sans select-none">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-mono font-bold text-text-primary uppercase tracking-wide">
                      Pipeline Architecture
                    </h3>
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                      Mastra orchestrates the Greenwash audit through 6 deterministic, isolated steps.
                    </p>
                  </div>
                  <div className="text-[11px] font-mono bg-surface-subtle border border-border-default rounded p-2.5 space-y-1.5">
                    <div className="text-text-primary font-bold">Guaranteed Invariants:</div>
                    <div className="text-text-secondary">• AST rules have final veto authority</div>
                    <div className="text-text-secondary">• Model text cannot downgrade a BLOCKED status</div>
                    <div className="text-text-secondary">• Timeouts enforced per-step (5s) and overall (25s)</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border-subtle">
                  <button
                    onClick={onExecutePipeline}
                    disabled={isExecuting}
                    className="w-full h-8 px-3 rounded bg-brand-primary text-white dark:text-slate-950 text-xs font-mono font-bold flex items-center justify-center space-x-1.5 hover:opacity-90 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Execute Pipeline Run</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
