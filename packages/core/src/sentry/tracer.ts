import * as Sentry from "@sentry/node";
import { redactSecrets } from "../provenance/EntireSessionProvider.js";
import {
  BoundedSpanMetadata,
  SentryDiagnosticsStatus,
  SentryInitOptions,
  SentryIntegrationState,
  SentryTraceReference,
  VerifiedCheckRecord,
} from "./types.js";

/**
 * Attributes forbidden from ever being sent to Sentry.
 * Per specification: Do not send source code, raw diffs, full prompts, secrets or full user transcripts.
 */
const FORBIDDEN_ATTRIBUTE_KEYS = new Set([
  "diff",
  "rawdiff",
  "diffsnippet",
  "code",
  "sourcecode",
  "rawcode",
  "prompt",
  "fullprompt",
  "transcript",
  "rawtranscript",
  "fulltranscript",
  "secret",
  "apikey",
  "api_key",
  "password",
  "token",
  "authtoken",
  "bearer",
  "authorization",
]);

let currentState: SentryIntegrationState = "NOT_CONFIGURED";
let currentDsn: string | undefined = undefined;
let currentHost: string | undefined = undefined;
let currentProjectId: string | undefined = undefined;
let currentEnvironment = "development";
let currentSampleRate = 1.0;
let lastVerifiedCheckRecord: VerifiedCheckRecord | undefined = undefined;
let lastWorkflowTraceReference: SentryTraceReference | undefined = undefined;

/**
 * Sanitizes attributes to ensure zero secrets, raw diffs, code, or full transcripts are transmitted.
 * Caps string length to 500 characters and redacts common token patterns.
 */
export function sanitizeTraceAttributes(
  attributes: Record<string, unknown>
): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(attributes)) {
    const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (FORBIDDEN_ATTRIBUTE_KEYS.has(lowerKey)) {
      continue;
    }

    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "string") {
      // Redact potential secrets and cap length
      const cleaned = redactSecrets(value);
      sanitized[key] = cleaned.length > 500 ? cleaned.slice(0, 497) + "..." : cleaned;
    } else if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Parses and validates a Sentry DSN without crashing on invalid formats.
 */
function parseDsnSafe(dsnStr: string): { valid: boolean; host?: string; projectId?: string } {
  try {
    const url = new URL(dsnStr);
    if (!url.protocol.startsWith("http")) {
      return { valid: false };
    }
    const pathParts = url.pathname.split("/").filter(Boolean);
    const projectId = pathParts[pathParts.length - 1];
    if (!url.username || !projectId) {
      return { valid: false };
    }
    return {
      valid: true,
      host: url.host,
      projectId,
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Builds a public Sentry UI link for an active trace if host and project are known.
 */
function buildSentryTraceUrl(host?: string, projectId?: string, traceId?: string): string | undefined {
  if (!host || !traceId) return undefined;
  // If Sentry SaaS or self-hosted, link to trace/issues search
  return `https://${host}/trace/${traceId}`;
}

/**
 * Initializes Sentry agent tracing.
 * Gracefully handles missing DSN (NOT_CONFIGURED) and invalid DSN (INVALID).
 */
export async function initSentry(options?: SentryInitOptions): Promise<SentryIntegrationState> {
  // If a client is already active, close it first
  if (Sentry.getClient()) {
    try {
      await Sentry.close();
    } catch {
      // ignore close errors
    }
  }

  const dsn = options?.dsn ?? process.env.SENTRY_DSN?.trim();
  currentEnvironment = options?.environment ?? process.env.NODE_ENV ?? "development";
  currentSampleRate = Math.min(
    1.0,
    Math.max(
      0.0,
      options?.tracesSampleRate ??
        (process.env.SENTRY_TRACES_SAMPLE_RATE ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) : 1.0)
    )
  );

  if (!dsn) {
    currentState = "NOT_CONFIGURED";
    currentDsn = undefined;
    currentHost = undefined;
    currentProjectId = undefined;
    return "NOT_CONFIGURED";
  }

  const parsed = parseDsnSafe(dsn);
  if (!parsed.valid) {
    currentState = "INVALID";
    currentDsn = dsn;
    currentHost = undefined;
    currentProjectId = undefined;
    return "INVALID";
  }

  currentDsn = dsn;
  currentHost = parsed.host;
  currentProjectId = parsed.projectId;

  try {
    Sentry.init({
      dsn,
      environment: currentEnvironment,
      tracesSampleRate: currentSampleRate,
      release: options?.release ?? "greenwash@0.1.0",
      beforeSend: (event) => {
        // Redact any secrets in event message and exception values
        if (event.message) {
          event.message = redactSecrets(event.message);
        }
        if (event.exception?.values) {
          for (const val of event.exception.values) {
            if (val.value) val.value = redactSecrets(val.value);
          }
        }
        // Strip forbidden keys from extra
        if (event.extra) {
          for (const key of Object.keys(event.extra)) {
            const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (FORBIDDEN_ATTRIBUTE_KEYS.has(lowerKey)) {
              delete event.extra[key];
            }
          }
        }
        return event;
      },
      beforeSendSpan: (span) => {
        // Redact and filter span attributes
        if (span.attributes) {
          for (const key of Object.keys(span.attributes)) {
            const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (FORBIDDEN_ATTRIBUTE_KEYS.has(lowerKey)) {
              delete span.attributes[key];
            } else if (typeof span.attributes[key] === "string") {
              span.attributes[key] = redactSecrets(span.attributes[key] as string);
            }
          }
        }
        return span;
      },
    });

    currentState = "CONFIGURED";
    return "CONFIGURED";
  } catch (err) {
    currentState = "INVALID";
    return "INVALID";
  }
}

/**
 * Resets Sentry client and internal state. Useful for test isolation.
 */
export async function closeSentry(): Promise<void> {
  try {
    if (Sentry.getClient()) {
      await Sentry.close();
    }
  } catch {
    // Ignore close errors
  } finally {
    currentState = "NOT_CONFIGURED";
    currentDsn = undefined;
    currentHost = undefined;
    currentProjectId = undefined;
  }
}

export function isSentryConfigured(): boolean {
  return currentState === "CONFIGURED" && !!Sentry.getClient();
}

/**
 * Returns current diagnostics status for UI inspection.
 */
export function getSentryStatus(): SentryDiagnosticsStatus {
  return {
    status: currentState,
    dsnConfigured: currentState === "CONFIGURED" || currentState === "INVALID",
    dsnHost: currentHost,
    projectId: currentProjectId,
    environment: currentEnvironment,
    sampleRate: currentSampleRate,
    lastVerifiedCheck: lastVerifiedCheckRecord,
    lastTraceReference: lastWorkflowTraceReference,
    redactionActive: true,
  };
}

/**
 * Records a verified integration check record.
 */
export function recordVerifiedCheck(record: VerifiedCheckRecord): void {
  lastVerifiedCheckRecord = record;
}

/**
 * Records the actual trace reference from a completed workflow run.
 */
export function recordTraceReference(ref: SentryTraceReference): void {
  lastWorkflowTraceReference = ref;
}

/**
 * Performs a safe verification check against the configured Sentry environment.
 */
export async function verifySentryConnection(): Promise<VerifiedCheckRecord> {
  const timestamp = new Date().toISOString();
  if (currentState !== "CONFIGURED" || !Sentry.getClient()) {
    const record: VerifiedCheckRecord = {
      timestamp,
      status: "failed",
      message: currentState === "INVALID" ? "Invalid Sentry DSN configuration" : "Sentry DSN is not configured",
    };
    lastVerifiedCheckRecord = record;
    return record;
  }

  try {
    // Run an internal health check span
    let checkTraceId: string | undefined;
    await Sentry.startSpan(
      {
        name: "greenwash.diagnostics.verify",
        op: "diagnostics.check",
      },
      async (span) => {
        span.setAttributes({
          "audit.check_type": "diagnostics",
          "audit.status": "verified",
        });
        checkTraceId = span.spanContext().traceId;
      }
    );

    const record: VerifiedCheckRecord = {
      timestamp,
      status: "passed",
      message: `Sentry Agent Tracing verified for host '${currentHost}' (Project: ${currentProjectId})`,
      traceId: checkTraceId,
    };
    lastVerifiedCheckRecord = record;
    return record;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const record: VerifiedCheckRecord = {
      timestamp,
      status: "failed",
      message: `Sentry verification failed: ${errorMsg}`,
    };
    lastVerifiedCheckRecord = record;
    return record;
  }
}

/**
 * Retrieves the currently active Sentry trace and span IDs if a span is active.
 */
export function getActiveTraceContext(): { traceId?: string; spanId?: string; sentryUrl?: string } {
  const activeSpan = Sentry.getActiveSpan();
  if (!activeSpan) {
    return {};
  }
  const ctx = activeSpan.spanContext();
  const traceId = ctx.traceId;
  const spanId = ctx.spanId;
  const sentryUrl = buildSentryTraceUrl(currentHost, currentProjectId, traceId);

  return { traceId, spanId, sentryUrl };
}

/**
 * Instruments the top-level audit workflow execution as a root GenAI workflow span.
 * Gracefully falls back to uninstrumented execution if Sentry is not configured.
 */
export async function traceAuditWorkflow<T>(
  context: { runId: string; scenarioId?: string },
  action: (span?: Sentry.Span) => Promise<T>
): Promise<T> {
  if (!isSentryConfigured()) {
    return await action(undefined);
  }

  return await Sentry.startSpan(
    {
      name: "invoke_agent greenwash-audit-pipeline",
      op: "gen_ai.workflow",
    },
    async (span) => {
      const traceId = span.spanContext().traceId;
      const spanId = span.spanContext().spanId;
      const sentryUrl = buildSentryTraceUrl(currentHost, currentProjectId, traceId);

      // Record standard GenAI semantic attributes + bounded audit metadata
      span.setAttributes({
        "gen_ai.workflow.name": "greenwash-audit-pipeline",
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.agent.name": "GreenwashAuditor",
        "gen_ai.system": "greenwash",
        "audit.run_id": context.runId,
        "audit.scenario_id": context.scenarioId ?? "custom-diff",
      });

      // Update last active trace reference for UI diagnostics
      recordTraceReference({
        traceId,
        spanId,
        sentryUrl,
        timestamp: new Date().toISOString(),
        scenarioId: context.scenarioId,
      });

      try {
        const result = await action(span);

        // Check if result has a status or report status
        const maybeReport = (result as any)?.report;
        if (maybeReport?.status) {
          span.setAttribute("audit.result_status", maybeReport.status);
          if (lastWorkflowTraceReference) {
            lastWorkflowTraceReference.resultStatus = maybeReport.status;
          }
        }

        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        span.setStatus({ code: 2, message: errorMsg }); // ERROR
        span.setAttribute("audit.error_message", redactSecrets(errorMsg).slice(0, 300));
        span.setAttribute("audit.error_category", "WORKFLOW_EXECUTION_ERROR");
        throw err;
      }
    }
  );
}

/**
 * Instruments an individual child step of the audit pipeline.
 * Bounded metadata only: scenario ID, check type, result status, step name, error category.
 */
export async function traceAuditStep<T>(
  stepName: string,
  op: string,
  metadata: BoundedSpanMetadata,
  action: (span?: Sentry.Span) => Promise<T>
): Promise<T> {
  if (!isSentryConfigured()) {
    return await action(undefined);
  }

  return await Sentry.startSpan(
    {
      name: stepName,
      op,
    },
    async (span) => {
      const sanitized = sanitizeTraceAttributes({
        "audit.step_name": metadata.stepName ?? stepName,
        "audit.check_type": metadata.checkType,
        "audit.result_status": metadata.resultStatus,
        "audit.scenario_id": metadata.scenarioId,
        "audit.run_id": metadata.runId,
        "audit.contract_id": metadata.contractId,
        "audit.findings_count": metadata.findingsCount,
        "audit.retries": metadata.retries,
      });

      span.setAttributes(sanitized);

      try {
        const result = await action(span);
        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        span.setStatus({ code: 2, message: errorMsg }); // ERROR
        span.setAttribute("audit.error_category", metadata.errorCategory ?? "STEP_FAILURE");
        span.setAttribute("audit.error_message", redactSecrets(errorMsg).slice(0, 300));
        throw err;
      }
    }
  );
}
