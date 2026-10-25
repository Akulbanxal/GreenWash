# Sentry Agent Tracing & Telemetry Architecture

## Overview
Greenwash instruments its audit workflow executions using `@sentry/node` (v11.x) with OpenTelemetry GenAI semantic conventions. Telemetry tracks workflow invocations and child steps to monitor latency, error rates, and step success/failure states without leaking sensitive intellectual property or secrets.

---

## Architecture & Instrumented Steps

Every audit run wraps the bounded Mastra pipeline in a root `gen_ai.workflow` span, which encloses child spans for individual pipeline steps:

```
[Root Span] invoke_agent greenwash-audit-pipeline (op: gen_ai.workflow)
  ├── 1. Scenario & Diff Validation (op: audit.step.validate)
  ├── 2. Deterministic AST Scan (op: audit.step.ast_scan)
  ├── 3. Protected Contract Replay (op: audit.step.contract_replay)
  ├── 4. Gemma Semantic Review (op: audit.step.gemma_review)
  │      └── Child: Gemma API Request (op: audit.step.gemma_request)
  ├── 5. Report Normalization (op: audit.step.normalize_report)
  │      └── Entire Session Parsing (op: audit.step.entire_data_parsing)
  └── 6. Provenance & Trace Emission (op: audit.step.emit_trace)
         └── Report Persistence (op: audit.step.persistence)
```

---

## Data Protection Invariants

Greenwash enforces strict data boundary and redaction guarantees before any telemetry leaves the process:

1. **Zero Source Code & Diffs**:
   - `diff`, `rawDiff`, `diffSnippet`, `code`, `sourceCode`, `rawCode`, `prompt`, `fullPrompt`, `transcript`, and `fullTranscript` are explicitly prohibited on span attributes and filtered out in `sanitizeTraceAttributes` and `beforeSendSpan`.

2. **Secret Redaction**:
   - High-entropy tokens, API keys (`ghp_`, `sk-`, `AKIA`), JWT tokens, Bearer tokens, and password patterns in string fields or error messages are automatically sanitized with `[REDACTED_SECRET]`.

3. **Bounded Metadata Only**:
   - Permitted span attributes are restricted to:
     - `scenarioId` / `audit.scenario_id`
     - `checkType` / `audit.check_type`
     - `resultStatus` / `audit.result_status` (`PASS`, `BLOCKED`, `REVIEW`)
     - `stepName` / `audit.step_name`
     - `errorCategory` / `audit.error_category` (`SYNTAX_ERROR`, `TIMEOUT`, `PROVIDER_UNAVAILABLE`, `CONTRACT_VIOLATION`, `SCHEMA_VALIDATION_ERROR`)
     - `durationMs`, `retries`, `findingsCount`

---

## Configuration & Environment Placeholders

Configure Sentry in `.env`:

```bash
# Sentry Agent Tracing DSN (Leave blank for local audit with zero external telemetry)
# Format: https://<publicKey>@<host>/<projectId>
SENTRY_DSN=https://<publicKey>@o0.ingest.sentry.io/<projectId>

# Trace Sampling Rate (0.0 to 1.0)
# 1.0 (100%) is recommended for staging/development.
# 0.1 to 0.2 (10-20%) is recommended for high-volume production deployments.
SENTRY_TRACES_SAMPLE_RATE=1.0

# Server Environment
NODE_ENV=production
```

### Unconfigured Behavior
When `SENTRY_DSN` is empty or unset:
- The integration status reports `NOT_CONFIGURED` (displayed as `Not configured` in the UI).
- Local audits run seamlessly without network calls, errors, or delays.
- Diagnostics view displays `No live trace recorded yet`.

---

## Verification & Diagnostics

### 1. Web UI Diagnostics
Navigate to **Integrations** tab:
- **State**: Displays `Configured` when a valid DSN is provided, or `Not configured` when unset.
- **Verify Connection**: Click **Verify Connection** to run a verification span against your Sentry host.
- **Actual Trace Reference**: Once an audit is run, displays the real Sentry Trace ID and a direct link to the Sentry Performance UI.
- **Sample Trace**: An explicitly labeled sample trace is provided for reference and schema inspection.

### 2. HTTP API Diagnostics Endpoints
```bash
# Check current Sentry integration status
curl http://localhost:3001/api/diagnostics/sentry

# Trigger a live verification check
curl -X POST http://localhost:3001/api/diagnostics/sentry/verify
```

### 3. Automated Test Suite
Run Sentry tracing unit and integration tests:
```bash
# Core tracing tests (disabled, invalid config, normal run, errors, redaction)
npx vitest run packages/core/test/sentry-tracing.test.ts

# Web UI diagnostics tests
npx vitest run apps/web/test/SentryDiagnostics.test.tsx

# API diagnostics endpoint tests
npx vitest run apps/api/test/api.test.ts
```
