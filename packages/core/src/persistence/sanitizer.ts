import { AuditReport, BehaviorContract, TraceReference } from "../domain/schemas.js";
import { redactSecrets } from "../provenance/EntireSessionProvider.js";
import {
  PersistedAuditRecord,
  PersistedAuditRecordSchema,
  CURRENT_PERSISTENCE_SCHEMA_VERSION,
} from "./schema.js";

export interface SanitizeAuditOptions {
  contract?: BehaviorContract;
  repositoryLabel?: string;
  scenarioId?: string;
  trace?: TraceReference;
  isSample?: boolean;
}

/**
 * Sanitizes an AuditReport for secure MongoDB Atlas or in-memory persistence.
 *
 * ENFORCES STRICT PRIVACY & DATA BOUNDARY ALLOW-LIST:
 * - Drops full source files, entire unified diffs, and raw transcripts.
 * - Extracts only short, redacted excerpts capped at 200 characters.
 * - Scrubs secrets, passwords, tokens, API keys using redactSecrets.
 * - Validates schema invariants before returning.
 */
export function sanitizeAuditForPersistence(
  report: AuditReport,
  options?: SanitizeAuditOptions
): PersistedAuditRecord {
  const storedAt = new Date().toISOString();

  // 1. Sanitize Findings
  const sanitizedFindings = report.findings.map((f) => {
    const sanitizedEvidence = f.evidence.map((e) => {
      // Pick at most 200 characters from snippet/diff, scrubbing all secret tokens
      let rawExcerpt: string | undefined = undefined;
      if (e.afterSnippet) {
        rawExcerpt = e.afterSnippet;
      } else if (e.beforeSnippet) {
        rawExcerpt = e.beforeSnippet;
      } else if (e.diffHunk) {
        rawExcerpt = e.diffHunk;
      }

      let redactedExcerpt: string | undefined = undefined;
      if (rawExcerpt) {
        const singleLine = rawExcerpt.trim().replace(/\s+/g, " ");
        redactedExcerpt = redactSecrets(singleLine).slice(0, 200);
      }

      return {
        title: redactSecrets(e.title).slice(0, 200),
        detail: redactSecrets(e.detail).slice(0, 500),
        filePath: e.filePath ? redactSecrets(e.filePath).slice(0, 300) : undefined,
        startLine: e.startLine,
        endLine: e.endLine,
        redactedExcerpt,
      };
    });

    return {
      id: f.id.slice(0, 100),
      ruleId: f.ruleId.slice(0, 100),
      title: redactSecrets(f.title).slice(0, 200),
      summary: redactSecrets(f.summary).slice(0, 500),
      severity: f.severity,
      source: f.source,
      humanAction: redactSecrets(f.humanAction).slice(0, 500),
      evidence: sanitizedEvidence,
    };
  });

  // 2. Sanitize Checks
  const sanitizedChecks = report.checks.map((c) => ({
    id: c.id.slice(0, 100),
    label: redactSecrets(c.label).slice(0, 200),
    status: c.status,
    durationMs: c.durationMs,
  }));

  // 3. Contract Metadata (if available)
  let contractMetadata: PersistedAuditRecord["contractMetadata"] = undefined;
  if (options?.contract) {
    contractMetadata = {
      contractId: options.contract.id.slice(0, 100),
      contractVersion: options.contract.version.slice(0, 50),
      approvedBy: options.contract.approvedBy
        ? redactSecrets(options.contract.approvedBy).slice(0, 100)
        : undefined,
      approvedAt: options.contract.approvedAt,
    };
  }

  // 4. Trace Reference (if available)
  let traceReference: PersistedAuditRecord["traceReference"] = undefined;
  if (options?.trace) {
    traceReference = {
      traceId: options.trace.traceId.slice(0, 128),
      spanId: options.trace.spanId ? options.trace.spanId.slice(0, 64) : undefined,
      provider: "sentry",
      timestamp: options.trace.timestamp,
    };
  } else if (report.traceId) {
    traceReference = {
      traceId: report.traceId.slice(0, 128),
      provider: "sentry",
      timestamp: report.createdAt,
    };
  }

  // 5. Construct Record conforming strictly to allow-list
  const candidateRecord = {
    _id: report.id.slice(0, 128),
    id: report.id.slice(0, 128),
    schemaVersion: CURRENT_PERSISTENCE_SCHEMA_VERSION,
    createdAt: report.createdAt,
    storedAt,
    scenarioId: options?.scenarioId
      ? options.scenarioId.slice(0, 100)
      : report.scenarioId
        ? report.scenarioId.slice(0, 100)
        : undefined,
    repositoryLabel: options?.repositoryLabel
      ? redactSecrets(options.repositoryLabel).slice(0, 200)
      : report.baseRef
        ? `repo/${report.baseRef.slice(0, 100)}`
        : undefined,
    status: report.status,
    summary: redactSecrets(report.summary).slice(0, 500),
    findings: sanitizedFindings,
    checks: sanitizedChecks,
    contractMetadata,
    traceReference,
    isSample: Boolean(options?.isSample),
  };

  // Validate before returning
  return PersistedAuditRecordSchema.parse(candidateRecord);
}
