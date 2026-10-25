import React, { useState, useRef } from "react";
import { useScrollToResult } from "../hooks/useScrollToResult";
import {
  Play,
  ArrowRight,
  AlertOctagon,
  CheckCircle2,
  Clock,
  RotateCcw,
  FileCode,
  ShieldCheck,
  Sparkles,
  Octagon,
  AlertTriangle,
  RotateCw,
  FileX,
  SkipForward,
  Cpu,
  GitCommit,
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Layers,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ScenarioItem } from "../api";
import { AuditReport } from "@greenwash/core/dist/browser.js";
import {
  STAGGER_CONTAINER_VARIANTS,
  STAGGER_ITEM_VARIANTS,
  TRANSITION_PANEL,
  TRANSITION_FAST,
  VERDICT_PULSE_VARIANTS,
} from "../motion";

function AnimatedCounter({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  React.useEffect(() => {
    let start = 0;
    const duration = 350;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      setDisplayValue(Math.round(progress * value));
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [value]);

  return <span>{displayValue}</span>;
}

export type AuditExecutionState =
  | "idle"
  | "validating"
  | "running"
  | "completed"
  | "error"
  | "timeout";

export interface AuditStageProgress {
  stageId: string;
  label: string;
  status: "waiting" | "running" | "passed" | "blocked" | "skipped";
}

interface DemoLabProps {
  scenarios: ScenarioItem[];
  selectedScenarioId: string;
  onSelectScenario: (id: string) => void;
  onRunAudit: () => void;
  auditState: AuditExecutionState;
  auditStages?: AuditStageProgress[];
  report: AuditReport | null;
  errorMessage: string | null;
  onNavigateToWorkbench: () => void;
  onNavigateToPipeline?: () => void;
  onRetry: () => void;
}

/**
 * Returns a semantic forensic security icon matching the threat category
 */
function getScenarioIcon(id: string) {
  switch (id) {
    case "weakened-assertion":
      return <AlertOctagon className="w-4 h-4 text-status-blocked-solid shrink-0" />;
    case "deleted-test":
      return <FileX className="w-4 h-4 text-status-blocked-solid shrink-0" />;
    case "skipped-test":
      return <SkipForward className="w-4 h-4 text-status-blocked-solid shrink-0" />;
    case "excessive-mocking":
      return <Cpu className="w-4 h-4 text-status-review-solid shrink-0" />;
    case "weakened-ci-gate":
      return <GitCommit className="w-4 h-4 text-status-blocked-solid shrink-0" />;
    case "honest-fix":
      return <ShieldCheck className="w-4 h-4 text-status-pass-solid shrink-0" />;
    default:
      return <AlertTriangle className="w-4 h-4 text-text-secondary shrink-0" />;
  }
}

/**
 * Punchy 1-line summary to keep scenario cards crisp and readable
 */
function getScenarioShortSummary(id: string, fallback: string) {
  switch (id) {
    case "weakened-assertion":
      return "Assertion threshold relaxed from strict range to always true.";
    case "deleted-test":
      return "Failing regression test deleted to artificially turn suite green.";
    case "skipped-test":
      return "Active test suite marked with it.skip / xit to bypass CI.";
    case "excessive-mocking":
      return "Core business logic replaced with static hardcoded stub.";
    case "weakened-ci-gate":
      return "GitHub Actions CI exit code / threshold silenced to force pass.";
    case "honest-fix":
      return "Algorithmic root cause bugfix preserving verified contracts.";
    default:
      return fallback.split(".")[0] + ".";
  }
}

export function DemoLab({
  scenarios,
  selectedScenarioId,
  onSelectScenario,
  onRunAudit,
  auditState,
  auditStages = [],
  report,
  errorMessage,
  onNavigateToWorkbench,
  onNavigateToPipeline,
  onRetry,
}: DemoLabProps) {
  const activeScenario = scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];
  const isRunning = auditState === "running" || auditState === "validating";
  const shouldReduceMotion = useReducedMotion();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      setCopiedKey(null);
    }
  };

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const filteredScenarios =
    categoryFilter === "all"
      ? scenarios
      : categoryFilter === "honest"
        ? scenarios.filter((s) => s.expectedOutcome === "PASS")
        : categoryFilter === "ci"
          ? scenarios.filter((s) => s.threatCategory === "ci-gate-integrity")
          : scenarios.filter((s) => s.threatCategory === "test-integrity");

  const containerRef = useRef<HTMLDivElement>(null);
  const resultCardRef = useRef<HTMLDivElement>(null);
  const errorCardRef = useRef<HTMLDivElement>(null);
  const runningStagesRef = useRef<HTMLDivElement>(null);
  const contextPanelRef = useRef<HTMLDivElement>(null);

  // 1. Auto-scroll to result card when audit completes
  useScrollToResult({
    targetRef: resultCardRef,
    containerRef,
    triggerKey: report ? `${report.id || report.createdAt || selectedScenarioId}-${report.status}` : undefined,
    enabled: Boolean(report) && !isRunning,
    topOffset: 24,
    focusOnScroll: true,
  });

  // 2. Auto-scroll to error banner if audit execution fails
  useScrollToResult({
    targetRef: errorCardRef,
    containerRef,
    triggerKey: errorMessage ? `error-${errorMessage}` : undefined,
    enabled: auditState === "error" && Boolean(errorMessage),
    topOffset: 24,
    focusOnScroll: true,
  });

  // 3. Auto-scroll to running stages panel when an audit starts
  useScrollToResult({
    targetRef: runningStagesRef,
    containerRef,
    triggerKey: isRunning ? `running-${selectedScenarioId}` : undefined,
    enabled: isRunning,
    topOffset: 24,
  });

  // 4. Auto-scroll to scenario context panel when user switches scenarios
  useScrollToResult({
    targetRef: contextPanelRef,
    containerRef,
    triggerKey: selectedScenarioId,
    enabled: !isRunning,
    topOffset: 24,
  });

  return (
    <div
      ref={containerRef}
      className="flex-1 p-6 sm:p-8 overflow-y-auto font-sans relative z-10"
      role="region"
      aria-label="Red-Team Demo Lab"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ── 1. Hero Section: Command Center Security Workbench ── */}
        <div className="bg-surface-panel/95 backdrop-blur-md border border-border-default/80 rounded-2xl p-6 sm:p-7 shadow-xs relative overflow-hidden">
          {/* Subtle top progress sweep during running audits */}
          {isRunning && (
            <motion.div
              className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
            />
          )}

          {/* Delicate Abstract Security Shield Visual in Background */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20 hidden md:block">
            <svg
              width="240"
              height="240"
              viewBox="0 0 200 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="hero-shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="#818CF8" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#C084FC" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              <path
                d="M 100,20 L 170,50 C 170,120 125,165 100,185 C 75,165 30,120 30,50 Z"
                stroke="url(#hero-shield-grad)"
                strokeWidth="2.5"
                fill="none"
              />
              <path
                d="M 100,45 L 145,65 C 145,110 115,145 100,160 C 85,145 55,110 55,65 Z"
                stroke="#6366F1"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                fill="none"
              />
              <circle cx="100" cy="100" r="16" stroke="#818CF8" strokeWidth="1" fill="none" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-mono text-[11px] font-semibold tracking-wide uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                  <span>Demo Lab</span>
                </span>
                <span className="text-xs text-text-tertiary">·</span>
                <span className="text-xs text-amber-800 font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                  Sample Benchmark Data
                </span>
                <span className="text-xs text-text-tertiary">·</span>
                <span className="text-xs text-text-secondary font-mono">
                  Zero-Credential Safe Mode
                </span>
              </div>

              {/* Main Headline with accessible text and restrained indigo-to-blue gradient */}
              <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight leading-tight sm:leading-snug">
                <span className="sr-only">Can you trust this green build?</span>
                <span aria-hidden="true">
                  Can you trust this{" "}
                  <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 bg-clip-text text-transparent">
                    green build?
                  </span>
                </span>
              </h1>

              {/* Scannable Supporting Paragraph */}
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed max-w-xl">
                Detect AI test tampering, weakened assertions, and skipped suites before candidate code merges.
              </p>

              {/* Core Security Value Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] font-mono text-text-secondary">
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-surface-subtle border border-border-default">
                  <ShieldCheck className="w-3 h-3 text-brand-secondary" />
                  <span>AST Invariants</span>
                </span>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-surface-subtle border border-border-default">
                  <Layers className="w-3 h-3 text-brand-secondary" />
                  <span>Contract Replay</span>
                </span>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-surface-subtle border border-border-default">
                  <Cpu className="w-3 h-3 text-brand-secondary" />
                  <span>Zero-Secret Sandbox</span>
                </span>
              </div>
            </div>

            {/* Run Audit CTA Button */}
            <div className="shrink-0 flex flex-col items-start md:items-end space-y-1.5">
              <motion.button
                onClick={onRunAudit}
                disabled={isRunning}
                data-testid="lab-run-audit-btn"
                whileHover={shouldReduceMotion || isRunning ? {} : { scale: 1.02, transition: { duration: 0.14 } }}
                whileTap={shouldReduceMotion || isRunning ? {} : { scale: 0.97, transition: { duration: 0.08 } }}
                className="h-10 px-5 rounded-lg bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-emerald-700 dark:via-teal-800 dark:to-emerald-700 hover:opacity-95 text-white font-mono text-xs font-semibold flex items-center space-x-2.5 transition-all disabled:opacity-50 shadow-sm hover:shadow-md cursor-pointer border border-indigo-400/30 dark:border-emerald-400/30 relative overflow-hidden group"
              >
                {/* Subtle sheen highlight pass */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                {isRunning ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin text-indigo-300" />
                    <span>Auditing AST & Contracts…</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
                    <span>Run Integrity Audit (R)</span>
                  </>
                )}
              </motion.button>
              <span className="text-[10px] font-mono text-text-tertiary">
                Press <kbd className="px-1 py-0.2 bg-surface-subtle border border-border-default rounded text-text-secondary">R</kbd> or <kbd className="px-1 py-0.2 bg-surface-subtle border border-border-default rounded text-text-secondary">⌘+Enter</kbd>
              </span>
            </div>
          </div>
        </div>

        {/* ── 2. Threat Scenario Cards Grid with Category Filters ── */}
        {/* ── 2. Threat Scenario Cards Grid with Category Filters ── */}
        <div className="space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xs font-mono font-bold text-text-secondary uppercase tracking-wider flex items-center space-x-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-brand-secondary" />
              <span>Select Threat Scenario ({scenarios.length})</span>
            </h2>

            {/* Category Filter Pills with Sliding Animation */}
            <div className="p-1 rounded-lg bg-surface-subtle border border-border-default/80 flex items-center space-x-1 text-xs font-mono">
              {[
                { id: "all", label: `All (${scenarios.length})` },
                { id: "test", label: "Test Tampering (4)" },
                { id: "ci", label: "CI Pipeline (1)" },
                { id: "honest", label: "Clean Fix (1)" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setCategoryFilter(f.id)}
                  className={`relative px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    categoryFilter === f.id
                      ? "text-white font-semibold"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-panel/60"
                  }`}
                >
                  {categoryFilter === f.id && (
                    <motion.div
                      layoutId="demolab-category-pill"
                      className="absolute inset-0 bg-slate-900 dark:bg-emerald-600/90 rounded-md -z-10 shadow-2xs"
                      transition={{ type: "spring", stiffness: 420, damping: 28 }}
                    />
                  )}
                  <span className="relative z-10">{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={shouldReduceMotion ? undefined : STAGGER_CONTAINER_VARIANTS}
            initial="hidden"
            animate="visible"
          >
            {filteredScenarios.map((s) => {
              const isSelected = s.id === selectedScenarioId;
              const isHonest = s.expectedOutcome === "PASS";
              const isBlocked = s.expectedOutcome === "BLOCKED";

              return (
                <motion.div
                  key={s.id}
                  variants={shouldReduceMotion ? undefined : STAGGER_ITEM_VARIANTS}
                  whileHover={
                    shouldReduceMotion
                      ? undefined
                      : { y: -2.5, transition: { type: "spring", stiffness: 420, damping: 26 } }
                  }
                  whileTap={
                    shouldReduceMotion
                      ? undefined
                      : { scale: 0.985, transition: { duration: 0.08 } }
                  }
                  onClick={() => !isRunning && onSelectScenario(s.id)}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!isRunning) onSelectScenario(s.id);
                    }
                  }}
                  data-testid={`scenario-card-${s.id}`}
                  className={`p-5 rounded-xl border text-left cursor-pointer flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-brand-primary/30 select-none relative group transition-all duration-200 overflow-hidden shadow-2xs ${
                    isSelected
                      ? "bg-surface-panel border-brand-primary shadow-md ring-2 ring-brand-primary/20"
                      : "bg-surface-panel border-border-default hover:border-border-strong hover:shadow-xs"
                  }`}
                >
                  {/* Subtle Top Luminous Status Strip */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 transition-opacity ${
                      isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-40"
                    } ${
                      isHonest
                        ? "bg-status-pass-solid"
                        : isBlocked
                          ? "bg-status-blocked-solid"
                          : "bg-status-review-solid"
                    }`}
                  />

                  {/* Top: Icon + Title + Status Pill */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center space-x-2 min-w-0">
                        {getScenarioIcon(s.id)}
                        <span className="font-mono text-xs font-bold text-text-primary truncate">
                          {s.title}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          isHonest
                            ? "bg-status-pass-bg text-status-pass-text border border-status-pass-border"
                            : isBlocked
                              ? "bg-status-blocked-bg text-status-blocked-text border border-status-blocked-border"
                              : "bg-status-review-bg text-status-review-text border border-status-review-border"
                        }`}
                      >
                        Expected: {s.expectedOutcome}
                      </span>
                    </div>

                    <p className="text-xs text-text-secondary leading-snug line-clamp-2">
                      {getScenarioShortSummary(s.id, s.description)}
                    </p>
                  </div>

                  {/* Footer: Threat Category & Selection Feedback */}
                  <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-[10px] font-mono text-text-tertiary">
                    <span className="px-2 py-0.5 rounded-md bg-surface-subtle text-text-secondary border border-border-default font-medium">
                      {s.threatCategory}
                    </span>
                    {isSelected ? (
                      <span className="text-brand-primary font-bold flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="text-text-tertiary group-hover:text-text-primary flex items-center space-x-0.5 transition-colors">
                        <span>Inspect scenario</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* ── 3. Upgraded Scenario Context Panel (Forensic Technical Inspector) ── */}
        <AnimatePresence mode="wait">
          <motion.div
            ref={contextPanelRef}
            key={activeScenario?.id || "context"}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={TRANSITION_PANEL}
            className="bg-surface-panel border border-border-default rounded-xl p-5 space-y-3.5 shadow-2xs scroll-mt-6"
          >
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-border-subtle gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-6 h-6 rounded bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600">
                  <FileCode className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-text-primary">
                      Scenario Fixture Context: {activeScenario?.title}
                    </span>
                    <span className="text-[10px] font-mono bg-surface-subtle border border-border-default px-1.5 py-0.2 rounded text-text-secondary">
                      {activeScenario?.threatCategory}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-[11px] font-mono">
                <span className="text-text-tertiary">Expected Outcome:</span>
                <span
                  className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                    activeScenario?.expectedOutcome === "PASS"
                      ? "bg-status-pass-bg text-status-pass-text border border-status-pass-border"
                      : activeScenario?.expectedOutcome === "BLOCKED"
                        ? "bg-status-blocked-bg text-status-blocked-text border border-status-blocked-border"
                        : "bg-status-review-bg text-status-review-text border border-status-review-border"
                  }`}
                >
                  {activeScenario?.expectedOutcome}
                </span>
                <button
                  onClick={onNavigateToWorkbench}
                  className="px-2.5 py-1 text-xs font-mono text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded border border-indigo-200 flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  <span>Inspect in Diff Viewer</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Summary Line */}
            <div className="flex items-center space-x-2 text-xs text-text-secondary flex-wrap gap-y-1">
              <span className="font-semibold text-text-primary shrink-0">Summary:</span>
              <span>{getScenarioShortSummary(activeScenario?.id || "", activeScenario?.description || "")}</span>
            </div>

            {/* Technical Metadata Grid */}
            <div className="pt-1 grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs font-mono">
              {/* Target Fixture */}
              <div className="p-3.5 rounded-xl bg-surface-subtle/80 border border-border-default/70 flex flex-col justify-between space-y-1.5 transition-colors hover:border-border-strong">
                <div className="flex items-center justify-between text-text-tertiary text-[10px] uppercase font-bold tracking-wider">
                  <span>Target Fixture</span>
                  <button
                    onClick={() => handleCopy(activeScenario?.fixturePath || "", "fixture")}
                    className="hover:text-text-primary flex items-center space-x-1 cursor-pointer transition-colors"
                    title="Copy path"
                  >
                    {copiedKey === "fixture" ? (
                      <Check className="w-3 h-3 text-status-pass-solid" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedKey === "fixture" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="text-[11px] text-text-secondary truncate font-mono" title={activeScenario?.fixturePath}>
                  {activeScenario?.fixturePath}
                </div>
              </div>

              {/* Diff Path */}
              <div className="p-3.5 rounded-xl bg-surface-subtle/80 border border-border-default/70 flex flex-col justify-between space-y-1.5 transition-colors hover:border-border-strong">
                <div className="flex items-center justify-between text-text-tertiary text-[10px] uppercase font-bold tracking-wider">
                  <span>Diff Patch</span>
                  <button
                    onClick={() => handleCopy(activeScenario?.diffPath || "", "diff")}
                    className="hover:text-text-primary flex items-center space-x-1 cursor-pointer transition-colors"
                    title="Copy diff path"
                  >
                    {copiedKey === "diff" ? (
                      <Check className="w-3 h-3 text-status-pass-solid" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedKey === "diff" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="text-[11px] text-text-secondary truncate font-mono" title={activeScenario?.diffPath}>
                  {activeScenario?.diffPath}
                </div>
              </div>

              {/* Target Rules */}
              <div className="p-3.5 rounded-xl bg-surface-subtle/80 border border-border-default/70 flex flex-col justify-between space-y-1.5 transition-colors hover:border-border-strong">
                <div className="text-text-tertiary text-[10px] uppercase font-bold tracking-wider">
                  Target Rules
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeScenario?.expectedRuleIds && activeScenario.expectedRuleIds.length > 0 ? (
                    activeScenario.expectedRuleIds.map((r) => (
                      <span
                        key={r}
                        className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-emerald-950/40 border border-indigo-200 dark:border-emerald-800 text-indigo-700 dark:text-emerald-300 font-bold"
                      >
                        {r}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-text-tertiary font-mono">None (honest fix)</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ── 4. Running Progress State with Multi-Stage Check Reveals ── */}
        <AnimatePresence>
          {isRunning && (
            <motion.div
              ref={runningStagesRef}
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
              transition={TRANSITION_FAST}
              data-testid="audit-running-stages-panel"
              className="bg-surface-panel border border-brand-primary/40 rounded-xl p-6 space-y-3.5 relative overflow-hidden shadow-xs scroll-mt-6"
            >
              {/* Dynamic Scanning Beam Sweep */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl">
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-brand-primary to-transparent animate-scan-beam" />
              </div>

              <motion.div
                className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
              />

              <div className="flex items-center justify-between border-b border-border-default pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                    <RotateCw className="w-4 h-4 animate-spin" />
                  </div>
                  <div>
                    <h2 className="text-xs font-mono font-bold text-text-primary uppercase tracking-wide">
                      Auditing Integrity & Contract Guarantees…
                    </h2>
                    <p className="text-[11px] text-text-secondary">
                      Evaluating candidate patch for {activeScenario?.title}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-primary text-white dark:text-slate-950 font-bold animate-pulse">
                  IN PROGRESS
                </span>
              </div>

              {/* Multi-Stage Check Rows */}
              <div className="space-y-2 pt-1 text-xs font-mono">
                {(auditStages.length > 0
                  ? auditStages
                  : [
                      { stageId: "diff-validation", label: "Diff AST & Syntax Validation", status: "running" as const },
                      { stageId: "ast-rules", label: "Deterministic AST Inspection Rules", status: "waiting" as const },
                      { stageId: "contract-replay", label: "Protected Invariant Contract Replay", status: "waiting" as const },
                      { stageId: "normalization", label: "Report Normalization & Tri-state Verdict", status: "waiting" as const },
                    ]
                ).map((st) => (
                  <motion.div
                    key={st.stageId}
                    initial={shouldReduceMotion ? false : { opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={TRANSITION_FAST}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                      st.status === "running"
                        ? "bg-surface-subtle border-brand-primary/40 shadow-2xs"
                        : st.status === "blocked"
                          ? "bg-red-50/50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60"
                          : st.status === "passed"
                            ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60"
                            : "bg-surface-subtle/60 border-border-default text-text-tertiary"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      {st.status === "running" && (
                        <RotateCw className="w-3.5 h-3.5 animate-spin text-brand-primary shrink-0" />
                      )}
                      {st.status === "passed" && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-status-pass-solid shrink-0" />
                      )}
                      {st.status === "blocked" && (
                        <Octagon className="w-3.5 h-3.5 fill-current text-status-blocked-solid shrink-0" />
                      )}
                      {st.status === "waiting" && (
                        <Clock className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                      )}
                      <span
                        className={
                          st.status === "running"
                            ? "font-bold text-text-primary"
                            : st.status === "blocked"
                              ? "font-medium text-status-blocked-text"
                              : st.status === "passed"
                                ? "text-text-primary"
                                : "text-text-tertiary"
                        }
                      >
                        {st.label}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold font-mono uppercase tracking-wider ${
                        st.status === "running"
                          ? "text-brand-primary animate-pulse"
                          : st.status === "blocked"
                            ? "text-status-blocked-solid"
                            : st.status === "passed"
                              ? "text-status-pass-solid"
                              : "text-text-tertiary"
                      }`}
                    >
                      [{st.status}]
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {!isRunning && !report && (
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={TRANSITION_PANEL}
              className="bg-surface-panel border border-border-default rounded-xl p-6 space-y-4 shadow-2xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border-subtle gap-2">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-mono font-bold text-text-primary uppercase tracking-wide flex items-center space-x-2">
                      <span>Mastra Multi-Stage Verification Pipeline</span>
                      <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-200 dark:border-indigo-800 font-bold">
                        ENGINE READY
                      </span>
                    </h2>
                    <p className="text-[11px] text-text-secondary">
                      Deterministic multi-agent integrity orchestrator running in an isolated zero-credential sandbox
                    </p>
                  </div>
                </div>

                {onNavigateToPipeline && (
                  <button
                    onClick={onNavigateToPipeline}
                    className="px-3 py-1 text-xs font-mono text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded border border-indigo-200 dark:border-indigo-800 flex items-center space-x-1 cursor-pointer transition-colors shrink-0"
                  >
                    <span>View Mastra Trace</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* 4 Architectural Pipeline Stage Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-surface-subtle border border-border-default space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-primary flex items-center space-x-1.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                        1
                      </span>
                      <span>Diff AST & Syntax</span>
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">[Ready]</span>
                  </div>
                  <p className="text-[11px] text-text-secondary font-sans truncate">
                    Locates edited test blocks and modified assertion arguments.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-subtle border border-border-default space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-primary flex items-center space-x-1.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                        2
                      </span>
                      <span>Deterministic Rules</span>
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">[Ready]</span>
                  </div>
                  <p className="text-[11px] text-text-secondary font-sans truncate">
                    10 deterministic invariants against test softening and stubbing.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-subtle border border-border-default space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-primary flex items-center space-x-1.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                        3
                      </span>
                      <span>Contract Replay</span>
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">[Ready]</span>
                  </div>
                  <p className="text-[11px] text-text-secondary font-sans truncate">
                    Replays canonical behavioral contracts in an isolated runner.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-subtle border border-border-default space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-primary flex items-center space-x-1.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                        4
                      </span>
                      <span>Tri-State Verdict</span>
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">[Ready]</span>
                  </div>
                  <p className="text-[11px] text-text-secondary font-sans truncate">
                    Synthesizes findings into cryptographic PASS, REVIEW, or BLOCKED.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 5. Error State ── */}
        <AnimatePresence>
          {auditState === "error" && (
            <motion.div
              ref={errorCardRef}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
              transition={TRANSITION_FAST}
              className="bg-status-blocked-bg border border-status-blocked-border rounded-xl p-4 flex items-start justify-between shadow-xs scroll-mt-6"
            >
              <div className="flex items-start space-x-3">
                <AlertOctagon className="w-4 h-4 text-status-blocked-solid shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-semibold text-status-blocked-text font-mono">
                    Audit Execution Error
                  </h3>
                  <p className="text-xs text-status-blocked-text mt-0.5">{errorMessage}</p>
                </div>
              </div>
              <button
                onClick={onRetry}
                className="text-xs font-mono px-2.5 py-1 rounded bg-surface-panel border border-status-blocked-border text-status-blocked-text hover:bg-surface-subtle flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 6. Real Audit Execution Results Card ── */}
        <AnimatePresence>
          {report && !isRunning && (
            <motion.div
              ref={resultCardRef}
              key={report.id || report.createdAt || selectedScenarioId}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
              transition={TRANSITION_PANEL}
              data-testid="lab-result-card"
              className={`border rounded-xl p-6 space-y-4 shadow-sm scroll-mt-6 ${
                report.status === "BLOCKED"
                  ? "bg-red-50/40 dark:bg-red-950/25 border-status-blocked-border"
                  : report.status === "REVIEW"
                    ? "bg-amber-50/40 dark:bg-amber-950/25 border-status-review-border"
                    : "bg-emerald-50/40 dark:bg-emerald-950/25 border-status-pass-border"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span
                      className={`font-mono text-xs font-bold px-2 py-0.5 rounded uppercase flex items-center space-x-1 ${
                        report.status === "BLOCKED"
                          ? "bg-status-blocked-solid text-white dark:text-slate-950"
                          : report.status === "REVIEW"
                            ? "bg-status-review-solid text-white dark:text-slate-950"
                            : "bg-status-pass-solid text-white dark:text-slate-950"
                      }`}
                    >
                      {report.status === "BLOCKED" ? (
                        <Octagon className="w-3 h-3 fill-current" />
                      ) : report.status === "REVIEW" ? (
                        <AlertTriangle className="w-3 h-3 fill-current" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      <span>Audit Verdict: {report.status}</span>
                    </span>
                    <span className="text-xs font-mono text-text-secondary">
                      Scenario: {report.scenarioId}
                    </span>
                    <span className="text-xs font-mono text-text-tertiary">
                      (<AnimatedCounter value={report.findings.length} /> {report.findings.length === 1 ? "finding" : "findings"})
                    </span>
                  </div>
                  <h2 className="text-sm font-semibold text-text-primary mt-2">{report.summary}</h2>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {onNavigateToPipeline && (
                    <motion.button
                      whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                      onClick={onNavigateToPipeline}
                      data-testid="lab-inspect-pipeline-btn"
                      className="h-8 px-3 rounded bg-surface-subtle text-text-primary text-xs font-mono font-medium flex items-center space-x-1.5 hover:bg-surface-panel border border-border-default transition-colors shadow-2xs cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
                      <span>Mastra Trace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                    onClick={onNavigateToWorkbench}
                    data-testid="lab-inspect-workbench-btn"
                    className="h-8 px-3.5 rounded bg-brand-primary text-white dark:text-slate-950 text-xs font-mono font-bold flex items-center space-x-1.5 hover:opacity-90 transition-opacity shadow-2xs cursor-pointer"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Inspect in Workbench</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              </div>

              {/* Staggered Detected Integrity Findings */}
              {report.findings.length > 0 && (
                <div className="pt-2 border-t border-border-default/60">
                  <span className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider">
                    Detected Integrity Findings (<AnimatedCounter value={report.findings.length} />)
                  </span>
                  <motion.div
                    variants={shouldReduceMotion ? undefined : STAGGER_CONTAINER_VARIANTS}
                    initial="hidden"
                    animate="visible"
                    className="mt-3 space-y-2.5"
                  >
                    {report.findings.map((f) => (
                      <motion.div
                        key={f.id}
                        variants={shouldReduceMotion ? undefined : STAGGER_ITEM_VARIANTS}
                        className="p-3.5 rounded-xl bg-surface-panel/90 border border-border-default/80 hover:border-border-strong flex flex-col sm:flex-row sm:items-center justify-between shadow-2xs gap-3 transition-colors duration-150"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase shrink-0 ${
                              f.severity === "critical"
                                ? "bg-status-blocked-solid text-white dark:text-slate-950"
                                : f.severity === "high"
                                  ? "bg-status-blocked-solid/80 text-white dark:text-slate-950"
                                  : "bg-status-review-solid text-white dark:text-slate-950"
                            }`}
                          >
                            {f.severity}
                          </span>
                          <span className="font-mono text-xs font-semibold text-text-primary shrink-0">
                            {f.ruleId}
                          </span>
                          <span className="text-xs text-text-secondary truncate">
                            {f.summary || f.title}
                          </span>
                        </div>
                        <button
                          onClick={onNavigateToWorkbench}
                          className="text-xs font-mono text-brand-secondary hover:underline flex items-center space-x-1 shrink-0 self-end sm:self-auto cursor-pointer"
                        >
                          <span>Inspect Diff</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              )}

              {/* Checks list */}
              <div className="pt-2 border-t border-border-default/60">
                <span className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider">
                  Executed Checks (<AnimatedCounter value={report.checks.length} />)
                </span>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                  {report.checks.map((c) => (
                    <div
                      key={c.id}
                      className="p-2 rounded-lg bg-surface-panel border border-border-default flex items-center justify-between shadow-2xs"
                    >
                      <span className="truncate pr-2 text-text-primary">{c.label}</span>
                      <span
                        className={`text-[10px] font-bold uppercase shrink-0 ${
                          c.status === "passed"
                            ? "text-status-pass-solid"
                            : c.status === "failed"
                              ? "text-status-blocked-solid"
                              : "text-text-tertiary"
                        }`}
                      >
                        [{c.status}]
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Limitations Notice */}
              <div className="text-[11px] text-text-secondary pt-2 border-t border-border-default/60 font-mono">
                <span className="font-bold">Honest Limitations: </span>
                {report.limitations.join(" ")}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
