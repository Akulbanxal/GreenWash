import { z } from "zod";
import {
  AuditCheckSchema,
  AuditFindingSchema,
  AuditReportSchema,
  AuditStatusSchema,
} from "../domain/schemas.js";

export const StepExecutionStatusSchema = z.enum(["success", "failed", "omitted", "running"]);
export type StepExecutionStatus = z.infer<typeof StepExecutionStatusSchema>;

export const WorkflowStepRecordSchema = z.object({
  stepId: z.string(),
  name: z.string(),
  status: StepExecutionStatusSchema,
  startedAt: z.string(),
  completedAt: z.string(),
  durationMs: z.number(),
  outputSummary: z.string().optional(),
  error: z.string().optional(),
  retries: z.number().default(0),
});
export type WorkflowStepRecord = z.infer<typeof WorkflowStepRecordSchema>;

export const WorkflowTraceSchema = z.object({
  runId: z.string(),
  workflowId: z.string(),
  totalDurationMs: z.number(),
  stepsExecuted: z.number(),
  stepsSucceeded: z.number(),
  stepsFailed: z.number(),
  stepsOmitted: z.number(),
  timestamp: z.string(),
  sentryTraceId: z.string().optional(),
  sentrySpanId: z.string().optional(),
  sentryUrl: z.string().optional(),
});
export type WorkflowTrace = z.infer<typeof WorkflowTraceSchema>;

export const AuditPipelineOptionsSchema = z.object({
  enableGemma: z.boolean().default(true),
  enableEntire: z.boolean().default(true),
  stepTimeoutMs: z.number().default(5000),
  totalTimeoutMs: z.number().default(25000),
});
export type AuditPipelineOptions = z.infer<typeof AuditPipelineOptionsSchema>;

/**
 * Shared context accumulator carried across all Mastra steps
 */
export const AuditPipelineContextSchema = z.object({
  scenarioId: z.string().optional(),
  diff: z.string().optional(),
  baseRef: z.string().default("main"),
  workflowStartTime: z.number().default(() => Date.now()),
  options: AuditPipelineOptionsSchema.default({}),

  validation: z
    .object({
      status: StepExecutionStatusSchema,
      scenarioId: z.string().optional(),
      diff: z.string().optional(),
      error: z.string().optional(),
    })
    .optional(),

  deterministicScan: z
    .object({
      status: StepExecutionStatusSchema,
      findings: z.array(AuditFindingSchema).default([]),
      checks: z.array(AuditCheckSchema).default([]),
      error: z.string().optional(),
    })
    .optional(),

  contractReplay: z
    .object({
      status: StepExecutionStatusSchema,
      findings: z.array(AuditFindingSchema).default([]),
      checks: z.array(AuditCheckSchema).default([]),
      contractId: z.string().optional(),
      error: z.string().optional(),
    })
    .optional(),

  semanticAnalysis: z
    .object({
      status: StepExecutionStatusSchema,
      findings: z.array(AuditFindingSchema).default([]),
      eligibleFindingCount: z.number().default(0),
      gemmaStatus: z.string().optional(),
      error: z.string().optional(),
    })
    .optional(),

  report: AuditReportSchema.optional(),
  stepRecords: z.array(WorkflowStepRecordSchema).default([]),
  trace: WorkflowTraceSchema.optional(),
});
export type AuditPipelineContext = z.infer<typeof AuditPipelineContextSchema>;

export interface MastraAuditWorkflowResult {
  runId: string;
  workflowId: string;
  status: "success" | "failed";
  report: z.infer<typeof AuditReportSchema>;
  stepRecords: WorkflowStepRecord[];
  trace?: WorkflowTrace;
  error?: string;
}
