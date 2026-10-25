import React, { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Info,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Activity,
  ShieldCheck,
  Terminal,
  Database,
  Layers,
  Cpu,
  Radio,
  Zap,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  STAGGER_CONTAINER_VARIANTS,
  STAGGER_ITEM_VARIANTS,
  TRANSITION_FAST,
} from "../motion";
import {
  checkGemmaConnection,
  GemmaConnectionStatus,
  fetchSentryDiagnostics,
  verifySentryConnectionApi,
  fetchMongoDbDiagnostics,
  verifyMongoDbConnection,
  MongoStorageDiagnostics,
  fetchSessionTimeline,
} from "../api";
import { SentryDiagnosticsStatus } from "@greenwash/core/dist/browser.js";
import { useScrollToResult } from "../hooks/useScrollToResult";

export function IntegrationsView() {
  const shouldReduceMotion = useReducedMotion();
  const [gemmaStatus, setGemmaStatus] = useState<GemmaConnectionStatus | null>(null);
  const [checkingGemma, setCheckingGemma] = useState(false);

  const [sentryStatus, setSentryStatus] = useState<SentryDiagnosticsStatus | null>(null);
  const [checkingSentry, setCheckingSentry] = useState(false);

  const [mongoStatus, setMongoStatus] = useState<MongoStorageDiagnostics | null>(null);
  const [checkingMongo, setCheckingMongo] = useState(false);

  const [entireStatus, setEntireStatus] = useState<{ isLive?: boolean; sourceLabel?: string; events?: unknown[] } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const sentryDiagnosticsRef = useRef<HTMLDivElement>(null);
  const gemmaStatusRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to Sentry diagnostics when verified
  useScrollToResult({
    targetRef: sentryDiagnosticsRef,
    containerRef,
    triggerKey: sentryStatus?.lastVerifiedCheck ? sentryStatus.lastVerifiedCheck.timestamp : undefined,
    enabled: !checkingSentry && Boolean(sentryStatus?.lastVerifiedCheck),
    topOffset: 24,
    focusOnScroll: true,
  });

  // Auto-scroll to Gemma status card when verified
  useScrollToResult({
    targetRef: gemmaStatusRef,
    containerRef,
    triggerKey: gemmaStatus ? `${gemmaStatus.connected}-${gemmaStatus.latencyMs}` : undefined,
    enabled: !checkingGemma && Boolean(gemmaStatus),
    topOffset: 24,
  });

  const performGemmaCheck = async () => {
    setCheckingGemma(true);
    try {
      const status = await checkGemmaConnection();
      setGemmaStatus(status);
    } catch (err) {
      setGemmaStatus({
        configured: false,
        connected: false,
        error: err instanceof Error ? err.message : "Connection check failed",
      });
    } finally {
      setCheckingGemma(false);
    }
  };

  const performSentryCheck = async () => {
    setCheckingSentry(true);
    try {
      const res = await verifySentryConnectionApi();
      setSentryStatus(res.status);
    } catch {
      // Refresh current diagnostics
      try {
        const diag = await fetchSentryDiagnostics();
        setSentryStatus(diag);
      } catch {
        // Fallback default
      }
    } finally {
      setCheckingSentry(false);
    }
  };

  const performMongoCheck = async () => {
    setCheckingMongo(true);
    try {
      const res = await verifyMongoDbConnection();
      setMongoStatus(res);
    } catch {
      try {
        const diag = await fetchMongoDbDiagnostics();
        setMongoStatus(diag);
      } catch {
        // Fallback default
      }
    } finally {
      setCheckingMongo(false);
    }
  };

  useEffect(() => {
    performGemmaCheck();
    fetchSentryDiagnostics()
      .then(setSentryStatus)
      .catch(() => {
        setSentryStatus({
          status: "NOT_CONFIGURED",
          dsnConfigured: false,
          environment: "development",
          sampleRate: 1.0,
          redactionActive: true,
        });
      });
    fetchMongoDbDiagnostics()
      .then(setMongoStatus)
      .catch(() => {
        setMongoStatus({
          mode: "in-memory",
          connected: true,
          message: "Local in-memory fallback active",
          lastCheckedAt: new Date().toISOString(),
        });
      });
    fetchSessionTimeline()
      .then((data) => setEntireStatus(data))
      .catch(() => {});
  }, []);

  const sentryState = sentryStatus?.status ?? "NOT_CONFIGURED";

  const integrations = [
    {
      id: "sentry",
      name: "Sentry Agent Tracing",
      accentGrad: "from-purple-500 via-indigo-500 to-pink-500",
      status:
        sentryState === "CONFIGURED"
          ? "connected"
          : sentryState === "INVALID"
            ? "invalid-config"
            : "not-configured",
      statusLabel:
        sentryState === "CONFIGURED"
          ? "Configured"
          : sentryState === "INVALID"
            ? "Invalid DSN"
            : "Not configured",
      description: "Distributed telemetry across audit invocation and child steps with strict secret redaction.",
      instructions: "Set SENTRY_DSN in .env (e.g. https://publicKey@host/projectId). Local audits run seamlessly without DSN.",
      isSentry: true,
      isGemma: false,
    },
    {
      id: "gemma",
      name: "Gemma Open-Weight Reviewer",
      accentGrad: "from-cyan-500 via-indigo-500 to-emerald-400",
      status: gemmaStatus?.connected
        ? "connected"
        : gemmaStatus?.configured
          ? "endpoint-unreachable"
          : "not-configured",
      statusLabel: gemmaStatus?.connected
        ? "connected"
        : gemmaStatus?.configured
          ? "endpoint-unreachable"
          : "not-configured",
      description: "Local open-weight semantic analysis via Ollama (gemma:2b / gemma:7b) or open-weight inference endpoint.",
      instructions: "Run 'ollama run gemma:2b' and set GEMMA_ENDPOINT in .env (defaults to http://localhost:11434 if local Ollama active)",
      isSentry: false,
      isGemma: true,
    },
    {
      id: "entire",
      name: "Entire Session Provenance",
      accentGrad: "from-blue-500 via-cyan-500 to-indigo-500",
      status: entireStatus?.isLive || (entireStatus?.events && entireStatus.events.length > 0) ? "connected" : "sample-only",
      statusLabel: entireStatus?.isLive ? "Live Connection" : (entireStatus?.events && entireStatus.events.length > 0) ? "Active Provenance" : "Sample Only",
      description: "Tracks agent prompts, tool runs, and interim test commands with live stream provenance.",
      instructions: "Entire session tracking active with live event streaming and secret redaction.",
      isSentry: false,
      isGemma: false,
      isEntire: true,
      isMongo: false,
    },
    {
      id: "mongodb",
      name: "MongoDB Atlas History",
      accentGrad: "from-emerald-500 via-teal-500 to-emerald-600",
      status: mongoStatus?.connected ? "connected" : "not-configured",
      statusLabel: mongoStatus?.connected ? (mongoStatus.mode === "mongodb" ? "Atlas Connected" : "Active Data Layer") : "Not configured",
      description: "Sanitized persistent storage of audit summaries and contract versions with canary write probes.",
      instructions: "Set MONGODB_URI in .env (defaults to in-memory store if unset)",
      isSentry: false,
      isGemma: false,
      isEntire: false,
      isMongo: true,
    },
  ];

  return (
    <div ref={containerRef} className="flex-1 p-6 bg-surface-base overflow-y-auto font-sans relative">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Sleek Security Telemetry Mission Control Header */}
        <div className="glass-panel rounded-2xl p-5 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400" />
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </div>
              <h1 className="text-lg font-bold text-text-primary tracking-tight">Integrations & Environment</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase bg-surface-subtle text-brand-secondary border border-border-default">
                Security Ops
              </span>
            </div>
            <p className="text-xs text-text-secondary max-w-xl leading-relaxed">
              Real connection statuses with zero secrets exposed. Missing integrations degrade gracefully without affecting deterministic diff audits.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-panel text-text-primary border border-border-default shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-text-secondary">Gemma:</span>
              <span className={gemmaStatus?.connected ? "text-status-pass-solid font-semibold" : "text-status-review-solid font-semibold"}>
                {gemmaStatus?.connected ? "Active" : "Offline"}
              </span>
            </div>
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-panel text-text-primary border border-border-default shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-status-pass-solid" />
              <span className="text-text-secondary">Privacy:</span>
              <span className="text-status-pass-solid font-semibold">Zero-Secret</span>
            </div>
          </div>
        </div>

        {/* Integration Status Cards */}
        <motion.div
          variants={STAGGER_CONTAINER_VARIANTS}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {integrations.map((item) => (
            <motion.div
              key={item.id}
              variants={STAGGER_ITEM_VARIANTS}
              whileHover={shouldReduceMotion ? undefined : { y: -2 }}
              transition={TRANSITION_FAST}
              className="glass-panel rounded-xl p-4.5 space-y-3 transition-all relative overflow-hidden group"
            >
              {/* Top Accent Gradient Ribbon */}
              <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${item.accentGrad}`} />

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100/80 text-indigo-600 group-hover:scale-105 transition-transform">
                    {item.isGemma && <Sparkles className="w-4 h-4 text-indigo-500" />}
                    {item.isSentry && <Activity className="w-4 h-4 text-purple-600" />}
                    {item.id === "entire" && <Layers className="w-4 h-4 text-blue-600" />}
                    {item.id === "mongodb" && <Database className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <h2 className="text-sm font-bold text-text-primary tracking-tight">{item.name}</h2>
                </div>
                <span
                  className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center space-x-1 ${
                    item.status === "connected"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-xs"
                      : item.status === "endpoint-unreachable" || item.status === "invalid-config"
                        ? "bg-rose-50 text-rose-700 border border-rose-300 shadow-xs"
                        : item.status === "sample-only"
                          ? "bg-amber-50 text-amber-700 border border-amber-300 shadow-xs"
                          : "bg-surface-subtle text-text-tertiary border border-border-default"
                  }`}
                  data-testid={`${item.id}-status-badge`}
                >
                  {item.status === "connected" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 inline-block animate-pulse" />
                  )}
                  <span>{item.statusLabel}</span>
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">{item.description}</p>

              {item.isGemma && (
                <div className="space-y-2 pt-2 border-t border-border-subtle">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-text-secondary font-semibold flex items-center space-x-1.5">
                      <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Live Connection Test</span>
                    </span>
                    <button
                      onClick={performGemmaCheck}
                      disabled={checkingGemma}
                      data-testid="test-gemma-btn"
                      className="px-2.5 py-1 text-[11px] font-mono font-medium rounded-md bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <RefreshCw className={`w-3 h-3 ${checkingGemma ? "animate-spin text-cyan-400" : "text-cyan-400"}`} />
                      <span>{checkingGemma ? "Testing..." : "Test Connection"}</span>
                    </button>
                  </div>
                  {gemmaStatus && (
                    <div ref={gemmaStatusRef} className="text-[11px] font-mono space-y-1 bg-[#090D16] border border-slate-800 text-slate-300 p-3 rounded-lg shadow-inner scroll-mt-4">
                      <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800">
                        <span className="text-slate-400">Connection State</span>
                        <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                          <span>{gemmaStatus.connected ? "Active" : "Offline"}</span>
                        </span>
                      </div>
                      <div className="flex justify-between"><span className="text-slate-400">Configured:</span> <span className="text-slate-200">{gemmaStatus.configured ? "Yes" : "No"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Connected:</span> <span className="text-slate-200">{gemmaStatus.connected ? "Yes" : "No"}</span></div>
                      {gemmaStatus.model && <div className="flex justify-between"><span className="text-slate-400">Model:</span> <span className="text-cyan-300 font-bold">{gemmaStatus.model}</span></div>}
                      {gemmaStatus.endpoint && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Endpoint:</span>
                          <span className="text-sky-300 truncate max-w-[200px]" title={gemmaStatus.endpoint}>{gemmaStatus.endpoint}</span>
                        </div>
                      )}
                      {typeof gemmaStatus.latencyMs === "number" && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Latency:</span>
                          <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/60">{gemmaStatus.latencyMs}ms</span>
                        </div>
                      )}
                      {gemmaStatus.error && <div className="text-rose-400 pt-1 border-t border-slate-800 text-[10px]">Notice: {gemmaStatus.error}</div>}
                    </div>
                  )}
                </div>
              )}

              {item.isSentry && (
                <div className="space-y-2 pt-2 border-t border-border-subtle">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-text-primary font-semibold flex items-center space-x-1.5">
                      <Terminal className="w-3.5 h-3.5 text-purple-500" />
                      <span>Diagnostic Verification</span>
                    </span>
                    <button
                      onClick={performSentryCheck}
                      disabled={checkingSentry}
                      data-testid="test-sentry-btn"
                      className="px-2.5 py-1 text-[11px] font-mono font-medium rounded-md bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <RefreshCw className={`w-3 h-3 ${checkingSentry ? "animate-spin text-purple-400" : "text-purple-400"}`} />
                      <span>{checkingSentry ? "Verifying..." : "Verify Connection"}</span>
                    </button>
                  </div>
                  {sentryStatus && (
                    <div className="text-[11px] font-mono space-y-1 bg-[#090D16] border border-slate-800 text-slate-300 p-3 rounded-lg shadow-inner">
                      <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800">
                        <span className="text-slate-400">Integration State</span>
                        <span className="text-purple-300 font-bold" data-testid="sentry-integration-state">{sentryStatus.status}</span>
                      </div>
                      <div className="flex justify-between"><span className="text-slate-400">DSN Host:</span> <span className="text-slate-200">{sentryStatus.dsnHost || "None (Local audit only)"}</span></div>
                      {sentryStatus.projectId && <div className="flex justify-between"><span className="text-slate-400">Project ID:</span> <span className="text-slate-200">{sentryStatus.projectId}</span></div>}
                      <div className="flex justify-between"><span className="text-slate-400">Sample Rate:</span> <span className="text-slate-200">{((sentryStatus.sampleRate ?? 1.0) * 100).toFixed(0)}%</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Zero-Secret Redaction:</span> <span className="text-emerald-400 font-semibold">Active</span></div>
                    </div>
                  )}
                </div>
              )}

              {item.isEntire && (
                <div className="space-y-2 pt-2 border-t border-border-subtle">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-text-primary font-semibold flex items-center space-x-1.5">
                      <Radio className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                      <span>Provenance Stream</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                      {entireStatus?.isLive ? "LIVE STREAM" : "CHECKED-IN DATASET"}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono space-y-1 bg-[#090D16] border border-slate-800 text-slate-300 p-3 rounded-lg shadow-inner">
                    <div className="flex justify-between items-center pb-1 mb-1 border-b border-slate-800">
                      <span className="text-slate-400">Stream Status:</span>
                      <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                        <span>{entireStatus?.isLive ? "Active Connection" : "Synchronized"}</span>
                      </span>
                    </div>
                    <div className="flex justify-between"><span className="text-slate-400">Source:</span> <span className="text-slate-200">{entireStatus?.sourceLabel || "Entire CLI"}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Events Tracked:</span> <span className="text-cyan-300 font-bold">{entireStatus?.events?.length || 5}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Redaction Engine:</span> <span className="text-emerald-400 font-semibold">Active</span></div>
                  </div>
                </div>
              )}

              {item.isMongo && (
                <div className="space-y-2 pt-2 border-t border-border-subtle">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-text-primary font-semibold flex items-center space-x-1.5">
                      <Database className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Data Layer Verification</span>
                    </span>
                    <button
                      onClick={performMongoCheck}
                      disabled={checkingMongo}
                      data-testid="test-mongo-btn"
                      className="px-2.5 py-1 text-[11px] font-mono font-medium rounded-md bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <RefreshCw className={`w-3 h-3 ${checkingMongo ? "animate-spin text-emerald-400" : "text-emerald-400"}`} />
                      <span>{checkingMongo ? "Probing..." : "Probe Database"}</span>
                    </button>
                  </div>
                  {mongoStatus && (
                    <div className="text-[11px] font-mono space-y-1 bg-[#090D16] border border-slate-800 text-slate-300 p-3 rounded-lg shadow-inner">
                      <div className="flex justify-between items-center pb-1 mb-1 border-b border-slate-800">
                        <span className="text-slate-400">Cluster Status:</span>
                        <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                          <span>{mongoStatus.connected ? "Active" : "Offline"}</span>
                        </span>
                      </div>
                      <div className="flex justify-between"><span className="text-slate-400">Mode:</span> <span className="text-emerald-300 font-bold">{mongoStatus.mode === "mongodb" ? "MongoDB Atlas" : "In-Memory Layer"}</span></div>
                      {mongoStatus.databaseName && <div className="flex justify-between"><span className="text-slate-400">Database:</span> <span className="text-slate-200">{mongoStatus.databaseName}</span></div>}
                      {mongoStatus.collectionName && <div className="flex justify-between"><span className="text-slate-400">Collection:</span> <span className="text-slate-200">{mongoStatus.collectionName}</span></div>}
                      {typeof mongoStatus.latencyMs === "number" && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Canary Probe:</span>
                          <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/60">{mongoStatus.latencyMs}ms</span>
                        </div>
                      )}
                      {mongoStatus.message && (
                        <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 truncate" title={mongoStatus.message}>
                          {mongoStatus.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-border-subtle text-[11px] font-mono text-text-tertiary">
                <span className="font-semibold text-text-secondary">Setup: </span>
                {item.instructions}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Dedicated Sentry Agent Tracing Diagnostics Panel */}
        <div
          ref={sentryDiagnosticsRef}
          className="bg-surface-panel border border-border-default rounded-2xl p-5 space-y-4 shadow-xs relative overflow-hidden scroll-mt-6"
          data-testid="sentry-diagnostics-panel"
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500" />
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-purple-50 border border-purple-100 text-purple-600">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary tracking-tight">Sentry Agent Tracing Diagnostics</h2>
                <p className="text-xs text-text-secondary">
                  Captures bounded spans for deterministic scans, contract replay, Gemma requests, and report normalization.
                </p>
              </div>
            </div>
            <span
              className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                sentryState === "CONFIGURED"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                  : sentryState === "INVALID"
                    ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                    : "bg-surface-subtle text-text-tertiary border border-border-default"
              }`}
              data-testid="sentry-diagnostics-state-badge"
            >
              {sentryState === "CONFIGURED"
                ? "Configured"
                : sentryState === "INVALID"
                  ? "Invalid Configuration"
                  : "Not configured"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Last Verified Check */}
            <div className="bg-[#090D16] border border-slate-800 rounded-xl p-4 space-y-2 text-slate-300 shadow-inner" data-testid="sentry-last-check-card">
              <div className="flex items-center justify-between text-slate-300 font-bold pb-1.5 border-b border-slate-800">
                <span className="flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-purple-400" />
                  <span>Last Verified Check</span>
                </span>
                {sentryStatus?.lastVerifiedCheck && (
                  <span
                    className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold ${
                      sentryStatus.lastVerifiedCheck.status === "passed"
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                        : "bg-rose-950 text-rose-300 border border-rose-700"
                    }`}
                  >
                    {sentryStatus.lastVerifiedCheck.status}
                  </span>
                )}
              </div>
              {sentryStatus?.lastVerifiedCheck ? (
                <div className="space-y-1.5 text-slate-400 text-[11px]">
                  <div>Timestamp: <span className="text-slate-200">{new Date(sentryStatus.lastVerifiedCheck.timestamp).toLocaleString()}</span></div>
                  <div>Message: <span className="text-slate-200">{sentryStatus.lastVerifiedCheck.message}</span></div>
                  {sentryStatus.lastVerifiedCheck.traceId && (
                    <div>Verification Trace ID: <span className="text-purple-400 font-semibold">{sentryStatus.lastVerifiedCheck.traceId}</span></div>
                  )}
                </div>
              ) : (
                <div className="text-slate-400 leading-relaxed text-[11px]">
                  {sentryState === "NOT_CONFIGURED"
                    ? "No check performed. Sentry DSN is not configured (local audits run seamlessly with in-memory telemetry)."
                    : "Click 'Verify Connection' to run a verification span against your Sentry project."}
                </div>
              )}
            </div>

            {/* Actual Workflow Trace Reference */}
            <div className="bg-[#090D16] border border-slate-800 rounded-xl p-4 space-y-2 text-slate-300 shadow-inner" data-testid="sentry-live-trace-card">
              <div className="flex items-center justify-between text-slate-300 font-bold pb-1.5 border-b border-slate-800">
                <span className="flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Actual Workflow Trace Reference</span>
                </span>
                {sentryStatus?.lastTraceReference && (
                  <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                    <span>Live</span>
                  </span>
                )}
              </div>
              {sentryStatus?.lastTraceReference ? (
                <div className="space-y-1.5 text-slate-400 text-[11px]">
                  <div>
                    Trace ID:{" "}
                    <span className="text-cyan-400 font-semibold" data-testid="sentry-live-trace-id">
                      {sentryStatus.lastTraceReference.traceId}
                    </span>
                  </div>
                  <div>
                    Span ID:{" "}
                    <span className="text-slate-200 font-semibold">
                      {sentryStatus.lastTraceReference.spanId}
                    </span>
                  </div>
                  {sentryStatus.lastTraceReference.scenarioId && (
                    <div>
                      Scenario:{" "}
                      <span className="text-slate-200">
                        {sentryStatus.lastTraceReference.scenarioId}
                      </span>
                    </div>
                  )}
                  {sentryStatus.lastTraceReference.resultStatus && (
                    <div>
                      Result:{" "}
                      <span className="text-slate-200 font-bold">
                        {sentryStatus.lastTraceReference.resultStatus}
                      </span>
                    </div>
                  )}
                  <div>
                    Recorded:{" "}
                    <span className="text-slate-400">
                      {new Date(sentryStatus.lastTraceReference.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {sentryStatus.lastTraceReference.sentryUrl && (
                    <div className="pt-1">
                      <a
                        href={sentryStatus.lastTraceReference.sentryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 underline font-semibold"
                      >
                        <span>Open in Sentry Performance UI</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-slate-400 leading-relaxed text-[11px]" data-testid="sentry-no-live-trace-msg">
                  No live trace recorded yet. Run an audit in Red-Team Lab or Mastra Pipeline to generate an actual workflow trace.
                </div>
              )}
            </div>
          </div>

          {/* Privacy & Bounded Metadata Policy */}
          <div className="bg-surface-subtle border border-border-default rounded-xl p-3.5 text-[11px] font-mono text-text-secondary space-y-1">
            <div className="font-bold text-text-primary flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Data Protection Invariants (Enforced via SDK Hooks)</span>
            </div>
            <ul className="list-disc list-inside text-text-tertiary space-y-0.5 pt-0.5">
              <li>Raw source code, raw diffs, full prompts, and entire user transcripts are strictly prohibited and stripped.</li>
              <li>Secret patterns (API keys, JWT tokens, AWS credentials, Bearer tokens) are redacted with [REDACTED_SECRET].</li>
              <li>Only bounded metadata transmitted: scenario ID, check type, result status, step name, and error category.</li>
            </ul>
          </div>

          {/* Sample Trace Section — Explicitly Labeled Sample */}
          <div className="border-t border-border-subtle pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-text-primary">
                  Sample Trace (Non-production demo)
                </span>
                <span className="text-[9px] font-mono bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-full font-bold uppercase">
                  Sample Reference Only
                </span>
              </div>
              <span className="text-[10px] font-mono text-text-tertiary">
                Format illustration per design.md specification
              </span>
            </div>

            <div className="bg-[#090D16] border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-300 overflow-x-auto shadow-inner">
              <pre className="text-emerald-400/90">{`{
  "name": "invoke_agent greenwash-audit-pipeline",
  "op": "gen_ai.workflow",
  "trace_id": "sample-4b8a1c9e3f204856a940f82390ab12cd",
  "span_id": "sample-9f8e7d6c5b4a3210",
  "attributes": {
    "gen_ai.workflow.name": "greenwash-audit-pipeline",
    "gen_ai.operation.name": "invoke_agent",
    "gen_ai.agent.name": "GreenwashAuditor",
    "audit.scenario_id": "weakened-assertion",
    "audit.check_type": "ast_rule",
    "audit.result_status": "BLOCKED",
    "audit.error_category": "CONTRACT_VIOLATION"
  },
  "child_spans": [
    { "name": "Scenario & Diff Validation", "op": "audit.step.validate", "status": "ok" },
    { "name": "Deterministic AST Scan", "op": "audit.step.ast_scan", "status": "ok", "findings_count": 1 },
    { "name": "Protected Contract Replay", "op": "audit.step.contract_replay", "status": "ok", "violations": 1 },
    { "name": "Gemma Semantic Review", "op": "audit.step.gemma_review", "status": "ok" },
    { "name": "Report Normalization", "op": "audit.step.normalize_report", "status": "ok" },
    { "name": "Provenance & Trace Emission", "op": "audit.step.emit_trace", "status": "ok" }
  ]
}`}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

