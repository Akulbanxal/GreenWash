import { z } from "zod";
import {
  AuditStatusSchema,
  FindingSeveritySchema,
  FindingSourceSchema,
  CheckStatusSchema,
} from "../domain/schemas.js";

/**
 * ============================================================================
 * EXPLICIT PERSISTENCE ALLOW-LIST SCHEMA (MongoDB Atlas & In-Memory Fallback)
 * ============================================================================
 *
 * PRIVACY & DATA BOUNDARY INVARIANTS:
 * 1. Prohibited: Full source files, entire unified diffs, raw file contents.
 * 2. Prohibited: Secrets, passwords, authentication tokens, private keys.
 * 3. Prohibited: Raw agent transcripts or unredacted conversation logs.
 * 4. Permitted: Audit ID, timestamps, scenario/repository label, audit status.
 * 5. Permitted: Finding rule IDs, severities, sources, sanitized evidence summaries.
 * 6. Permitted: Short redacted code excerpt (STRICTLY capped at 200 chars).
 * 7. Permitted: Check statuses and durations.
 * 8. Permitted: Approved contract version metadata and integration trace references.
 */

export const PersistedEvidenceSummarySchema = z.object({
  title: z.string().min(1).max(200),
  detail: z.string().min(1).max(500),
  filePath: z.string().max(300).optional(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  // Strict excerpt cap: max 200 chars, scrubbed of all secret patterns
  redactedExcerpt: z.string().max(200).optional(),
});
export type PersistedEvidenceSummary = z.infer<typeof PersistedEvidenceSummarySchema>;

export const PersistedFindingRecordSchema = z.object({
  id: z.string().min(1).max(100),
  ruleId: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(500),
  severity: FindingSeveritySchema,
  source: FindingSourceSchema,
  humanAction: z.string().min(1).max(500),
  evidence: z.array(PersistedEvidenceSummarySchema).default([]),
});
export type PersistedFindingRecord = z.infer<typeof PersistedFindingRecordSchema>;

export const PersistedCheckRecordSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  status: CheckStatusSchema,
  durationMs: z.number().nonnegative().optional(),
});
export type PersistedCheckRecord = z.infer<typeof PersistedCheckRecordSchema>;

export const ContractMetadataSchema = z.object({
  contractId: z.string().min(1).max(100),
  contractVersion: z.string().min(1).max(50),
  approvedBy: z.string().max(100).optional(),
  approvedAt: z.string().datetime().optional(),
});
export type ContractMetadata = z.infer<typeof ContractMetadataSchema>;

export const TraceReferencePersistenceSchema = z.object({
  traceId: z.string().min(1).max(128),
  spanId: z.string().max(64).optional(),
  provider: z.literal("sentry").default("sentry"),
  timestamp: z.string().datetime(),
});
export type TraceReferencePersistence = z.infer<typeof TraceReferencePersistenceSchema>;

export const CURRENT_PERSISTENCE_SCHEMA_VERSION = 1;

export const PersistedAuditRecordSchema = z.object({
  _id: z.string().min(1).max(128), // Unique MongoDB _id (audit ID)
  id: z.string().min(1).max(128),  // Friendly alias
  schemaVersion: z.number().int().min(1).default(CURRENT_PERSISTENCE_SCHEMA_VERSION),
  createdAt: z.string().datetime(),
  storedAt: z.string().datetime(),
  scenarioId: z.string().max(100).optional(),
  repositoryLabel: z.string().max(200).optional(),
  status: AuditStatusSchema,
  summary: z.string().min(1).max(500),
  findings: z.array(PersistedFindingRecordSchema),
  checks: z.array(PersistedCheckRecordSchema),
  contractMetadata: ContractMetadataSchema.optional(),
  traceReference: TraceReferencePersistenceSchema.optional(),
  isSample: z.boolean().default(false),
});
export type PersistedAuditRecord = z.infer<typeof PersistedAuditRecordSchema>;

/**
 * Migration helper to ensure backwards compatibility across schema version iterations.
 */
export function migrateAndValidateRecord(raw: unknown): PersistedAuditRecord {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid DB record: document must be an object");
  }

  const doc = { ...(raw as Record<string, unknown>) };

  // Ensure _id and id are aligned
  if (!doc._id && typeof doc.id === "string") {
    doc._id = doc.id;
  }
  if (!doc.id && typeof doc._id === "string") {
    doc.id = doc._id;
  }

  // Schema version defaulting / migration
  const version = typeof doc.schemaVersion === "number" ? doc.schemaVersion : 1;
  doc.schemaVersion = version;

  if (!doc.storedAt && typeof doc.createdAt === "string") {
    doc.storedAt = doc.createdAt;
  }

  // Parse and validate strictly against allow-list schema
  return PersistedAuditRecordSchema.parse(doc);
}
