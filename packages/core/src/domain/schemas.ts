import { z } from "zod";

// ==========================================
// 1. Core Status & Classification Enums
// ==========================================

export const AuditStatusSchema = z.enum(["PASS", "REVIEW", "BLOCKED"]);
export type AuditStatus = z.infer<typeof AuditStatusSchema>;

export const FindingSeveritySchema = z.enum([
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const FindingSourceSchema = z.enum([
  "static-rule",
  "contract-replay",
  "model-assisted",
  "agent-provenance",
]);
export type FindingSource = z.infer<typeof FindingSourceSchema>;

export const CheckStatusSchema = z.enum([
  "passed",
  "failed",
  "warning",
  "not-run",
]);
export type CheckStatus = z.infer<typeof CheckStatusSchema>;

export const IntegrationStateSchema = z.enum([
  "verified",
  "configured-not-verified",
  "not-configured",
  "failed",
  "sample-only",
]);
export type IntegrationState = z.infer<typeof IntegrationStateSchema>;

// ==========================================
// 2. Evidence & Findings
// ==========================================

export const EvidenceReferenceSchema = z.object({
  filePath: z.string().optional(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  title: z.string().min(1),
  detail: z.string().min(1),
  beforeSnippet: z.string().optional(),
  afterSnippet: z.string().optional(),
  diffHunk: z.string().optional(),
});
export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;

export const AuditFindingSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  severity: FindingSeveritySchema,
  source: FindingSourceSchema,
  evidence: z.array(EvidenceReferenceSchema),
  expected: z.unknown().optional(),
  actual: z.unknown().optional(),
  reproductionCommand: z.string().optional(),
  humanAction: z.string().min(1),
  limitations: z.array(z.string()).default([]),
});
export type AuditFinding = z.infer<typeof AuditFindingSchema>;

// ==========================================
// 3. Checks & Report
// ==========================================

export const AuditCheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: CheckStatusSchema,
  detail: z.string().min(1),
  durationMs: z.number().nonnegative().optional(),
});
export type AuditCheck = z.infer<typeof AuditCheckSchema>;

export const AuditReportSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  scenarioId: z.string().optional(),
  baseRef: z.string().optional(),
  status: AuditStatusSchema,
  summary: z.string().min(1),
  limitations: z.array(z.string()).min(1),
  findings: z.array(AuditFindingSchema),
  checks: z.array(AuditCheckSchema),
  traceId: z.string().optional(),
});
export type AuditReport = z.infer<typeof AuditReportSchema>;

// ==========================================
// 4. Scenarios & Contracts
// ==========================================

export const ContractCaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  input: z.unknown(),
  expected: z.unknown(),
  tolerance: z.number().optional(),
});
export type ContractCase = z.infer<typeof ContractCaseSchema>;

export const BehaviorContractSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1),
  targetFile: z.string().min(1),
  targetFunction: z.string().min(1),
  cases: z.array(ContractCaseSchema).min(1),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
});
export type BehaviorContract = z.infer<typeof BehaviorContractSchema>;

export const ScenarioDefinitionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  threatCategory: z.string().min(1),
  expectedOutcome: AuditStatusSchema,
  expectedRuleIds: z.array(z.string()),
  contractId: z.string().optional(),
  fixturePath: z.string().min(1),
  diffPath: z.string().min(1),
});
export type ScenarioDefinition = z.infer<typeof ScenarioDefinitionSchema>;

export const ScenarioRunResultSchema = z.object({
  scenarioId: z.string().min(1),
  report: AuditReportSchema,
  executionTimeMs: z.number().nonnegative(),
});
export type ScenarioRunResult = z.infer<typeof ScenarioRunResultSchema>;

// ==========================================
// 5. Provenance & Observability
// ==========================================

export const SessionEventTypeSchema = z.enum([
  "prompt",
  "tool_execution",
  "file_edit",
  "test_run",
  "checkpoint",
  "commit",
]);
export type SessionEventType = z.infer<typeof SessionEventTypeSchema>;

export const SessionEventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().datetime(),
  type: SessionEventTypeSchema,
  source: z.string().min(1),
  summary: z.string().min(1),
  details: z.record(z.unknown()).optional(),
  targetFile: z.string().optional(),
  linesChanged: z.array(z.number().int()).optional(),
  diffSnippet: z.string().optional(),
  command: z.string().optional(),
  testOutcome: z.enum(["passed", "failed", "skipped"]).optional(),
  checkpointId: z.string().optional(),
  commitHash: z.string().optional(),
  isFlagged: z.boolean().default(false),
  flagReason: z.string().optional(),
});
export type SessionEvent = z.infer<typeof SessionEventSchema>;

export const IntegrationStatusSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  state: IntegrationStateSchema,
  message: z.string().min(1),
  lastVerifiedAt: z.string().datetime().optional(),
  documentationUrl: z.string().url().optional(),
});
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;

export const TraceReferenceSchema = z.object({
  traceId: z.string().min(1),
  spanId: z.string().optional(),
  provider: z.literal("sentry"),
  timestamp: z.string().datetime(),
});
export type TraceReference = z.infer<typeof TraceReferenceSchema>;

// ==========================================
// 6. Sanitized Persisted History
// ==========================================

export const PersistedFindingSummarySchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  severity: FindingSeveritySchema,
  source: FindingSourceSchema,
  title: z.string().min(1),
});
export type PersistedFindingSummary = z.infer<typeof PersistedFindingSummarySchema>;

export const AuditSummarySchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  scenarioId: z.string().optional(),
  status: AuditStatusSchema,
  findingsCount: z.number().int().nonnegative(),
  findings: z.array(PersistedFindingSummarySchema),
  checksSummary: z.record(CheckStatusSchema, z.number().int().nonnegative()),
  contractVersion: z.string().optional(),
  traceId: z.string().optional(),
  isSample: z.boolean().default(false),
});
export type AuditSummary = z.infer<typeof AuditSummarySchema>;
