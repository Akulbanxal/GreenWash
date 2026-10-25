import {
  AuditStatus,
  AuditFinding,
  AuditCheck,
  AuditReport,
} from "./schemas.js";

export interface StatusComputationInput {
  findings: AuditFinding[];
  checks: AuditCheck[];
  requiredCheckIds?: string[];
}

export interface StatusComputationResult {
  status: AuditStatus;
  reasons: string[];
}

/**
 * Computes the overall audit status based on central authority rules:
 * 1. BLOCKED:
 *    - Any reproducible contract replay failure.
 *    - Any configured deterministic blocking rule (e.g. critical/high static-rule findings).
 * 2. REVIEW:
 *    - Ambiguous static signals, suspicious mocking, or provenance patterns.
 *    - Model-assisted findings (Gemma) pointing to risks without deterministic confirmation.
 *    - Any required check that produced a warning or could not run.
 * 3. PASS:
 *    - All required configured checks ran completely and passed.
 *    - No blocking findings, no review-level findings.
 *
 * CRITICAL POLICY:
 * - A model-assisted result can ADD findings/explanations, but CANNOT downgrade
 *   or remove a deterministic BLOCKED or REVIEW finding.
 * - Missing or un-run checks must never be silently counted as a PASS.
 */
export function computeAuditStatus(
  input: StatusComputationInput
): StatusComputationResult {
  const reasons: string[] = [];

  // Check 1: Deterministic blocking findings or contract-replay violations
  const blockingFindings = input.findings.filter((f) => {
    if (f.source === "contract-replay") {
      return true;
    }
    if (
      f.source === "static-rule" &&
      (f.severity === "critical" || f.severity === "high")
    ) {
      return true;
    }
    return false;
  });

  if (blockingFindings.length > 0) {
    blockingFindings.forEach((f) => {
      reasons.push(`[BLOCKED] ${f.title} (${f.source} - ${f.ruleId})`);
    });
    return {
      status: "BLOCKED",
      reasons,
    };
  }

  // Check 2: Failed checks
  const failedChecks = input.checks.filter((c) => c.status === "failed");
  if (failedChecks.length > 0) {
    failedChecks.forEach((c) => {
      reasons.push(`[BLOCKED] Check failed: ${c.label}`);
    });
    return {
      status: "BLOCKED",
      reasons,
    };
  }

  // Check 3: Review-level findings (model-assisted, provenance, lower severity static-rule)
  const reviewFindings = input.findings.filter((f) => {
    return (
      f.source === "model-assisted" ||
      f.source === "agent-provenance" ||
      (f.source === "static-rule" &&
        (f.severity === "medium" || f.severity === "low"))
    );
  });

  if (reviewFindings.length > 0) {
    reviewFindings.forEach((f) => {
      reasons.push(`[REVIEW] ${f.title} (${f.source} - ${f.ruleId})`);
    });
  }

  // Check 4: Incomplete or warning checks
  const warningOrNotRunChecks = input.checks.filter(
    (c) => c.status === "warning" || c.status === "not-run"
  );

  if (warningOrNotRunChecks.length > 0) {
    warningOrNotRunChecks.forEach((c) => {
      reasons.push(`[REVIEW] Check incomplete: ${c.label} (${c.status})`);
    });
  }

  // Check 5: Required checks presence
  if (input.requiredCheckIds && input.requiredCheckIds.length > 0) {
    const executedCheckIds = new Set(
      input.checks.filter((c) => c.status === "passed").map((c) => c.id)
    );
    for (const reqId of input.requiredCheckIds) {
      if (!executedCheckIds.has(reqId)) {
        reasons.push(`[REVIEW] Required check did not complete: ${reqId}`);
      }
    }
  }

  if (reasons.length > 0) {
    return {
      status: "REVIEW",
      reasons,
    };
  }

  // All checks satisfied and zero findings
  return {
    status: "PASS",
    reasons: ["All configured checks completed and passed without blocking issues."],
  };
}
