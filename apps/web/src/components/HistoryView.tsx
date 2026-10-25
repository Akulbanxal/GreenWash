import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useScrollToResult } from "../hooks/useScrollToResult";
import {
  History,
  RefreshCw,
  Database,
  CloudOff,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  BarChart2,
  ShieldCheck,
  AlertCircle,
  Info,
  ExternalLink,
  Search,
  X,
  SlidersHorizontal,
  ShieldAlert,
  Download,
  Activity,
  Shield,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { TRANSITION_FAST, TRANSITION_DRAWER, TRANSITION_PANEL } from "../motion";
import {
  fetchAuditHistory,
  fetchPersistedAuditRecord,
  verifyMongoDbConnection,
  AuditHistoryResponse,
  AuditSummaryItem,
  PersistedAuditRecord,
  MongoStorageDiagnostics,
} from "../api.js";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "PASS" | "REVIEW" | "BLOCKED" }) {
  const variants = {
    BLOCKED:
      "bg-status-blocked-bg text-status-blocked-text border border-status-blocked-border",
    REVIEW:
      "bg-status-review-bg text-status-review-text border border-status-review-border",
    PASS:
      "bg-status-pass-bg text-status-pass-text border border-status-pass-border",
  };
  return (
    <span
      className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${variants[status]}`}
    >
      {status}
    </span>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-400",
    high: "bg-orange-400",
    medium: "bg-amber-400",
    low: "bg-yellow-400",
    info: "bg-sky-400",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[severity] ?? "bg-surface-subtle"}`}
      title={severity}
    />
  );
}

function StorageModeBadge({
  mode,
  connected,
}: {
  mode: "mongodb" | "in-memory";
  connected: boolean;
}) {
  if (mode === "mongodb" && connected) {
    return (
      <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-status-pass-bg text-status-pass-text border border-status-pass-border">
        <Database className="w-3 h-3" />
        <span>Atlas Connected</span>
      </span>
    );
  }
  if (mode === "mongodb" && !connected) {
    return (
      <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-status-blocked-bg text-status-blocked-text border border-status-blocked-border">
        <CloudOff className="w-3 h-3" />
        <span>Atlas Offline</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-surface-subtle text-text-secondary border border-border-default">
      <Database className="w-3 h-3" />
      <span>In-Memory (Local)</span>
    </span>
  );
}

function SampleWarningBanner() {
  return (
    <div className="flex items-start space-x-2.5 p-3 rounded border bg-status-review-bg border-status-review-border text-status-review-text text-xs">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <div>
        <span className="font-bold uppercase text-[10px] tracking-wide mr-1.5 bg-status-review-border/50 text-status-review-text border border-status-review-border px-1.5 py-0.5 rounded">
          Sample Reference Only
        </span>
        <span className="text-text-secondary">
          These entries are illustrative fixtures and have never been run against live code.
          Real audit history appears above once you run an audit.
        </span>
      </div>
    </div>
  );
}

function FindingRow({
  finding,
}: {
  finding: PersistedAuditRecord["findings"][0];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border-subtle rounded">
      <button
        className="w-full flex items-start space-x-2.5 p-2.5 text-left hover:bg-surface-subtle/50 transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        <SeverityDot severity={finding.severity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between space-x-2">
            <span className="text-xs font-semibold text-text-primary truncate">
              {finding.title}
            </span>
            <span className="text-[10px] font-mono text-text-tertiary shrink-0">
              {finding.ruleId}
            </span>
          </div>
          <div className="text-[11px] text-text-secondary mt-0.5 line-clamp-1">
            {finding.summary}
          </div>
        </div>
        <ChevronRight
          className={`w-3.5 h-3.5 text-text-tertiary shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border-subtle bg-surface-subtle/30">
          <div className="text-[11px] font-mono text-text-tertiary">
            <span className="text-text-secondary font-semibold">Source:</span> {finding.source}
            &ensp;|&ensp;
            <span className="text-text-secondary font-semibold">Severity:</span>{" "}
            <span className="capitalize">{finding.severity}</span>
          </div>
          <div className="text-[11px] text-text-secondary">
            <span className="font-semibold text-text-primary">Required Action:</span>{" "}
            {finding.humanAction}
          </div>

          {finding.evidence.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono font-semibold text-text-secondary uppercase tracking-wide">
                Evidence (Sanitized Excerpts — No Raw Source)
              </div>
              {finding.evidence.map((e, i) => (
                <div
                  key={i}
                  className="bg-surface-base border border-border-default rounded p-2 space-y-1"
                >
                  <div className="text-[11px] text-text-primary font-semibold">{e.title}</div>
                  <div className="text-[11px] text-text-secondary">{e.detail}</div>
                  {e.filePath && (
                    <div className="text-[10px] font-mono text-text-tertiary">
                      {e.filePath}
                      {e.startLine && ` :${e.startLine}`}
                      {e.endLine && e.endLine !== e.startLine && `–${e.endLine}`}
                    </div>
                  )}
                  {e.redactedExcerpt && (
                    <pre className="text-[10px] font-mono bg-surface-subtle text-text-secondary p-1.5 rounded overflow-x-auto border border-border-subtle leading-relaxed">
                      {e.redactedExcerpt}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecordDetailPanel({
  record,
  onClose,
  onOpenInWorkbench,
}: {
  record: PersistedAuditRecord;
  onClose: () => void;
  onOpenInWorkbench?: (id: string) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const checksArr = record.checks;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Audit Record Details: ${record.scenarioId || record.id}`}
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98, y: 8 }}
      transition={TRANSITION_DRAWER}
      className="bg-surface-panel border border-border-default rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative"
    >
      {/* Header */}
      <div className="sticky top-0 bg-surface-panel border-b border-border-default px-6 py-5 flex items-start justify-between z-10">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <StatusBadge status={record.status} />
            {record.isSample && (
              <span className="text-[9px] font-mono bg-status-review-bg text-status-review-text border border-status-review-border px-1.5 py-0.5 rounded font-bold uppercase">
                Sample
              </span>
            )}
          </div>
          <div className="text-sm font-bold text-text-primary">
            {record.scenarioId || record.repositoryLabel || record.id}
          </div>
          <div className="text-[11px] font-mono text-text-tertiary">
            ID: {record.id}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {onOpenInWorkbench && (
            <button
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-indigo-700/30 text-indigo-300 border border-indigo-600/40 hover:bg-indigo-700/50 transition-colors"
              onClick={() => onOpenInWorkbench(record.id)}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Workbench</span>
            </button>
          )}
          <button
            className="p-1.5 rounded hover:bg-surface-subtle transition-colors text-text-tertiary hover:text-text-primary"
            onClick={onClose}
            aria-label="Close record details"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Meta */}
        <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
          <div className="bg-surface-subtle rounded p-2.5 space-y-1">
            <div className="text-text-tertiary font-semibold uppercase tracking-wide text-[9px]">Created</div>
            <div className="text-text-primary">
              {new Date(record.createdAt).toLocaleString()}
            </div>
          </div>
          <div className="bg-surface-subtle rounded p-2.5 space-y-1">
            <div className="text-text-tertiary font-semibold uppercase tracking-wide text-[9px]">Stored</div>
            <div className="text-text-primary">
              {new Date(record.storedAt).toLocaleString()}
            </div>
          </div>
          <div className="bg-surface-subtle rounded p-2.5 space-y-1">
            <div className="text-text-tertiary font-semibold uppercase tracking-wide text-[9px]">Schema Version</div>
            <div className="text-text-primary">v{record.schemaVersion}</div>
          </div>
          <div className="bg-surface-subtle rounded p-2.5 space-y-1">
            <div className="text-text-tertiary font-semibold uppercase tracking-wide text-[9px]">Findings</div>
            <div className="text-text-primary">{record.findings.length}</div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-surface-subtle border border-border-default rounded p-3 text-xs text-text-secondary">
          {record.summary}
        </div>

        {/* Checks */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-text-secondary">Checks ({checksArr.length})</div>
          <div className="space-y-1">
            {checksArr.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-[11px] font-mono px-2.5 py-1.5 rounded bg-surface-subtle border border-border-subtle">
                <div className="flex items-center space-x-2">
                  {c.status === "passed" ? (
                    <CheckCircle className="w-3.5 h-3.5 text-status-pass-solid" />
                  ) : c.status === "failed" ? (
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-text-tertiary" />
                  )}
                  <span className="text-text-primary">{c.label}</span>
                </div>
                <div className="flex items-center space-x-2 text-text-tertiary">
                  {typeof c.durationMs === "number" && (
                    <span>{c.durationMs}ms</span>
                  )}
                  <span className="capitalize font-semibold text-[9px] uppercase">
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Findings */}
        {record.findings.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-text-secondary">
              Findings — Sanitized Allow-List Only
            </div>
            <div className="space-y-1.5">
              {record.findings.map((f) => (
                <FindingRow key={f.id} finding={f} />
              ))}
            </div>
          </div>
        )}

        {/* Contract Metadata */}
        {record.contractMetadata && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-text-secondary">Contract Metadata</div>
            <div className="bg-surface-subtle border border-border-default rounded p-3 text-[11px] font-mono space-y-1">
              <div>ID: <span className="text-text-primary">{record.contractMetadata.contractId}</span></div>
              <div>Version: <span className="text-text-primary">{record.contractMetadata.contractVersion}</span></div>
              {record.contractMetadata.approvedBy && (
                <div>Approved By: <span className="text-text-primary">{record.contractMetadata.approvedBy}</span></div>
              )}
            </div>
          </div>
        )}

        {/* Trace Reference */}
        {record.traceReference && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-text-secondary">Sentry Trace Reference</div>
            <div className="bg-surface-subtle border border-border-default rounded p-3 text-[11px] font-mono space-y-1">
              <div>Trace ID: <span className="text-indigo-400 font-semibold">{record.traceReference.traceId}</span></div>
              {record.traceReference.spanId && (
                <div>Span ID: <span className="text-text-primary">{record.traceReference.spanId}</span></div>
              )}
              <div>Recorded: <span className="text-text-secondary">{new Date(record.traceReference.timestamp).toLocaleTimeString()}</span></div>
            </div>
          </div>
        )}

        {/* Privacy Notice */}
        <div className="flex items-start space-x-2 bg-surface-subtle/60 border border-border-subtle rounded p-3 text-[11px] text-text-tertiary">
          <ShieldCheck className="w-4 h-4 text-status-pass-solid shrink-0 mt-0.5" />
          <div>
            <span className="text-text-secondary font-semibold">Privacy Boundary Enforced: </span>
            Full source files, entire unified diffs, raw agent transcripts, and credentials are never persisted. Excerpts are capped at 200 characters and secret-scrubbed.
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// History Row
// ─────────────────────────────────────────────────────────────────────────────

function HistoryRow({
  item,
  onSelect,
}: {
  item: AuditSummaryItem;
  onSelect: (item: AuditSummaryItem) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const isBlocked = item.status === "BLOCKED";
  const isReview = item.status === "REVIEW";

  return (
    <motion.button
      whileHover={shouldReduceMotion ? undefined : { y: -2, transition: { type: "spring", stiffness: 420, damping: 26 } }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.995 }}
      data-testid={`history-row-${item.id}`}
      className="w-full text-left p-4.5 rounded-xl bg-surface-panel border border-border-default hover:border-border-strong hover:shadow-xs transition-all duration-150 group focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer shadow-2xs relative overflow-hidden pl-5"
      onClick={() => onSelect(item)}
    >
      {/* Left Status Color Accent Bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 ${
          isBlocked
            ? "bg-status-blocked-solid"
            : isReview
              ? "bg-status-review-solid"
              : "bg-status-pass-solid"
        }`}
      />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2.5">
          <StatusBadge status={item.status} />
          {item.isSample && (
            <span className="text-[9px] font-mono bg-status-review-bg text-status-review-text border border-status-review-border px-1.5 py-0.5 rounded font-bold">
              SAMPLE
            </span>
          )}
          <span className="text-xs font-bold text-text-primary truncate">
            {item.scenarioId || item.id.slice(0, 28)}
          </span>
        </div>
        <div className="flex items-center space-x-2 text-text-tertiary text-[11px] font-mono">
          <Clock className="w-3 h-3" />
          <span>{new Date(item.createdAt).toLocaleString()}</span>
        </div>
      </div>

      <div className="flex items-center space-x-3 text-[11px] font-mono text-text-secondary flex-wrap gap-y-1">
        <span className="flex items-center space-x-1 text-text-tertiary">
          <BarChart2 className="w-3 h-3" />
          <span>{item.findingsCount} finding{item.findingsCount !== 1 ? "s" : ""}</span>
        </span>
        {item.findings.slice(0, 3).map((f) => (
          <span
            key={f.id}
            className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${
              f.severity === "critical" || f.severity === "high"
                ? "bg-status-blocked-bg text-status-blocked-text border-status-blocked-border"
                : "bg-status-review-bg text-status-review-text border-status-review-border"
            }`}
          >
            <SeverityDot severity={f.severity} />
            <span className="truncate max-w-[130px] font-medium">{f.ruleId}</span>
          </span>
        ))}
        {item.findings.length > 3 && (
          <span className="text-text-tertiary text-[10px]">+{item.findings.length - 3} more</span>
        )}
        {item.traceId && (
          <span className="text-indigo-600/80 text-[10px] truncate max-w-[120px] bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded font-mono">
            trace:{item.traceId.slice(0, 10)}…
          </span>
        )}
      </div>

      <div className="flex items-center justify-end mt-2 pt-1 border-t border-border-subtle/60">
        <span className="text-[11px] font-mono text-text-tertiary group-hover:text-brand-primary transition-colors flex items-center space-x-1">
          <span>View forensic record</span>
          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main AuditHistoryView Component
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_RECORDS: AuditSummaryItem[] = [
  {
    id: "sample-blocked-001",
    createdAt: "2024-11-15T10:32:00.000Z",
    scenarioId: "weakened-assertion",
    status: "BLOCKED",
    findingsCount: 2,
    findings: [
      { id: "f1", ruleId: "AST-ASSERT-WEAKENED", severity: "high", source: "static-rule", title: "Assertion weakened" },
      { id: "f2", ruleId: "CONTRACT-VIOLATION", severity: "critical", source: "contract-replay", title: "Contract replay violation" },
    ],
    checksSummary: { passed: 4, failed: 2, warning: 0, "not-run": 0 },
    isSample: true,
  },
  {
    id: "sample-pass-002",
    createdAt: "2024-11-14T08:15:00.000Z",
    scenarioId: "honest-fix",
    status: "PASS",
    findingsCount: 0,
    findings: [],
    checksSummary: { passed: 6, failed: 0, warning: 0, "not-run": 0 },
    isSample: true,
  },
];

export function AuditHistoryView() {
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<AuditHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailRecord, setDetailRecord] = useState<PersistedAuditRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyDiag, setVerifyDiag] = useState<MongoStorageDiagnostics | null>(null);
  const [showSampleSection, setShowSampleSection] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const verifyDiagRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to MongoDB verify diagnostics when probe completes
  useScrollToResult({
    targetRef: verifyDiagRef,
    containerRef,
    triggerKey: verifyDiag ? `${verifyDiag.connected}-${verifyDiag.latencyMs}` : undefined,
    enabled: !verifying && Boolean(verifyDiag),
    topOffset: 24,
    focusOnScroll: true,
  });

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await fetchAuditHistory();
      setHistory(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load audit history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelect = async (item: AuditSummaryItem) => {
    setSelectedId(item.id);
    setDetailRecord(null);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const record = await fetchPersistedAuditRecord(item.id);
      setDetailRecord(record);
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : "Failed to load record details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleVerifyMongo = async () => {
    setVerifying(true);
    try {
      const diag = await verifyMongoDbConnection();
      setVerifyDiag(diag);
    } catch {
      setVerifyDiag({
        mode: "in-memory",
        connected: false,
        message: "Verification probe failed",
        lastCheckedAt: new Date().toISOString(),
      });
    } finally {
      setVerifying(false);
    }
  };

  const storageMode = history?.storageMode ?? "in-memory";
  const isAtlasConnected = storageMode === "mongodb" && (history?.connected ?? false);
  const realRecords = (history?.records ?? []).filter((r) => !r.isSample);

  // Search & Filter controls
  const [searchQuery, setSearchQuery] = useState("");
  const [scenarioFilter, setScenarioFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "BLOCKED" | "REVIEW" | "PASS">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "findings">("newest");

  // Telemetry Metrics calculation
  const metrics = useMemo(() => {
    const total = realRecords.length;
    const blocked = realRecords.filter((r) => r.status === "BLOCKED").length;
    const review = realRecords.filter((r) => r.status === "REVIEW").length;
    const passed = realRecords.filter((r) => r.status === "PASS").length;
    const totalFindings = realRecords.reduce((acc, r) => acc + (r.findingsCount || 0), 0);
    const blockRate = total > 0 ? Math.round((blocked / total) * 100) : 0;
    return { total, blocked, review, passed, totalFindings, blockRate };
  }, [realRecords]);

  const handleExportLog = () => {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      storageMode,
      diagnostics: history?.diagnostics,
      metrics,
      totalRecords: realRecords.length,
      records: realRecords,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `greenwash-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredRecords = useMemo(() => {
    return realRecords
      .filter((r) => {
        if (scenarioFilter !== "all" && r.scenarioId !== scenarioFilter) {
          return false;
        }
        if (statusFilter !== "all" && r.status !== statusFilter) {
          return false;
        }
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          r.id.toLowerCase().includes(q) ||
          (r.scenarioId && r.scenarioId.toLowerCase().includes(q)) ||
          r.status.toLowerCase().includes(q) ||
          r.findings.some(
            (f) =>
              f.ruleId.toLowerCase().includes(q) ||
              f.title.toLowerCase().includes(q)
          )
        );
      })
      .sort((a, b) => {
        if (sortOrder === "newest") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortOrder === "oldest") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return b.findingsCount - a.findingsCount;
      });
  }, [realRecords, searchQuery, scenarioFilter, statusFilter, sortOrder]);

  return (
    <div ref={containerRef} className="flex-1 p-6 bg-surface-base overflow-y-auto font-sans">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header with quick export and refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface-panel p-4 rounded-lg border border-border-default shadow-2xs">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-text-primary">Audit History</h1>
              <span className="text-[10px] font-mono font-bold bg-brand-primary text-white dark:text-slate-950 px-2 py-0.5 rounded">
                Telemetry Log
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Sanitized audit records with strict privacy boundary. Zero raw source, diffs, or secrets persisted.
            </p>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <StorageModeBadge mode={storageMode} connected={isAtlasConnected} />
            {realRecords.length > 0 && (
              <button
                onClick={handleExportLog}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-surface-subtle hover:bg-surface-panel border border-border-default text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                title="Download sanitized audit records JSON"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export Log</span>
              </button>
            )}
            <button
              onClick={() => load(true)}
              disabled={loading || refreshing}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-surface-panel border border-border-default hover:bg-surface-subtle text-text-secondary transition-colors disabled:opacity-50 cursor-pointer"
              data-testid="history-refresh-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
              <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* KPI Telemetry Ribbon */}
        {!loading && realRecords.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface-panel border border-border-default rounded-lg p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-text-tertiary">
                <span className="text-[11px] font-mono uppercase tracking-wider">Total Audits</span>
                <Activity className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-bold font-mono text-text-primary mt-1">
                {metrics.total}
              </div>
              <div className="text-[10px] text-text-secondary mt-0.5">
                Evaluated runs
              </div>
            </div>

            <div className="bg-surface-panel border border-border-default rounded-lg p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-text-tertiary">
                <span className="text-[11px] font-mono uppercase tracking-wider">Blocked Rate</span>
                <ShieldAlert className="w-3.5 h-3.5 text-status-blocked-solid" />
              </div>
              <div className="text-xl font-bold font-mono text-status-blocked-solid mt-1">
                {metrics.blockRate}%
              </div>
              <div className="text-[10px] text-text-secondary mt-0.5">
                {metrics.blocked} evasions blocked
              </div>
            </div>

            <div className="bg-surface-panel border border-border-default rounded-lg p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-text-tertiary">
                <span className="text-[11px] font-mono uppercase tracking-wider">Review Flags</span>
                <AlertCircle className="w-3.5 h-3.5 text-status-review-solid" />
              </div>
              <div className="text-xl font-bold font-mono text-status-review-solid mt-1">
                {metrics.review}
              </div>
              <div className="text-[10px] text-text-secondary mt-0.5">
                Ambiguous checks
              </div>
            </div>

            <div className="bg-surface-panel border border-border-default rounded-lg p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-text-tertiary">
                <span className="text-[11px] font-mono uppercase tracking-wider">Defects Flagged</span>
                <BarChart2 className="w-3.5 h-3.5 text-brand-primary" />
              </div>
              <div className="text-xl font-bold font-mono text-brand-primary mt-1">
                {metrics.totalFindings}
              </div>
              <div className="text-[10px] text-text-secondary mt-0.5">
                Rule infractions
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start space-x-2 p-3.5 rounded border bg-status-blocked-bg border-status-blocked-border text-status-blocked-text text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Failed to load history: </span>
              {error}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-text-tertiary">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Loading audit history…</span>
          </div>
        )}

        {!loading && (
          <>
            {/* Storage Status Panel */}
            <div
              className="bg-surface-panel border border-border-default rounded p-4 space-y-3"
              data-testid="history-storage-panel"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <Database className="w-4.5 h-4.5 text-text-secondary" />
                  <div>
                    <div className="text-sm font-semibold text-text-primary">
                      {storageMode === "mongodb" ? "MongoDB Atlas Persistence" : "Local In-Memory Session Storage"}
                    </div>
                    <div className="text-[11px] text-text-secondary mt-0.5">
                      {storageMode === "mongodb"
                        ? isAtlasConnected
                          ? `Connected to database '${history?.diagnostics.databaseName}'`
                          : "Connection probe failed — falling back to in-memory"
                        : "MongoDB Atlas is not configured. Audits are retained in local application memory only."}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleVerifyMongo}
                  disabled={verifying}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 text-[11px] font-mono rounded bg-surface-subtle hover:bg-surface-base border border-border-default text-text-secondary disabled:opacity-50 cursor-pointer transition-colors"
                  data-testid="history-verify-mongo-btn"
                >
                  <RefreshCw className={`w-3 h-3 ${verifying ? "animate-spin text-indigo-400" : ""}`} />
                  <span>{verifying ? "Probing…" : "Verify Connection"}</span>
                </button>
              </div>

              {verifyDiag && (
                <div
                  ref={verifyDiagRef}
                  className="text-[11px] font-mono text-text-tertiary bg-surface-subtle border border-border-subtle rounded p-2.5 space-y-1 scroll-mt-4"
                >
                  <div>
                    Mode:{" "}
                    <span className="text-text-primary font-semibold capitalize">{verifyDiag.mode}</span>
                  </div>
                  <div>
                    Probe Result:{" "}
                    <span
                      className={verifyDiag.connected ? "text-status-pass-solid font-semibold" : "text-red-400 font-semibold"}
                    >
                      {verifyDiag.connected ? "Passed" : "Failed"}
                    </span>
                  </div>
                  {verifyDiag.latencyMs !== undefined && (
                    <div>Latency: <span className="text-text-primary">{verifyDiag.latencyMs}ms</span></div>
                  )}
                  <div className="text-text-secondary">{verifyDiag.message}</div>
                </div>
              )}

              {!isAtlasConnected && (
                <div className="text-[11px] font-mono text-text-tertiary space-y-1">
                  <div className="flex items-center space-x-1.5">
                    <Info className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      Set <code className="text-sky-300">MONGODB_URI</code> in <code className="text-sky-300">.env</code> to persist audits across sessions.
                    </span>
                  </div>
                  <div className="pl-5 text-text-tertiary">
                    Example: <code className="text-text-secondary">MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net</code>
                  </div>
                </div>
              )}
            </div>

            {/* Real Audit History */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  Audit Records{" "}
                  <span className="text-text-tertiary font-normal normal-case ml-1">
                    ({filteredRecords.length} of {realRecords.length} {realRecords.length === 1 ? "record" : "records"})
                  </span>
                </div>

                {/* Filter and Sort Toolbar */}
                {realRecords.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status filter pills */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setStatusFilter("all")}
                        className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                          statusFilter === "all"
                            ? "bg-brand-primary text-white dark:text-slate-950 border-brand-primary font-bold"
                            : "bg-surface-panel text-text-secondary border-border-default hover:bg-surface-subtle"
                        }`}
                      >
                        All ({realRecords.length})
                      </button>
                      <button
                        onClick={() => setStatusFilter("BLOCKED")}
                        className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors cursor-pointer flex items-center space-x-1 ${
                          statusFilter === "BLOCKED"
                            ? "bg-status-blocked-solid text-white dark:text-slate-950 border-status-blocked-solid font-bold"
                            : "bg-surface-panel text-status-blocked-text border-status-blocked-border hover:bg-status-blocked-bg"
                        }`}
                      >
                        <span>Blocked ({metrics.blocked})</span>
                      </button>
                      <button
                        onClick={() => setStatusFilter("REVIEW")}
                        className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors cursor-pointer flex items-center space-x-1 ${
                          statusFilter === "REVIEW"
                            ? "bg-status-review-solid text-white dark:text-slate-950 border-status-review-solid font-bold"
                            : "bg-surface-panel text-status-review-text border-status-review-border hover:bg-status-review-bg"
                        }`}
                      >
                        <span>Review ({metrics.review})</span>
                      </button>
                      <button
                        onClick={() => setStatusFilter("PASS")}
                        className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors cursor-pointer flex items-center space-x-1 ${
                          statusFilter === "PASS"
                            ? "bg-status-pass-solid text-white dark:text-slate-950 border-status-pass-solid font-bold"
                            : "bg-surface-panel text-status-pass-text border-status-pass-border hover:bg-status-pass-bg"
                        }`}
                      >
                        <span>Passed ({metrics.passed})</span>
                      </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-text-tertiary absolute left-2.5 top-2" />
                      <input
                        type="text"
                        data-testid="history-search-input"
                        placeholder="Filter by ID, scenario, rule…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-7 pl-7 pr-7 text-xs bg-surface-panel border border-border-default rounded text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-strong w-44 sm:w-48"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          aria-label="Clear search query"
                          className="absolute right-2 top-2 text-text-tertiary hover:text-text-primary"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Scenario Filter */}
                    <select
                      data-testid="history-scenario-filter"
                      aria-label="Filter history by scenario"
                      value={scenarioFilter}
                      onChange={(e) => setScenarioFilter(e.target.value)}
                      className="h-7 px-2 text-xs font-mono bg-surface-panel border border-border-default rounded text-text-secondary focus:outline-none focus:border-border-strong cursor-pointer"
                    >
                      <option value="all">All Scenarios</option>
                      <option value="weakened-assertion">Weakened Assertion</option>
                      <option value="deleted-test">Deleted Test</option>
                      <option value="skipped-test">Skipped Test</option>
                      <option value="excessive-mocking">Excessive Mocking</option>
                      <option value="weakened-ci-gate">Weakened CI Gate</option>
                      <option value="honest-fix">Honest Fix</option>
                    </select>

                    {/* Sort Order */}
                    <select
                      data-testid="history-sort-select"
                      aria-label="Sort history order"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as any)}
                      className="h-7 px-2 text-xs font-mono bg-surface-panel border border-border-default rounded text-text-secondary focus:outline-none focus:border-border-strong cursor-pointer"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="findings">Most Findings</option>
                    </select>
                  </div>
                )}
              </div>

              {realRecords.length === 0 ? (
                <div
                  className="bg-surface-panel border border-border-default rounded p-10 text-center space-y-3"
                  data-testid="history-empty-state"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-surface-subtle border border-border-default flex items-center justify-center text-text-tertiary">
                    <History className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">No Audits Run Yet</h2>
                    <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                      Run an audit in Red-Team Lab or Mastra Pipeline. Results will appear here automatically once an audit completes.
                    </p>
                  </div>
                  <div className="text-[11px] font-mono text-text-tertiary">
                    Storage Mode: <span className="text-text-secondary capitalize">{storageMode}</span>
                    {" "}·{" "}
                    {isAtlasConnected ? (
                      <span className="text-status-pass-solid">Atlas Connected</span>
                    ) : (
                      <span className="text-text-tertiary">Local Session Only</span>
                    )}
                  </div>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div
                  className="bg-surface-panel border border-border-default rounded p-8 text-center space-y-2.5"
                  data-testid="history-no-matches-state"
                >
                  <div className="text-xs font-semibold text-text-primary">No Matching Audit Records</div>
                  <p className="text-xs text-text-secondary max-w-sm mx-auto">
                    No recorded runs match the current search or scenario filter criteria.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setScenarioFilter("all");
                    }}
                    className="mt-2 px-3 py-1 text-xs font-mono rounded bg-surface-subtle border border-border-default hover:bg-surface-base text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                  >
                    Clear Search & Filters
                  </button>
                </div>
              ) : (
                <div className="space-y-2" data-testid="history-records-list">
                  <AnimatePresence initial={false}>
                    {filteredRecords.map((item) => (
                      <motion.div
                        key={item.id}
                        layout="position"
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
                        transition={TRANSITION_FAST}
                      >
                        <HistoryRow item={item} onSelect={handleSelect} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Sample History Section (clearly separated and labeled) */}
            <div className="border-t border-border-subtle pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  className="flex items-center space-x-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                  onClick={() => setShowSampleSection((p) => !p)}
                  data-testid="history-toggle-sample-btn"
                >
                  <ChevronRight
                    className={`w-4 h-4 transition-transform ${showSampleSection ? "rotate-90" : ""}`}
                  />
                  <span>Sample Audit History (Reference Only)</span>
                  <span className="text-[9px] font-mono bg-status-review-bg text-status-review-text border border-status-review-border px-1.5 py-0.5 rounded font-bold uppercase">
                    Never Mixed with Real History
                  </span>
                </button>
              </div>

              {showSampleSection && (
                <div className="space-y-3" data-testid="history-sample-section">
                  <SampleWarningBanner />
                  <div className="space-y-2">
                    {SAMPLE_RECORDS.map((item) => (
                      <HistoryRow
                        key={item.id}
                        item={item}
                        onSelect={() => {
                          // Sample items: open a sanitized inline preview without fetching from server
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Privacy Policy Footer */}
            <div className="flex items-start space-x-2 bg-surface-subtle/40 border border-border-subtle/60 rounded p-3 text-[11px] text-text-tertiary">
              <ShieldCheck className="w-4 h-4 text-status-pass-solid shrink-0 mt-0.5" />
              <div>
                <span className="text-text-secondary font-semibold">Data Boundary Active: </span>
                Only audit ID, timestamps, scenario label, status, finding rule IDs/severities, check statuses, contract metadata, and trace references are persisted.
                Full source files, entire diffs, raw agent transcripts, and credentials are permanently excluded.
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Panel Overlay */}
      <AnimatePresence>
        {(detailLoading || detailRecord || detailError) && (
          <motion.div
            key="history-detail-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION_FAST}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setDetailRecord(null);
                setDetailError(null);
                setSelectedId(null);
              }
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            {detailLoading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-surface-panel border border-border-default rounded p-8 text-text-secondary flex items-center space-x-3"
              >
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                <span>Loading record…</span>
              </motion.div>
            )}
            {detailError && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-surface-panel border border-red-700/40 rounded p-8 space-y-3 text-red-300 max-w-sm"
              >
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-semibold">Failed to Load Record</span>
                </div>
                <p className="text-sm text-text-secondary">{detailError}</p>
                <button
                  className="text-xs text-text-secondary hover:text-text-primary cursor-pointer"
                  onClick={() => {
                    setDetailRecord(null);
                    setDetailError(null);
                    setSelectedId(null);
                  }}
                >
                  Dismiss
                </button>
              </motion.div>
            )}
            {detailRecord && !detailLoading && (
              <RecordDetailPanel
                record={detailRecord}
                onClose={() => {
                  setDetailRecord(null);
                  setSelectedId(null);
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
