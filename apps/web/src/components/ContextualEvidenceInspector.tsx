import React, { useState, useRef } from "react";
import {
  Copy,
  Check,
  Terminal,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowLeft,
  Play,
  Clock,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AuditFinding, AuditReport } from "@greenwash/core/dist/browser.js";
import { TRANSITION_FAST, TRANSITION_PANEL } from "../motion";
import { useScrollToResult } from "../hooks/useScrollToResult";

interface ContextualEvidenceInspectorProps {
  finding: AuditFinding | null;
  report: AuditReport | null;
  onReturnToScenario?: () => void;
  onRunAudit?: () => void;
  onCloseDrawer?: () => void;
}

export function ContextualEvidenceInspector({
  finding,
  report,
  onReturnToScenario,
  onRunAudit,
  onCloseDrawer,
}: ContextualEvidenceInspectorProps) {
  const [copiedRepro, setCopiedRepro] = useState(false);
  const [copiedReportId, setCopiedReportId] = useState(false);
  const [evidenceExpanded, setEvidenceExpanded] = useState(true);
  const [gemmaLoading, setGemmaLoading] = useState(false);
  const [gemmaResult, setGemmaResult] = useState<{
    modelName?: string;
    runtime?: string;
    latencyMs?: number;
    response?: {
      explanation: string;
      weakeningAnalysis: string;
      riskLevel: "low" | "medium" | "high";
      suggestedEdgeCases: Array<{ description: string; sampleInput?: unknown; suggestedCheck: string }>;
    };
  } | null>(null);
  const [gemmaError, setGemmaError] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const inspectorContainerRef = useRef<HTMLElement>(null);
  const gemmaResultRef = useRef<HTMLDivElement>(null);
  const gemmaErrorRef = useRef<HTMLDivElement>(null);

  // Auto-scroll inspector to Gemma analysis result
  useScrollToResult({
    targetRef: gemmaResultRef,
    containerRef: inspectorContainerRef as React.RefObject<HTMLElement | null>,
    triggerKey: gemmaResult ? `${gemmaResult.modelName}-${Date.now()}` : undefined,
    enabled: Boolean(gemmaResult) && !gemmaLoading,
    topOffset: 16,
    focusOnScroll: true,
  });

  // Auto-scroll inspector to Gemma error
  useScrollToResult({
    targetRef: gemmaErrorRef,
    containerRef: inspectorContainerRef as React.RefObject<HTMLElement | null>,
    triggerKey: gemmaError ? `error-${gemmaError}` : undefined,
    enabled: Boolean(gemmaError) && !gemmaLoading,
    topOffset: 16,
    focusOnScroll: true,
  });

  const handleRequestGemmaReview = async () => {
    if (!finding) return;
    setGemmaLoading(true);
    setGemmaError(null);
    try {
      const ev = finding.evidence[0];
      const diffSnippet =
        (ev?.diffHunk && ev.diffHunk.includes("\n")
          ? ev.diffHunk
          : [
              ev?.beforeSnippet ? `- ${ev.beforeSnippet}` : "",
              ev?.afterSnippet ? `+ ${ev.afterSnippet}` : "",
            ].filter(Boolean).join("\n")) ||
        ev?.diffHunk ||
        (finding.expected && finding.actual ? `${finding.expected} -> ${finding.actual}` : "") ||
        finding.summary ||
        "Code change";

      const res = await fetch("/api/gemma/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: finding.ruleId,
          ruleDescription: finding.summary,
          filePath: ev?.filePath || "code.ts",
          diffSnippet,
          assertionContext: ev?.detail || finding.summary,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      if (data.success && data.response) {
        setGemmaResult(data);
      } else {
        throw new Error(data.error || "No review returned");
      }
    } catch (err: unknown) {
      setGemmaError(err instanceof Error ? err.message : String(err));
    } finally {
      setGemmaLoading(false);
    }
  };

  const handleCopyRepro = (cmd?: string) => {
    if (!cmd) return;
    try {
      if (navigator.clipboard?.writeText) {
        const p = navigator.clipboard.writeText(cmd);
        if (p && typeof p.catch === "function") {
          p.catch(() => {
            setCopiedRepro(false);
          });
        }
      }
      setCopiedRepro(true);
      setTimeout(() => setCopiedRepro(false), 1400);
    } catch {
      setCopiedRepro(false);
    }
  };

  const handleCopyReportId = (id?: string) => {
    if (!id) return;
    try {
      if (navigator.clipboard?.writeText) {
        const p = navigator.clipboard.writeText(id);
        if (p && typeof p.catch === "function") {
          p.catch(() => {
            setCopiedReportId(false);
          });
        }
      }
      setCopiedReportId(true);
      setTimeout(() => setCopiedReportId(false), 1400);
    } catch {
      setCopiedReportId(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STATE A: PASS STATE SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  if (!finding && report?.status === "PASS") {
    const passedCount = report.checks.filter((c) => c.status === "passed").length;

    return (
      <aside
        className="w-[380px] bg-surface-panel border-l border-border-default p-5 flex flex-col h-full overflow-y-auto space-y-4 font-sans select-text"
        role="region"
        aria-label="Evidence Details"
        data-testid="evidence-inspector-pass-summary"
      >
        <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
          <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-status-pass-solid uppercase">
            <CheckCircle2 className="w-4 h-4" />
            <span>Audit Summary: PASS</span>
          </div>
          {onReturnToScenario && (
            <button
              onClick={onReturnToScenario}
              className="text-[11px] font-mono text-text-secondary hover:text-text-primary flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Return to Demo Lab</span>
            </button>
          )}
        </div>

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={TRANSITION_PANEL}
          className="p-4 rounded border border-status-pass-border bg-status-pass-bg text-status-pass-text space-y-1.5"
        >
          <h2 className="font-bold text-sm font-mono">All Integrity Checks Satisfied</h2>
          <p className="text-xs leading-relaxed text-emerald-800">
            {report.summary}
          </p>
        </motion.div>

        {/* Real Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2.5 rounded bg-surface-subtle border border-border-default">
            <div className="text-[10px] text-text-tertiary uppercase font-semibold">Checks Evaluated</div>
            <div className="font-bold text-text-primary mt-1">{passedCount} / {report.checks.length} passed</div>
          </div>
          <div className="p-2.5 rounded bg-surface-subtle border border-border-default">
            <div className="text-[10px] text-text-tertiary uppercase font-semibold">Defects Detected</div>
            <div className="font-bold text-status-pass-solid mt-1">0 Defect(s)</div>
          </div>
        </div>

        {/* Check Details List */}
        <div className="space-y-2">
          <span className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider">
            Verified Checks ({report.checks.length})
          </span>
          <div className="space-y-1">
            {report.checks.map((c) => (
              <div
                key={c.id}
                className="p-2 rounded bg-surface-subtle border border-border-subtle flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center space-x-2 truncate pr-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-status-pass-solid shrink-0" />
                  <span className="truncate text-text-primary">{c.label}</span>
                </div>
                <span className="text-[10px] font-bold text-status-pass-solid uppercase shrink-0">
                  [PASS]
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Behavioral Contracts Notice */}
        <div className="p-3 rounded bg-surface-subtle border border-border-default text-xs space-y-1">
          <div className="flex items-center space-x-1.5 font-semibold text-text-primary font-mono text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Behavioral Replay Contract</span>
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            Candidate patch was replayed against independent behavior contract expectations and confirmed to preserve verified input/output invariants.
          </p>
        </div>

        {/* Limitations Notice */}
        {report.limitations && report.limitations.length > 0 && (
          <div className="text-[11px] text-text-tertiary font-mono pt-2 border-t border-border-subtle space-y-0.5">
            <span className="font-bold text-text-secondary">Limitations:</span>
            {report.limitations.map((l, idx) => (
              <div key={idx}>* {l}</div>
            ))}
          </div>
        )}
      </aside>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATE B: NO AUDIT RUN YET
  // ─────────────────────────────────────────────────────────────────────────
  if (!finding && !report) {
    return (
      <aside
        className="w-[380px] bg-surface-panel border-l border-border-default p-6 flex flex-col justify-center items-center text-center text-text-tertiary select-none font-sans"
        role="region"
        aria-label="Evidence Details"
        data-testid="no-audit-yet-panel"
      >
        <div className="w-12 h-12 rounded-full bg-surface-subtle border border-border-default flex items-center justify-center text-brand-primary mb-3">
          <Clock className="w-6 h-6" />
        </div>
        <h2 className="font-mono text-xs font-bold text-text-primary">No Finding Selected</h2>
        <span className="text-[11px] font-mono text-text-secondary mt-0.5">Audit Not Run Yet</span>
        <p className="text-xs text-text-secondary mt-1.5 max-w-[260px] leading-relaxed">
          This scenario's diff has not been scanned. Run the integrity audit to evaluate deterministic rules and replay behavior contracts.
        </p>
        {onRunAudit && (
          <motion.button
            whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
            onClick={onRunAudit}
            data-testid="inspector-run-audit-btn"
            className="mt-4 px-3.5 py-1.5 text-xs font-mono font-bold rounded bg-brand-primary hover:opacity-90 text-white dark:text-slate-950 flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run Integrity Audit (R)</span>
          </motion.button>
        )}
        {onReturnToScenario && (
          <button
            onClick={onReturnToScenario}
            className="mt-2 text-[11px] font-mono text-text-tertiary hover:text-text-primary transition-colors"
          >
            Return to Demo Lab
          </button>
        )}
      </aside>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATE C: NO FINDING CURRENTLY SELECTED
  // ─────────────────────────────────────────────────────────────────────────
  if (!finding) {
    return (
      <aside
        className="w-[380px] bg-surface-panel border-l border-border-default p-6 flex flex-col justify-center items-center text-center text-text-tertiary select-none font-sans"
        role="region"
        aria-label="Evidence Details"
        data-testid="no-finding-selected-panel"
      >
        <div className="w-10 h-10 rounded-full bg-surface-subtle border border-border-default flex items-center justify-center text-text-tertiary mb-2">
          <Info className="w-5 h-5" />
        </div>
        <h2 className="font-mono text-xs font-semibold text-text-secondary">No Finding Selected</h2>
        <p className="text-[11px] text-text-tertiary mt-1 max-w-[240px] leading-relaxed">
          Select an integrity finding in the sidebar or click a flagged code line to inspect forensic proof.
        </p>
        {onReturnToScenario && (
          <button
            onClick={onReturnToScenario}
            className="mt-4 px-3 py-1.5 text-xs font-mono rounded bg-surface-subtle hover:bg-surface-base text-text-secondary border border-border-default flex items-center space-x-1.5 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Return to Demo Lab</span>
          </button>
        )}
      </aside>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATE D: FINDING INSPECTOR
  // ─────────────────────────────────────────────────────────────────────────
  const isReplay = finding.source === "contract-replay";
  const isDeterministic = finding.source === "static-rule";
  const isModel = finding.source === "model-assisted";

  return (
    <aside
      ref={inspectorContainerRef}
      className="w-[380px] bg-surface-panel border-l border-border-default flex flex-col h-full overflow-y-auto p-4 space-y-4 select-text font-sans"
      role="region"
      aria-label="Evidence Details"
    >
      {/* Top Action Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
        {onReturnToScenario && (
          <button
            onClick={onReturnToScenario}
            data-testid="return-to-scenario-btn"
            className="text-[11px] font-mono text-text-secondary hover:text-text-primary flex items-center space-x-1 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Lab</span>
          </button>
        )}

        {report?.id && (
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
            onClick={() => handleCopyReportId(report.id)}
            data-testid="copy-report-id-btn"
            className="text-[10px] font-mono text-text-tertiary hover:text-text-primary flex items-center space-x-1 px-1.5 py-0.5 rounded bg-surface-subtle border border-border-default cursor-pointer transition-colors duration-100"
          >
            {copiedReportId ? <Check className="w-3 h-3 text-status-pass-solid" /> : <Copy className="w-3 h-3" />}
            <span>{copiedReportId ? "Copied ID" : `Report: ${report.id.slice(0, 14)}...`}</span>
          </motion.button>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={finding.id}
          initial={shouldReduceMotion ? false : { opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, x: -8 }}
          transition={TRANSITION_PANEL}
          className="space-y-4"
        >
          {/* Card 1: Finding Meta */}
          <div className="border border-border-default rounded p-3.5 bg-surface-subtle space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-text-primary">{finding.ruleId}</span>
              <span
                className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                  isReplay
                    ? "bg-[#DC2626] text-white"
                    : isDeterministic
                      ? "bg-slate-800 dark:bg-slate-700 text-white dark:text-slate-100"
                      : isModel
                        ? "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800"
                        : "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                }`}
              >
                {isReplay
                  ? "[REPLAY] Contract Confirmed"
                  : isDeterministic
                    ? "[DET] Deterministic Rule"
                    : isModel
                      ? "[GEMMA] Model-Assisted"
                      : "[ENTIRE] Provenance"}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-text-primary">{finding.title}</h2>
            <p className="text-xs text-text-secondary leading-relaxed">{finding.summary}</p>
          </div>

          {/* Card 2: Behavioral Contract Comparison */}
          {(finding.expected !== undefined || finding.actual !== undefined) && (
            <div className="border border-border-default rounded p-3.5 bg-surface-panel space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider">
                  {isReplay ? "Counterexample Replay Output" : "Syntactic Delta"}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold uppercase ${
                    isReplay ? "text-status-blocked-solid" : "text-status-review-solid"
                  }`}
                >
                  {isReplay ? "CONFIRMED VIOLATION" : "STATIC SUSPICION"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded bg-status-pass-bg border border-status-pass-border text-status-pass-text">
                  <div className="text-[10px] text-text-secondary uppercase font-semibold">Expected / Baseline</div>
                  <div className="font-bold mt-1 break-all select-all">{JSON.stringify(finding.expected)}</div>
                </div>
                <div className="p-2.5 rounded bg-status-blocked-bg border border-status-blocked-border text-status-blocked-text">
                  <div className="text-[10px] text-text-secondary uppercase font-semibold">Actual / Candidate</div>
                  <div className="font-bold mt-1 break-all select-all">{JSON.stringify(finding.actual)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Card 3: Expandable Evidence References */}
          {finding.evidence.length > 0 && (
            <div className="border border-border-default rounded p-3 bg-surface-panel space-y-2">
              <button
                type="button"
                className="w-full flex items-center justify-between cursor-pointer select-none text-left"
                onClick={() => setEvidenceExpanded(!evidenceExpanded)}
                aria-expanded={evidenceExpanded}
              >
                <span className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider">
                  Evidence Details ({finding.evidence.length})
                </span>
                <span className="text-[10px] font-mono text-text-tertiary flex items-center space-x-1">
                  <span>{evidenceExpanded ? "Collapse" : "Expand"}</span>
                  {evidenceExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </span>
              </button>

              <AnimatePresence>
                {evidenceExpanded && (
                  <motion.div
                    initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                    transition={TRANSITION_FAST}
                    className="space-y-2 pt-1 overflow-hidden"
                  >
                    {finding.evidence.map((ev, idx) => (
                      <div key={idx} className="p-2 rounded bg-surface-subtle border border-border-default text-xs font-mono">
                        <div className="flex items-center justify-between text-text-primary font-bold">
                          <span>{ev.title}</span>
                          <span className="text-[10px] text-text-tertiary">
                            {ev.filePath ? `${ev.filePath}:${ev.startLine ?? "N/A"}` : "Location unavailable"}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-secondary mt-1 font-sans">{ev.detail}</p>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Card 4: Deterministic Repro Command Box */}
          {finding.reproductionCommand && (
            <div className="border border-border-default rounded p-3.5 bg-[#161B22] text-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-gray-400">Reproduction Terminal Command</span>
                <motion.button
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                  onClick={() => handleCopyRepro(finding.reproductionCommand)}
                  data-testid="copy-repro-btn"
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  {copiedRepro ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedRepro ? "Copied!" : "Copy (C)"}</span>
                </motion.button>
              </div>
              <div className="font-mono text-xs text-[#58A6FF] break-all select-all leading-relaxed">
                $ {finding.reproductionCommand}
              </div>
            </div>
          )}

          {/* Card 5: Human Action & Recommendations */}
          <div className="border border-border-default rounded p-3.5 bg-surface-subtle space-y-1">
            <span className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider">
              Required Human Action
            </span>
            <p className="text-xs text-text-primary leading-relaxed">{finding.humanAction}</p>
          </div>

          {/* Card 6: Gemma Model-Assisted Analysis */}
          <div
            className="border border-indigo-500/30 rounded p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3"
            data-testid="gemma-review-panel"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                  [Gemma] Model-Assisted Analysis
                </span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700/50">
                Advisory Only
              </span>
            </div>

            <div className="text-[11px] text-text-tertiary leading-relaxed bg-surface-subtle/50 p-2 rounded border border-border-default">
              <span className="font-semibold text-text-secondary">Safety Guard:</span> Model output is untrusted and cannot alter deterministic findings or status. Candidate tests require human review and are never executed automatically.
            </div>

            {gemmaLoading && (
              <div className="flex items-center justify-center space-x-2 py-4 text-xs font-mono text-indigo-700 dark:text-indigo-300">
                <span className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span>Consulting Gemma inference route...</span>
              </div>
            )}

            {gemmaError && (
              <div
                ref={gemmaErrorRef}
                className="p-2.5 rounded bg-red-950/30 border border-red-500/30 text-xs text-red-200 space-y-1.5 scroll-mt-4"
              >
                <div className="flex items-center space-x-1 font-semibold text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Gemma Unavailable</span>
                </div>
                <p className="text-[11px] text-red-300/90 leading-relaxed">{gemmaError}</p>
                <button
                  onClick={handleRequestGemmaReview}
                  className="text-[10px] font-mono px-2 py-1 rounded bg-red-900/40 hover:bg-red-800/50 text-red-200 border border-red-700/50 cursor-pointer"
                >
                  Retry Call
                </button>
              </div>
            )}

            {gemmaResult && gemmaResult.response && (
              <div ref={gemmaResultRef} className="space-y-3 pt-1 scroll-mt-4">
                <div className="flex flex-wrap gap-2 text-[10px] font-mono text-text-tertiary">
                  {gemmaResult.modelName && (
                    <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border-default">
                      Model: <span className="text-text-primary">{gemmaResult.modelName}</span>
                    </span>
                  )}
                  {gemmaResult.runtime && (
                    <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border-default">
                      Runtime: <span className="text-text-primary">{gemmaResult.runtime}</span>
                    </span>
                  )}
                  {gemmaResult.response.riskLevel && (
                    <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border-default">
                      Risk: {gemmaResult.response.riskLevel}
                    </span>
                  )}
                </div>

                <div className="p-2.5 rounded bg-surface-panel border border-border-default space-y-1 text-xs">
                  <div className="font-semibold text-indigo-700 dark:text-indigo-300 font-mono text-[11px]">Explanation</div>
                  <p className="text-text-secondary leading-relaxed">{gemmaResult.response.explanation}</p>
                </div>

                {gemmaResult.response.weakeningAnalysis && (
                  <div className="p-2.5 rounded bg-surface-panel border border-border-default space-y-1 text-xs">
                    <div className="font-semibold text-indigo-700 dark:text-indigo-300 font-mono text-[11px]">Weakening Analysis</div>
                    <p className="text-text-secondary leading-relaxed">{gemmaResult.response.weakeningAnalysis}</p>
                  </div>
                )}

                {gemmaResult.response.suggestedEdgeCases && gemmaResult.response.suggestedEdgeCases.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                      <span>Suggested Edge Cases</span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">Review Required</span>
                    </div>
                    {gemmaResult.response.suggestedEdgeCases.map((ec, idx) => (
                      <div key={idx} className="p-2 rounded bg-surface-subtle border border-border-default space-y-1 text-xs font-mono">
                        <div className="text-text-primary font-bold">{ec.description}</div>
                        <div className="text-[11px] text-blue-600 dark:text-[#58A6FF] break-all select-all">{ec.suggestedCheck}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!gemmaResult && !gemmaLoading && !gemmaError && (
              <motion.button
                whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                onClick={handleRequestGemmaReview}
                data-testid="request-gemma-review-btn"
                className="w-full py-2 px-3 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs font-medium flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Request Gemma Semantic Review</span>
              </motion.button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}
