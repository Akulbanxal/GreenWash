import {
  AuditReport,
  MastraAuditWorkflowResult,
  WorkflowStepRecord,
  WorkflowTrace,
  SentryDiagnosticsStatus,
  VerifiedCheckRecord,
  BehaviorContract,
} from "@greenwash/core/dist/browser.js";

export interface ScenarioItem {
  id: string;
  title: string;
  description: string;
  threatCategory: string;
  expectedOutcome: string;
  expectedRuleIds: string[];
  contractId?: string;
  fixturePath: string;
  diffPath: string;
}

export async function fetchScenarios(): Promise<ScenarioItem[]> {
  const res = await fetch("/api/scenarios");
  if (!res.ok) {
    throw new Error(`Failed to load scenarios: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchScenarioDiff(scenarioId: string): Promise<string> {
  const res = await fetch(`/api/scenarios/${scenarioId}/diff`);
  if (!res.ok) {
    throw new Error(`Failed to load scenario diff: ${res.statusText}`);
  }
  return res.text();
}

export interface DemoAuditApiResponse extends AuditReport {
  runId?: string;
  workflowId?: string;
  stepRecords?: WorkflowStepRecord[];
  trace?: WorkflowTrace;
}

export async function runDemoAudit(scenarioId: string): Promise<DemoAuditApiResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s client timeout for cold starts

  try {
    const res = await fetch("/api/audits/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(errorBody.error || `Audit request failed: ${res.statusText}`);
    }

    return res.json();
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Audit request timed out after 35 seconds. The server was waking up, please retry.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface PipelineApiOptions {
  enableGemma?: boolean;
  enableEntire?: boolean;
  stepTimeoutMs?: number;
  totalTimeoutMs?: number;
}

export async function runAuditPipelineApi(params: {
  scenarioId?: string;
  diff?: string;
  baseRef?: string;
  options?: PipelineApiOptions;
}): Promise<MastraAuditWorkflowResult> {
  const controller = new AbortController();
  const timeoutMs = (params.options?.totalTimeoutMs ?? 25000) + 2000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("/api/audits/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(errorBody.error || `Pipeline request failed: ${res.statusText}`);
    }

    return res.json();
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Pipeline request timed out after ${timeoutMs}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchContracts(): Promise<any[]> {
  const res = await fetch("/api/contracts");
  if (!res.ok) {
    throw new Error(`Failed to load contracts: ${res.statusText}`);
  }
  return res.json();
}

export async function reviewUpdateContract(
  contract: any,
  reviewerToken: string,
  reviewNotes?: string
): Promise<{ success: boolean; contractId: string; version: string; reviewedBy: string; reviewNotes: string }> {
  const res = await fetch("/api/contracts/review-update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contract, reviewerToken, reviewNotes }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to review contract update: ${res.statusText}`);
  }
  return res.json();
}

export interface SynthesizeContractParams {
  taskDescription: string;
  targetFile: string;
  targetFunction: string;
  sourceCode?: string;
  testCode?: string;
  contractId?: string;
  author?: string;
}

export interface SynthesizeContractResponse {
  contract: BehaviorContract;
  method: "heuristic" | "model-assisted";
  caseCount: number;
  warnings?: string[];
}

export async function synthesizeContractApi(
  params: SynthesizeContractParams
): Promise<SynthesizeContractResponse> {
  const res = await fetch("/api/contracts/synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to synthesize contract: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchSessionTimeline(): Promise<{
  isLive: boolean;
  sourceLabel: string;
  sessionId?: string;
  events: any[];
  warning?: string;
  setupGuide?: {
    title: string;
    steps: string[];
    documentationUrl: string;
  };
}> {
  const res = await fetch("/api/session");
  if (!res.ok) {
    throw new Error(`Failed to load session timeline: ${res.statusText}`);
  }
  return res.json();
}

export interface GemmaConnectionStatus {
  configured: boolean;
  connected: boolean;
  model?: string;
  runtime?: string;
  endpoint?: string;
  latencyMs?: number;
  message?: string;
  error?: string;
}

export async function checkGemmaConnection(): Promise<GemmaConnectionStatus> {
  const res = await fetch("/api/gemma/check");
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    return {
      configured: false,
      connected: false,
      error: errorBody.error || `Endpoint returned HTTP status ${res.status}`,
      message: errorBody.error || `Endpoint returned HTTP status ${res.status}`,
    };
  }
  return res.json();
}

export async function requestGemmaReview(payload: {
  ruleId: string;
  ruleDescription: string;
  filePath: string;
  diffSnippet: string;
  assertionContext?: string;
}): Promise<{
  success: boolean;
  modelName?: string;
  runtime?: string;
  response?: {
    explanation: string;
    weakeningAnalysis: string;
    riskLevel: "low" | "medium" | "high";
    suggestedEdgeCases: Array<{
      description: string;
      sampleInput?: unknown;
      suggestedCheck: string;
    }>;
  };
  error?: string;
  latencyMs?: number;
}> {
  const res = await fetch("/api/gemma/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Gemma review request failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchSentryDiagnostics(): Promise<SentryDiagnosticsStatus> {
  const res = await fetch("/api/diagnostics/sentry");
  if (!res.ok) {
    throw new Error(`Failed to load Sentry diagnostics: ${res.statusText}`);
  }
  return res.json();
}

export async function verifySentryConnectionApi(): Promise<{
  check: VerifiedCheckRecord;
  status: SentryDiagnosticsStatus;
}> {
  const res = await fetch("/api/diagnostics/sentry/verify", {
    method: "POST",
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Sentry verification request failed: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================
// Audit History & MongoDB Persistence Types
// ============================================================

export interface PersistedFindingRecord {
  id: string;
  ruleId: string;
  title: string;
  summary: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  source: "static-rule" | "contract-replay" | "model-assisted" | "agent-provenance";
  humanAction: string;
  evidence: Array<{
    title: string;
    detail: string;
    filePath?: string;
    startLine?: number;
    endLine?: number;
    redactedExcerpt?: string;
  }>;
}

export interface PersistedAuditRecord {
  _id: string;
  id: string;
  schemaVersion: number;
  createdAt: string;
  storedAt: string;
  scenarioId?: string;
  repositoryLabel?: string;
  status: "PASS" | "REVIEW" | "BLOCKED";
  summary: string;
  findings: PersistedFindingRecord[];
  checks: Array<{ id: string; label: string; status: string; durationMs?: number }>;
  contractMetadata?: {
    contractId: string;
    contractVersion: string;
    approvedBy?: string;
    approvedAt?: string;
  };
  traceReference?: {
    traceId: string;
    spanId?: string;
    provider: "sentry";
    timestamp: string;
  };
  isSample: boolean;
}

export interface AuditSummaryItem {
  id: string;
  createdAt: string;
  scenarioId?: string;
  status: "PASS" | "REVIEW" | "BLOCKED";
  findingsCount: number;
  findings: Array<{
    id: string;
    ruleId: string;
    severity: string;
    source: string;
    title: string;
  }>;
  checksSummary: Record<string, number>;
  contractVersion?: string;
  traceId?: string;
  isSample: boolean;
}

export interface MongoStorageDiagnostics {
  mode: "mongodb" | "in-memory";
  connected: boolean;
  databaseName?: string;
  collectionName?: string;
  latencyMs?: number;
  message: string;
  error?: string;
  lastCheckedAt: string;
}

export interface AuditHistoryResponse {
  storageMode: "mongodb" | "in-memory";
  connected: boolean;
  diagnostics: MongoStorageDiagnostics;
  records: AuditSummaryItem[];
}

export async function fetchAuditHistory(): Promise<AuditHistoryResponse> {
  const res = await fetch("/api/history");
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to load audit history: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchPersistedAuditRecord(id: string): Promise<PersistedAuditRecord> {
  const res = await fetch(`/api/history/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Audit record not found: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchMongoDbDiagnostics(): Promise<MongoStorageDiagnostics> {
  const res = await fetch("/api/diagnostics/mongodb");
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `MongoDB diagnostics failed: ${res.statusText}`);
  }
  return res.json();
}

export async function verifyMongoDbConnection(): Promise<MongoStorageDiagnostics> {
  const res = await fetch("/api/diagnostics/mongodb/verify", { method: "POST" });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `MongoDB verification failed: ${res.statusText}`);
  }
  return res.json();
}

