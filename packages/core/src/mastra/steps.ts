import fs from "node:fs";
import path from "node:path";
import { createStep } from "@mastra/core/workflows";
import {
  AuditPipelineContext,
  AuditPipelineContextSchema,
  WorkflowStepRecord,
} from "./types.js";
import { DeterministicDiffScanner } from "../rules/scanner.js";
import { BehaviorReplayRunner } from "../replay/runner.js";
import { GemmaSemanticReviewer } from "../gemma/GemmaSemanticReviewer.js";
import { getScenarioById, isAllowedScenarioId } from "../fixtures/loader.js";
import { computeAuditStatus } from "../domain/status.js";
import { AuditFinding, AuditReport, AuditReportSchema } from "../domain/schemas.js";
import { traceAuditStep, getActiveTraceContext } from "../sentry/index.js";

async function executeWithStepTimeout<T>(
  action: () => Promise<T>,
  timeoutMs: number,
  stepName: string,
  abortSignal?: AbortSignal
): Promise<T> {
  if (abortSignal?.aborted) {
    throw new Error(`Step '${stepName}' aborted before execution`);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Step '${stepName}' timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  const abortPromise = new Promise<never>((_, reject) => {
    if (abortSignal) {
      abortSignal.addEventListener("abort", () => {
        reject(new Error(`Step '${stepName}' was cancelled`));
      });
    }
  });

  try {
    return await Promise.race([action(), timeoutPromise, abortPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Step 1: Validate Scenario / Diff
 * Ensures scenario ID is allow-listed and loads diff file, or validates raw diff.
 */
export const validateScenarioDiffStep = createStep({
  id: "validate-scenario-diff",
  description: "Validates scenario identifier, loads fixture or raw diff content",
  inputSchema: AuditPipelineContextSchema,
  outputSchema: AuditPipelineContextSchema,
  retries: 2,
  execute: async ({ inputData, abortSignal, retryCount }) => {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const timeoutMs = inputData.options?.stepTimeoutMs ?? 5000;

    try {
      const result = await executeWithStepTimeout(
        async () => {
          let resolvedDiff = inputData.diff;
          let resolvedScenarioId = inputData.scenarioId;

          if (resolvedScenarioId) {
            if (!isAllowedScenarioId(resolvedScenarioId)) {
              throw new Error(`Invalid scenario ID: '${resolvedScenarioId}'. Must be an allow-listed scenario.`);
            }
            const scenario = getScenarioById(resolvedScenarioId);
            const diffFullPath = path.resolve(process.cwd(), scenario.diffPath);
            if (!fs.existsSync(diffFullPath)) {
              throw new Error(`Scenario diff file not found at: ${diffFullPath}`);
            }
            resolvedDiff = fs.readFileSync(diffFullPath, "utf-8");
          }

          if (!resolvedDiff || typeof resolvedDiff !== "string" || !resolvedDiff.trim()) {
            throw new Error("Empty diff content. Provide a valid scenarioId or unified diff string.");
          }

          return {
            diff: resolvedDiff,
            scenarioId: resolvedScenarioId,
          };
        },
        timeoutMs,
        "validate-scenario-diff",
        abortSignal
      );

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      const record: WorkflowStepRecord = {
        stepId: "validate-scenario-diff",
        name: "Scenario & Diff Validation",
        status: "success",
        startedAt,
        completedAt,
        durationMs,
        outputSummary: `Validated diff (${result.diff.length} bytes)${result.scenarioId ? ` for scenario '${result.scenarioId}'` : ""}`,
        retries: retryCount,
      };

      return {
        ...inputData,
        diff: result.diff,
        scenarioId: result.scenarioId,
        validation: {
          status: "success" as const,
          scenarioId: result.scenarioId,
          diff: result.diff,
        },
        stepRecords: [...inputData.stepRecords, record],
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      const record: WorkflowStepRecord = {
        stepId: "validate-scenario-diff",
        name: "Scenario & Diff Validation",
        status: "failed",
        startedAt,
        completedAt,
        durationMs,
        error: errorMsg,
        retries: retryCount,
      };

      return {
        ...inputData,
        validation: {
          status: "failed" as const,
          error: errorMsg,
        },
        stepRecords: [...inputData.stepRecords, record],
      };
    }
  },
});

/**
 * Step 2: Deterministic Scan
 * Runs AST diff analysis across assertions, deletions, skips, mocks, and CI gates.
 */
export const deterministicScanStep = createStep({
  id: "deterministic-scan",
  description: "Executes deterministic AST rules engine against changed diff hunks",
  inputSchema: AuditPipelineContextSchema,
  outputSchema: AuditPipelineContextSchema,
  retries: 2,
  execute: async ({ inputData, abortSignal, retryCount }) => {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const timeoutMs = inputData.options?.stepTimeoutMs ?? 5000;

    // Check if prerequisite step failed
    if (inputData.validation?.status === "failed" || !inputData.diff) {
      const record: WorkflowStepRecord = {
        stepId: "deterministic-scan",
        name: "Deterministic AST Scan",
        status: "omitted",
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 0,
        outputSummary: "Omitted due to failed diff validation",
        retries: retryCount,
      };
      return {
        ...inputData,
        deterministicScan: {
          status: "omitted" as const,
          findings: [],
          checks: [],
          error: "Omitted: diff validation failed",
        },
        stepRecords: [...inputData.stepRecords, record],
      };
    }

    try {
      const scanResult = await executeWithStepTimeout(
        async () => {
          const scanner = new DeterministicDiffScanner();
          return scanner.scan(inputData.diff!);
        },
        timeoutMs,
        "deterministic-scan",
        abortSignal
      );

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      const record: WorkflowStepRecord = {
        stepId: "deterministic-scan",
        name: "Deterministic AST Scan",
        status: "success",
        startedAt,
        completedAt,
        durationMs,
        outputSummary: `Detected ${scanResult.findings.length} finding(s) across ${scanResult.checks.length} check(s)`,
        retries: retryCount,
      };

      return {
        ...inputData,
        deterministicScan: {
          status: "success" as const,
          findings: scanResult.findings,
          checks: scanResult.checks,
        },
        stepRecords: [...inputData.stepRecords, record],
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      const record: WorkflowStepRecord = {
        stepId: "deterministic-scan",
        name: "Deterministic AST Scan",
        status: "failed",
        startedAt,
        completedAt,
        durationMs,
        error: errorMsg,
        retries: retryCount,
      };

      return {
        ...inputData,
        deterministicScan: {
          status: "failed" as const,
          findings: [],
          checks: [],
          error: errorMsg,
        },
        stepRecords: [...inputData.stepRecords, record],
      };
    }
  },
});

/**
 * Step 3: Contract Replay
 * Executes protected behavior contract replay in an isolated subprocess.
 */
export const contractReplayStep = createStep({
  id: "contract-replay",
  description: "Replays protected behavior contract in isolated subprocess",
  inputSchema: AuditPipelineContextSchema,
  outputSchema: AuditPipelineContextSchema,
  retries: 1,
  execute: async ({ inputData, abortSignal, retryCount }) => {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const timeoutMs = inputData.options?.stepTimeoutMs ?? 10000;

    // Check if contract replay is applicable
    if (!inputData.scenarioId) {
      const record: WorkflowStepRecord = {
        stepId: "contract-replay",
        name: "Protected Contract Replay",
        status: "omitted",
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 0,
        outputSummary: "Omitted: no registered behavior contract for ad-hoc diff",
        retries: retryCount,
      };
      return {
        ...inputData,
        contractReplay: {
          status: "omitted" as const,
          findings: [],
          checks: [],
        },
        stepRecords: [...inputData.stepRecords, record],
      };
    }

    try {
      const replayOutcome = await executeWithStepTimeout(
        async () => {
          const runner = new BehaviorReplayRunner();
          return runner.replayScenario(inputData.scenarioId!);
        },
        timeoutMs,
        "contract-replay",
        abortSignal
      );

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      const record: WorkflowStepRecord = {
        stepId: "contract-replay",
        name: "Protected Contract Replay",
        status: "success",
        startedAt,
        completedAt,
        durationMs,
        outputSummary: `Replay completed: ${replayOutcome.findings.length} violation(s), ${replayOutcome.checks.length} check(s)`,
        retries: retryCount,
      };

      return {
        ...inputData,
        contractReplay: {
          status: "success" as const,
          findings: replayOutcome.findings,
          checks: replayOutcome.checks,
          contractId: replayOutcome.checks[0]?.id,
        },
        stepRecords: [...inputData.stepRecords, record],
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      const record: WorkflowStepRecord = {
        stepId: "contract-replay",
        name: "Protected Contract Replay",
        status: "failed",
        startedAt,
        completedAt,
        durationMs,
        error: errorMsg,
        retries: retryCount,
      };

      return {
        ...inputData,
        contractReplay: {
          status: "failed" as const,
          findings: [],
          checks: [],
          error: errorMsg,
        },
        stepRecords: [...inputData.stepRecords, record],
      };
    }
  },
});

/**
 * Step 4: Semantic Analysis (Gemma Open-Weight Review)
 * Requests Gemma semantic risk review for eligible findings.
 * Untrusted advisory only: cannot downgrade or erase deterministic findings.
 */
export const semanticAnalysisStep = createStep({
  id: "semantic-analysis",
  description: "Requests Gemma open-weight review for eligible ambiguous findings",
  inputSchema: AuditPipelineContextSchema,
  outputSchema: AuditPipelineContextSchema,
  retries: 1,
  execute: async ({ inputData, abortSignal, retryCount }) => {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const timeoutMs = inputData.options?.stepTimeoutMs ?? 5000;

    // Check if Gemma is disabled
    if (inputData.options?.enableGemma === false) {
      const record: WorkflowStepRecord = {
        stepId: "semantic-analysis",
        name: "Gemma Semantic Review",
        status: "omitted",
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 0,
        outputSummary: "Omitted: Gemma semantic analysis disabled by options",
        retries: retryCount,
      };
      return {
        ...inputData,
        semanticAnalysis: {
          status: "omitted" as const,
          findings: [],
          eligibleFindingCount: 0,
        },
        stepRecords: [...inputData.stepRecords, record],
      };
    }

    const reviewer = new GemmaSemanticReviewer();
    if (!reviewer.isConfigured()) {
      const record: WorkflowStepRecord = {
        stepId: "semantic-analysis",
        name: "Gemma Semantic Review",
        status: "omitted",
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 0,
        outputSummary: "Omitted: Gemma endpoint not configured (GEMMA_ENDPOINT)",
        retries: retryCount,
      };
      return {
        ...inputData,
        semanticAnalysis: {
          status: "omitted" as const,
          findings: [],
          eligibleFindingCount: 0,
          gemmaStatus: "not-configured",
        },
        stepRecords: [...inputData.stepRecords, record],
      };
    }

    // Find eligible findings to analyze
    const deterministicFindings = inputData.deterministicScan?.findings || [];
    const eligibleFindings = deterministicFindings.filter(
      (f) => f.ruleId === "AST-ASSERT-WEAKENED" || f.ruleId === "AST-MOCK-SUBSTITUTION" || f.severity === "critical"
    );

    if (eligibleFindings.length === 0) {
      const record: WorkflowStepRecord = {
        stepId: "semantic-analysis",
        name: "Gemma Semantic Review",
        status: "omitted",
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 0,
        outputSummary: "Omitted: no eligible ambiguous or weakened findings",
        retries: retryCount,
      };
      return {
        ...inputData,
        semanticAnalysis: {
          status: "omitted" as const,
          findings: [],
          eligibleFindingCount: 0,
        },
        stepRecords: [...inputData.stepRecords, record],
      };
    }

    try {
      const modelFindings: AuditFinding[] = [];
      const primaryFinding = eligibleFindings[0];

      const reviewResult = await executeWithStepTimeout(
        async () => {
          return reviewer.review({
            ruleId: primaryFinding.ruleId,
            ruleDescription: primaryFinding.summary,
            filePath: primaryFinding.evidence[0]?.filePath || "code.ts",
            diffSnippet: primaryFinding.evidence[0]?.diffHunk || `${primaryFinding.expected} -> ${primaryFinding.actual}`,
            assertionContext: primaryFinding.evidence[0]?.detail,
          });
        },
        timeoutMs,
        "semantic-analysis",
        abortSignal
      );

      if (reviewResult.success && reviewResult.response) {
        modelFindings.push({
          id: `model-gemma-${primaryFinding.ruleId}-${Date.now()}`,
          ruleId: primaryFinding.ruleId,
          title: `[Gemma Advisory] ${reviewResult.response.explanation.slice(0, 80)}`,
          summary: reviewResult.response.weakeningAnalysis || reviewResult.response.explanation,
          severity: reviewResult.response.riskLevel === "high" ? "high" : "medium",
          source: "model-assisted",
          humanAction: "Review suggested edge cases before adding to behavior contract.",
          evidence: primaryFinding.evidence,
          limitations: ["Model advisory is untrusted and cannot dictate final audit status"],
        });
      }

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      const executionStatus: "success" | "failed" = reviewResult.success ? "success" : "failed";
      const record: WorkflowStepRecord = {
        stepId: "semantic-analysis",
        name: "Gemma Semantic Review",
        status: executionStatus,
        startedAt,
        completedAt,
        durationMs,
        outputSummary: reviewResult.success
          ? `Gemma generated advisory analysis (${reviewResult.response?.riskLevel} risk, ${reviewResult.response?.suggestedEdgeCases.length || 0} candidate edge cases)`
          : `Gemma review failed: ${reviewResult.error}`,
        error: reviewResult.error,
        retries: retryCount,
      };

      return {
        ...inputData,
        semanticAnalysis: {
          status: executionStatus,
          findings: modelFindings,
          eligibleFindingCount: eligibleFindings.length,
          error: reviewResult.error,
        },
        stepRecords: [...inputData.stepRecords, record],
      };
    } catch (err: unknown) {
      // Notice: A failed Gemma substep MUST NOT erase confirmed deterministic findings
      const errorMsg = err instanceof Error ? err.message : String(err);
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      const record: WorkflowStepRecord = {
        stepId: "semantic-analysis",
        name: "Gemma Semantic Review",
        status: "failed",
        startedAt,
        completedAt,
        durationMs,
        error: errorMsg,
        retries: retryCount,
      };

      return {
        ...inputData,
        semanticAnalysis: {
          status: "failed" as const,
          findings: [],
          eligibleFindingCount: eligibleFindings.length,
          error: errorMsg,
        },
        stepRecords: [...inputData.stepRecords, record],
      };
    }
  },
});

/**
 * Step 5: Normalize and Validate Final Report
 * Merges all checks, applies strict deterministic status authority, and builds valid AuditReport.
 */
export const normalizeReportStep = createStep({
  id: "normalize-report",
  description: "Aggregates deterministic, replay, and advisory evidence into schema-validated AuditReport",
  inputSchema: AuditPipelineContextSchema,
  outputSchema: AuditPipelineContextSchema,
  retries: 2,
  execute: async ({ inputData, abortSignal, retryCount }) => {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const timeoutMs = inputData.options?.stepTimeoutMs ?? 5000;

    try {
      const report = await executeWithStepTimeout(
        async () => {
          const deterministicFindings = inputData.deterministicScan?.findings || [];
          const replayFindings = inputData.contractReplay?.findings || [];
          const modelFindings = inputData.semanticAnalysis?.findings || [];

          // Strict guarantee: all deterministic findings preserved regardless of model outcomes
          const allFindings: AuditFinding[] = [
            ...deterministicFindings,
            ...replayFindings,
            ...modelFindings,
          ];

          const allChecks = [
            ...(inputData.deterministicScan?.checks || []),
            ...(inputData.contractReplay?.checks || []),
          ];

          // Compute authoritative status: deterministic findings hold absolute veto
          const statusResult = computeAuditStatus({
            findings: allFindings,
            checks: allChecks,
            requiredCheckIds: ["check-diff-parse"],
          });

          const scenarioId = inputData.scenarioId || "custom-diff";
          const reportId = `audit-${scenarioId}-${Date.now()}`;

          const rawReport = {
            id: reportId,
            createdAt: new Date().toISOString(),
            scenarioId,
            status: statusResult.status,
            summary:
              statusResult.status === "BLOCKED"
                ? `Audit BLOCKED: ${allFindings.length} issue(s) detected. ${statusResult.reasons[0] || "Deterministic violation."}`
                : statusResult.status === "REVIEW"
                  ? `Audit REVIEW: ${allFindings.length} review item(s) require inspection. ${statusResult.reasons[0] || "Review advised."}`
                  : "Audit PASS: All configured checks completed with zero blocking findings.",
            limitations: [
              "PASS means configured checks did not detect an issue; it does not prove arbitrary code correct.",
              "Deterministic scan evaluates supported JavaScript/TypeScript and CI YAML syntax patterns.",
              "Contract replay verifies approved baseline behaviors in isolated subprocess.",
              "Model-assisted analysis is advisory only and never alters deterministic status.",
            ],
            findings: allFindings,
            checks: allChecks,
          };

          return AuditReportSchema.parse(rawReport);
        },
        timeoutMs,
        "normalize-report",
        abortSignal
      );

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      const record: WorkflowStepRecord = {
        stepId: "normalize-report",
        name: "Report Normalization & Validation",
        status: "success",
        startedAt,
        completedAt,
        durationMs,
        outputSummary: `Report ${report.id} generated with status ${report.status} (${report.findings.length} findings, ${report.checks.length} checks)`,
        retries: retryCount,
      };

      return {
        ...inputData,
        report,
        stepRecords: [...inputData.stepRecords, record],
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      const record: WorkflowStepRecord = {
        stepId: "normalize-report",
        name: "Report Normalization & Validation",
        status: "failed",
        startedAt,
        completedAt,
        durationMs,
        error: errorMsg,
        retries: retryCount,
      };

      return {
        ...inputData,
        stepRecords: [...inputData.stepRecords, record],
      };
    }
  },
});

/**
 * Step 6: Emit Trace & Telemetry
 * Aggregates workflow performance, executed/succeeded/failed/omitted step metrics, and emits trace.
 */
export const emitTraceStep = createStep({
  id: "emit-trace",
  description: "Emits telemetry trace and metrics for the completed audit run",
  inputSchema: AuditPipelineContextSchema,
  outputSchema: AuditPipelineContextSchema,
  retries: 2,
  execute: async ({ inputData, runId, workflowId, retryCount }) => {
    return await traceAuditStep(
      "Provenance & Trace Emission",
      "audit.step.emit_trace",
      {
        stepName: "emit-trace",
        checkType: "trace_emission",
        scenarioId: inputData.scenarioId,
        runId,
        retries: retryCount,
      },
      async (span) => {
        const startedAt = new Date().toISOString();
        const startTime = Date.now();

        const priorSucceeded = inputData.stepRecords.filter((r) => r.status === "success").length;
        const stepsFailed = inputData.stepRecords.filter((r) => r.status === "failed").length;
        const stepsOmitted = inputData.stepRecords.filter((r) => r.status === "omitted").length;
        const stepsSucceeded = priorSucceeded + 1; // Include emit-trace itself
        const stepsExecuted = stepsSucceeded + stepsFailed;
        const totalDurationMs = Date.now() - inputData.workflowStartTime;

        const sentryCtx = getActiveTraceContext();
        const trace = {
          runId: runId || `run-${Date.now()}`,
          workflowId: workflowId || "greenwash-audit-pipeline",
          totalDurationMs,
          stepsExecuted,
          stepsSucceeded,
          stepsFailed,
          stepsOmitted,
          timestamp: new Date().toISOString(),
          sentryTraceId: sentryCtx.traceId,
          sentrySpanId: sentryCtx.spanId,
          sentryUrl: sentryCtx.sentryUrl,
        };

        if (span && sentryCtx.traceId) {
          span.setAttributes({
            "audit.sentry_trace_id": sentryCtx.traceId,
            "audit.steps_executed": stepsExecuted,
            "audit.steps_succeeded": stepsSucceeded,
            "audit.steps_failed": stepsFailed,
          });
        }

        const completedAt = new Date().toISOString();
        const record: WorkflowStepRecord = {
          stepId: "emit-trace",
          name: "Provenance & Trace Emission",
          status: "success",
          startedAt,
          completedAt,
          durationMs: Date.now() - startTime,
          outputSummary: `Emitted trace: ${trace.stepsExecuted} executed (${trace.stepsSucceeded} succeeded, ${trace.stepsFailed} failed), ${trace.stepsOmitted} omitted in ${totalDurationMs}ms${sentryCtx.traceId ? ` [Sentry Trace: ${sentryCtx.traceId.slice(0, 8)}...]` : ""}`,
          retries: retryCount,
        };

        return {
          ...inputData,
          trace,
          stepRecords: [...inputData.stepRecords, record],
        };
      }
    );
  },
});
