import { z } from "zod";

export const SentryIntegrationStateSchema = z.enum(["CONFIGURED", "NOT_CONFIGURED", "INVALID"]);
export type SentryIntegrationState = z.infer<typeof SentryIntegrationStateSchema>;

export const VerifiedCheckRecordSchema = z.object({
  timestamp: z.string(),
  status: z.enum(["passed", "failed"]),
  message: z.string(),
  traceId: z.string().optional(),
});
export type VerifiedCheckRecord = z.infer<typeof VerifiedCheckRecordSchema>;

export const SentryTraceReferenceSchema = z.object({
  traceId: z.string(),
  spanId: z.string(),
  sentryUrl: z.string().optional(),
  timestamp: z.string(),
  scenarioId: z.string().optional(),
  resultStatus: z.string().optional(),
});
export type SentryTraceReference = z.infer<typeof SentryTraceReferenceSchema>;

export const SentryDiagnosticsStatusSchema = z.object({
  status: SentryIntegrationStateSchema,
  dsnConfigured: z.boolean(),
  dsnHost: z.string().optional(),
  projectId: z.string().optional(),
  environment: z.string(),
  sampleRate: z.number(),
  lastVerifiedCheck: VerifiedCheckRecordSchema.optional(),
  lastTraceReference: SentryTraceReferenceSchema.optional(),
  redactionActive: z.boolean(),
});
export type SentryDiagnosticsStatus = z.infer<typeof SentryDiagnosticsStatusSchema>;

/**
 * Strict bounded metadata allowed on Sentry spans.
 * Raw source code, raw diffs, full prompts, secrets, and full user transcripts are strictly prohibited.
 */
export const BoundedSpanMetadataSchema = z.object({
  scenarioId: z.string().optional(),
  checkType: z.string().optional(),
  resultStatus: z.string().optional(),
  stepName: z.string().optional(),
  errorCategory: z.string().optional(),
  runId: z.string().optional(),
  workflowId: z.string().optional(),
  retries: z.number().optional(),
  findingsCount: z.number().optional(),
  contractId: z.string().optional(),
  reportId: z.string().optional(),
  durationMs: z.number().optional(),
});
export type BoundedSpanMetadata = z.infer<typeof BoundedSpanMetadataSchema>;

export interface SentryInitOptions {
  dsn?: string;
  environment?: string;
  tracesSampleRate?: number;
  release?: string;
}
