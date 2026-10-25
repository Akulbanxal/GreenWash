import { createWorkflow } from "@mastra/core/workflows";
import {
  AuditPipelineContext,
  AuditPipelineContextSchema,
  MastraAuditWorkflowResult,
} from "./types.js";
import {
  validateScenarioDiffStep,
  deterministicScanStep,
  contractReplayStep,
  semanticAnalysisStep,
  normalizeReportStep,
  emitTraceStep,
} from "./steps.js";
import { isAllowedScenarioId } from "../fixtures/loader.js";
import { traceAuditWorkflow } from "../sentry/index.js";

/**
 * The canonical Mastra audit pipeline workflow.
 * Composes 6 strictly bounded, typed steps in order:
 * validate-scenario-diff -> deterministic-scan -> contract-replay ->
 * semantic-analysis -> normalize-report -> emit-trace
 */
export const auditPipelineWorkflow = createWorkflow({
  id: "greenwash-audit-pipeline",
  inputSchema: AuditPipelineContextSchema,
  outputSchema: AuditPipelineContextSchema,
})
  .then(validateScenarioDiffStep)
  .then(deterministicScanStep)
  .then(contractReplayStep)
  .then(semanticAnalysisStep)
  .then(normalizeReportStep)
  .then(emitTraceStep)
  .commit();

export interface RunAuditPipelineParams {
  scenarioId?: string;
  diff?: string;
  baseRef?: string;
  options?: {
    enableGemma?: boolean;
    enableEntire?: boolean;
    stepTimeoutMs?: number;
    totalTimeoutMs?: number;
  };
  abortSignal?: AbortSignal;
}

/**
 * Executes the Mastra audit pipeline with bounded overall timeout and cancellation support.
 */
export async function runAuditPipeline(
  params: RunAuditPipelineParams
): Promise<MastraAuditWorkflowResult> {
  const totalTimeoutMs = params.options?.totalTimeoutMs ?? 25000;
  const controller = new AbortController();

  // Combine parent abortSignal with total workflow timeout
  if (params.abortSignal) {
    if (params.abortSignal.aborted) {
      controller.abort(params.abortSignal.reason);
    } else {
      params.abortSignal.addEventListener("abort", () => {
        controller.abort(params.abortSignal?.reason);
      });
    }
  }

  if (controller.signal.aborted) {
    throw new Error(
      `Audit workflow cancelled: ${controller.signal.reason?.message || "Operation aborted"}`
    );
  }

  if (params.scenarioId && !isAllowedScenarioId(params.scenarioId)) {
    throw new Error(
      `Invalid scenario ID: '${params.scenarioId}'. Must be an allow-listed scenario.`
    );
  }

  if (!params.scenarioId && (!params.diff || !params.diff.trim())) {
    throw new Error("Empty diff content. Provide a valid scenarioId or unified diff string.");
  }

  const timer = setTimeout(() => {
    controller.abort(new Error(`Audit workflow timed out after ${totalTimeoutMs}ms`));
  }, totalTimeoutMs);

  let run: any = null;
  const onAbort = () => {
    if (run?.abortController) {
      run.abortController.abort(controller.signal.reason);
    }
  };

  controller.signal.addEventListener("abort", onAbort, { once: true });

  try {
    const inputPayload: AuditPipelineContext = {
      scenarioId: params.scenarioId,
      diff: params.diff,
      baseRef: params.baseRef || "main",
      workflowStartTime: Date.now(),
      options: {
        enableGemma: params.options?.enableGemma ?? true,
        enableEntire: params.options?.enableEntire ?? true,
        stepTimeoutMs: params.options?.stepTimeoutMs ?? 5000,
        totalTimeoutMs,
      },
      stepRecords: [],
    };

    run = await auditPipelineWorkflow.createRun();

    return await traceAuditWorkflow(
      { runId: run.runId, scenarioId: params.scenarioId },
      async () => {
        const result = await run.start({
          inputData: inputPayload,
        });

        if (result.status === "success" && result.result?.report) {
          return {
            runId: run.runId,
            workflowId: "greenwash-audit-pipeline",
            status: "success",
            report: result.result.report,
            stepRecords: result.result.stepRecords || [],
            trace: result.result.trace,
          };
        }

        if (result.status === "failed") {
          const errorMsg = result.error?.message || "Audit workflow failed execution";
          // If report was generated before failure, return it with failed status
          const partialReport = (result as any).result?.report;
          if (partialReport) {
            return {
              runId: run.runId,
              workflowId: "greenwash-audit-pipeline",
              status: "failed",
              report: partialReport,
              stepRecords: (result as any).result?.stepRecords || [],
              trace: (result as any).result?.trace,
              error: errorMsg,
            };
          }
          throw new Error(`Audit workflow failed: ${errorMsg}`);
        }

        throw new Error(`Audit workflow concluded with unexpected status: ${result.status}`);
      }
    );
  } catch (err: unknown) {
    const errorMsg =
      controller.signal.aborted
        ? `Audit workflow cancelled: ${controller.signal.reason?.message || "Operation aborted"}`
        : err instanceof Error
          ? err.message
          : String(err);
    throw new Error(errorMsg);
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", onAbort);
  }
}
