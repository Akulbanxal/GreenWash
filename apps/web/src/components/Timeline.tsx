import React, { useState, useEffect, useRef } from "react";
import { Terminal, FileEdit, CheckCircle2, XCircle, AlertCircle, AlertTriangle, ShieldAlert, Info, HelpCircle, ExternalLink, Filter, Radio } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FADE_SLIDE_VARIANTS, TRANSITION_FAST } from "../motion";
import { fetchSessionTimeline } from "../api";
import { SessionEvent } from "@greenwash/core/dist/browser.js";
import { useScrollToResult } from "../hooks/useScrollToResult";

const DEFAULT_SETUP_GUIDE = {
  title: "Connect Entire CLI Provenance",
  steps: [
    "1. Install Entire CLI: npm install -g entireio/cli (or go install github.com/entireio/cli@latest)",
    "2. Initialize Entire in your repository: entire enable",
    "3. Run your coding agent with checkpoint tracking: entire run --agent <agent-name>",
    "4. Set environment variable ENTIRE_SESSION_PATH in Greenwash API server",
  ],
  documentationUrl: "https://entire.io/docs",
};

const DEFAULT_TIMELINE_EVENTS: SessionEvent[] = [
  {
    id: "ev-1-sample",
    timestamp: "2026-10-22T14:02:11Z",
    type: "prompt",
    source: "Entire CLI (Claude Code)",
    summary: "PROMPT: Fix intermittent discount calculation error on enterprise tiers with [REDACTED_SECRET]",
    isFlagged: false,
  },
  {
    id: "ev-2-sample",
    timestamp: "2026-10-22T14:02:18Z",
    type: "test_run",
    source: "vitest runner",
    summary: "Test suite execution: FAILED ($ vitest run tests/discount.test.ts)",
    targetFile: "tests/discount.test.ts",
    command: "vitest run tests/discount.test.ts",
    testOutcome: "failed",
    isFlagged: false,
  },
  {
    id: "ev-3-sample",
    timestamp: "2026-10-22T14:02:35Z",
    type: "file_edit",
    source: "agent editor",
    summary: "Edited tests/discount.test.ts (lines: 8)",
    targetFile: "tests/discount.test.ts",
    linesChanged: [8],
    diffSnippet: "-    expect(discounted).toBe(900);\n+    expect(discounted).toBeGreaterThanOrEqual(0);",
    isFlagged: true,
    flagReason: "Suspicious Pattern: Test failed, followed by an edit to test file rather than source code, followed by green pass. Warrants review.",
  },
  {
    id: "ev-4-sample",
    timestamp: "2026-10-22T14:02:42Z",
    type: "test_run",
    source: "vitest runner",
    summary: "Test suite execution: PASSED ($ vitest run tests/discount.test.ts)",
    targetFile: "tests/discount.test.ts",
    command: "vitest run tests/discount.test.ts",
    testOutcome: "passed",
    isFlagged: true,
    flagReason: "Suspicious Pattern: Suite turned green immediately after test code modification.",
  },
  {
    id: "ev-5-sample",
    timestamp: "2026-10-22T14:02:50Z",
    type: "commit",
    source: "git commit",
    summary: "Committed change (c84f91a) with Entire-Checkpoint trailer",
    commitHash: "c84f91a27e3d81b2a4e981273901bca234567890",
    targetFile: "tests/discount.test.ts",
    isFlagged: false,
  },
];

interface TimelineProps {
  onNavigateToDiff?: (filePath: string, line?: number) => void;
  onNavigateToIntegrations?: () => void;
}

export function Timeline({ onNavigateToDiff, onNavigateToIntegrations }: TimelineProps = {}) {
  const shouldReduceMotion = useReducedMotion();
  const [events, setEvents] = useState<SessionEvent[]>(DEFAULT_TIMELINE_EVENTS);
  const [selectedEventId, setSelectedEventId] = useState<string | null>("ev-1-sample");
  const [isLive, setIsLive] = useState<boolean>(false);
  const [sourceLabel, setSourceLabel] = useState<string>("Sample session — not a live connection");
  const [warning, setWarning] = useState<string | null>("Displaying checked-in sanitized sample session. No active Entire CLI connection detected.");
  const [setupGuide, setSetupGuide] = useState<{ title: string; steps: string[]; documentationUrl: string } | null>(DEFAULT_SETUP_GUIDE);
  const [loading, setLoading] = useState(false);

  // Filters & redactions
  const [excludePathFilter, setExcludePathFilter] = useState<string>("");
  const [onlyFlagged, setOnlyFlagged] = useState<boolean>(false);
  const [showSetupGuide, setShowSetupGuide] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const inspectorRef = useRef<HTMLDivElement>(null);

  // Auto-scroll inspector to top when selected event changes
  useScrollToResult({
    targetRef: inspectorRef,
    triggerKey: selectedEventId,
    enabled: Boolean(selectedEventId),
    topOffset: 0,
    focusOnScroll: true,
  });

  const toggleLiveStream = () => {
    if (isStreaming) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setIsStreaming(false);
    } else {
      setIsStreaming(true);
      const es = new EventSource("/api/session/stream?simulate=true&interval=1200");
      eventSourceRef.current = es;

      es.onmessage = (e) => {
        try {
          const newEvent: SessionEvent = JSON.parse(e.data);
          setEvents((prev) => {
            const exists = prev.some((x) => x.id === newEvent.id);
            if (exists) return prev;
            return [...prev, newEvent];
          });
          setSelectedEventId(newEvent.id);
        } catch {
          // ignore parsing error
        }
      };

      es.onerror = () => {
        es.close();
        setIsStreaming(false);
      };
    }
  };

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchSessionTimeline()
      .then((data) => {
        setEvents(data.events || []);
        setIsLive(data.isLive || false);
        setSourceLabel(data.sourceLabel || "Sample session — not a live connection");
        setWarning(data.warning || null);
        setSetupGuide(data.setupGuide || null);
        if (data.events && data.events.length > 0) {
          setSelectedEventId(data.events[0].id);
        }
      })
      .catch(() => {
        // Fallback default sample data if API is offline
        const fallbackEvents: SessionEvent[] = [
          {
            id: "ev-1-sample",
            timestamp: "2026-10-22T14:02:11Z",
            type: "prompt",
            source: "Entire CLI (Claude Code)",
            summary: "PROMPT: Fix intermittent discount calculation error on enterprise tiers with [REDACTED_SECRET]",
            isFlagged: false,
          },
          {
            id: "ev-2-sample",
            timestamp: "2026-10-22T14:02:18Z",
            type: "test_run",
            source: "vitest runner",
            summary: "Test suite execution: FAILED ($ vitest run tests/discount.test.ts)",
            targetFile: "tests/discount.test.ts",
            command: "vitest run tests/discount.test.ts",
            testOutcome: "failed",
            isFlagged: false,
          },
          {
            id: "ev-3-sample",
            timestamp: "2026-10-22T14:02:35Z",
            type: "file_edit",
            source: "agent editor",
            summary: "Edited tests/discount.test.ts (lines: 8)",
            targetFile: "tests/discount.test.ts",
            linesChanged: [8],
            diffSnippet: "-    expect(discounted).toBe(900);\n+    expect(discounted).toBeGreaterThanOrEqual(0);",
            isFlagged: true,
            flagReason: "Suspicious Pattern: Test failed, followed by an edit to test file rather than source code, followed by green pass. Warrants review.",
          },
          {
            id: "ev-4-sample",
            timestamp: "2026-10-22T14:02:42Z",
            type: "test_run",
            source: "vitest runner",
            summary: "Test suite execution: PASSED ($ vitest run tests/discount.test.ts)",
            targetFile: "tests/discount.test.ts",
            command: "vitest run tests/discount.test.ts",
            testOutcome: "passed",
            isFlagged: true,
            flagReason: "Suspicious Pattern: Suite turned green immediately after test code modification.",
          },
          {
            id: "ev-5-sample",
            timestamp: "2026-10-22T14:02:50Z",
            type: "commit",
            source: "git commit",
            summary: "Committed change (c84f91a) with Entire-Checkpoint trailer",
            commitHash: "c84f91a27e3d81b2a4e981273901bca234567890",
            targetFile: "tests/discount.test.ts",
            isFlagged: false,
          },
        ];
        setEvents(fallbackEvents);
        setSelectedEventId(fallbackEvents[0].id);
        setIsLive(false);
        setSourceLabel("Sample session — not a live connection");
        setWarning("Displaying checked-in sanitized sample session. No active Entire CLI connection detected.");
        setSetupGuide({
          title: "Connect Entire CLI Provenance",
          steps: [
            "1. Install Entire CLI: npm install -g entireio/cli (or go install github.com/entireio/cli@latest)",
            "2. Initialize Entire in your repository: entire enable",
            "3. Run your coding agent with checkpoint tracking: entire run --agent <agent-name>",
            "4. Set environment variable ENTIRE_SESSION_PATH in Greenwash API server",
          ],
          documentationUrl: "https://entire.io/docs",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredEvents = events.filter((ev) => {
    if (onlyFlagged && !ev.isFlagged) return false;
    if (excludePathFilter && ev.targetFile && ev.targetFile.includes(excludePathFilter)) return false;
    return true;
  });

  const selectedEvent = events.find((e) => e.id === selectedEventId) || filteredEvents[0] || null;

  return (
    <div className="flex-1 flex flex-col bg-surface-base h-full overflow-hidden font-sans" role="region" aria-label="Agent Session Timeline Workspace">
      {/* Top Banner / Diagnostics */}
      <div className="p-4 bg-surface-panel border-b border-border-default flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold text-text-primary">Agent Session Timeline</h1>
            <span
              data-testid="session-source-badge"
              className={`text-xs font-mono px-2 py-0.5 rounded border font-semibold ${
                isLive
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
            >
              {sourceLabel}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Entire CLI provenance trace. Replays sequence of user prompts, agent edits, and test runs to detect evasion patterns.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={toggleLiveStream}
            data-testid="toggle-stream-btn"
            className={`text-xs font-mono px-2.5 py-1 rounded border flex items-center space-x-1.5 cursor-pointer transition-colors ${
              isStreaming
                ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "bg-surface-subtle border-border-default text-text-secondary hover:text-text-primary"
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isStreaming ? "animate-pulse text-emerald-500" : "text-text-tertiary"}`} />
            <span>{isStreaming ? "Streaming Active (SSE)" : "Live Stream SSE"}</span>
          </button>
          {setupGuide && (
            <button
              onClick={() => setShowSetupGuide(!showSetupGuide)}
              data-testid="setup-guide-btn"
              className="text-xs font-mono px-2.5 py-1 rounded bg-surface-subtle text-text-secondary border border-border-default hover:text-text-primary flex items-center space-x-1"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{showSetupGuide ? "Hide Setup Guide" : "CLI Setup Guide"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Setup Guide Accordion when requested */}
      {showSetupGuide && setupGuide && (
        <div data-testid="setup-guide-panel" className="p-4 bg-slate-900 dark:bg-surface-subtle text-slate-100 dark:text-text-primary border-b border-slate-700 dark:border-border-default text-xs font-mono space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-blue-600 dark:text-[#58A6FF]">{setupGuide.title}</span>
            <a
              href={setupGuide.documentationUrl}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-600 dark:text-[#7EE787] hover:underline flex items-center space-x-1 text-[11px]"
            >
              <span>Entire CLI Docs</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="space-y-1 text-slate-300 dark:text-text-secondary">
            {setupGuide.steps.map((step, idx) => (
              <div key={idx} className="bg-slate-800/80 dark:bg-surface-panel p-2 rounded border border-slate-700 dark:border-border-default">
                {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing live connection honest notice */}
      {!isLive && warning && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-mono flex items-center space-x-2">
          <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{warning}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="px-4 py-2 bg-surface-panel border-b border-border-default flex items-center justify-between text-xs font-mono">
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyFlagged}
              onChange={(e) => setOnlyFlagged(e.target.checked)}
              data-testid="filter-flagged-checkbox"
              className="rounded border-border-default"
            />
            <span className="text-text-secondary">Show only suspicious patterns</span>
          </label>

          <div className="flex items-center space-x-1.5">
            <span className="text-text-tertiary">Exclude file:</span>
            <input
              type="text"
              placeholder="e.g. tests/"
              value={excludePathFilter}
              onChange={(e) => setExcludePathFilter(e.target.value)}
              className="h-6 px-1.5 text-xs font-mono bg-surface-subtle border border-border-default rounded text-text-primary"
            />
          </div>
        </div>

        <span className="text-text-tertiary text-[11px]">
          Showing {filteredEvents.length} of {events.length} session events
        </span>
      </div>

      {/* 2-Pane Timeline & Inspector View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Interactive Chronological Events List */}
        <div className="w-[450px] bg-surface-panel border-r border-border-default overflow-y-auto p-4 space-y-4">
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-default">
            {filteredEvents.map((ev) => {
              const isSelected = ev.id === selectedEventId;
              const isFailedTest = ev.type === "test_run" && ev.testOutcome === "failed";
              const isPassedTest = ev.type === "test_run" && ev.testOutcome === "passed";

              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  data-testid={`session-event-row-${ev.id}`}
                  className={`relative p-3.5 rounded-xl text-xs cursor-pointer border transition-all duration-150 ${
                    isSelected
                      ? "bg-surface-subtle border-brand-primary shadow-xs ring-1 ring-brand-primary/25"
                      : "bg-surface-panel border-border-default hover:border-border-strong hover:shadow-2xs"
                  }`}
                >
                  {/* Timeline bullet */}
                  <div
                    className={`absolute -left-6 top-3.5 w-4 h-4 rounded-full border-2 bg-surface-panel flex items-center justify-center transition-transform ${
                      isSelected ? "scale-110" : ""
                    } ${
                      ev.isFlagged
                        ? "border-status-blocked-solid bg-status-blocked-bg"
                        : isFailedTest
                          ? "border-status-blocked-solid bg-red-100 dark:bg-red-950"
                          : isPassedTest
                            ? "border-status-pass-solid bg-emerald-100 dark:bg-emerald-950"
                            : "border-border-strong"
                    }`}
                  />

                  <div className="flex items-center justify-between font-mono text-[11px] mb-1.5">
                    <span className="text-text-tertiary">[{new Date(ev.timestamp).toLocaleTimeString()}]</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-base border border-border-default font-mono text-text-secondary">
                      {ev.source}
                    </span>
                  </div>

                  <div className="font-semibold text-text-primary text-xs leading-snug">
                    {ev.summary}
                  </div>

                  {ev.targetFile && (
                    <div className="text-[10px] font-mono text-text-tertiary mt-1.5 truncate">
                      File: {ev.targetFile}
                    </div>
                  )}

                  {ev.isFlagged && (
                    <div className="mt-2.5 p-2 rounded-lg bg-status-blocked-bg border border-status-blocked-border text-status-blocked-text text-[11px] flex items-start space-x-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span className="font-sans font-medium">Suspicious pattern detected</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Event Inspector & Diff Viewer */}
        <div ref={inspectorRef} className="flex-1 bg-surface-base overflow-y-auto p-6 space-y-4" role="region" aria-label="Event Details Inspector">
          
          {selectedEvent ? (
            <div
              
              className="max-w-3xl space-y-4"
            >
              <div className="bg-surface-panel border border-border-default rounded-xl p-5 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between border-b border-border-default pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-brand-primary uppercase">
                      Event Details ({selectedEvent.type})
                    </span>
                    {selectedEvent.checkpointId && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-subtle border border-border-default text-text-secondary">
                        Checkpoint: {selectedEvent.checkpointId}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-text-tertiary">
                    {new Date(selectedEvent.timestamp).toISOString()}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold text-text-secondary uppercase tracking-wider">
                    Provenance / Source
                  </span>
                  <div className="text-xs font-mono text-text-primary">{selectedEvent.source}</div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold text-text-secondary uppercase tracking-wider">
                    Summary
                  </span>
                  <div className="text-xs text-text-primary leading-relaxed bg-surface-subtle p-2.5 rounded border border-border-default font-mono">
                    {selectedEvent.summary}
                  </div>
                </div>

                {selectedEvent.isFlagged && (
                  <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                    <div className="flex items-center space-x-1.5 font-bold">
                      <AlertCircle className="w-4 h-4 text-amber-700" />
                      <span>Review Warranted (Behavior Pattern)</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed font-sans">
                      {selectedEvent.flagReason}
                    </p>
                    <span className="text-[10px] text-amber-700 font-mono block pt-1">
                      Note: Patterns describe sequences that warrant human review; they are not proof of malicious intent.
                    </span>
                  </div>
                )}
              </div>

              {/* Associated Diff / Hunk if present */}
              {selectedEvent.diffSnippet ? (
                <div className="space-y-3">
                  <div className="bg-[#0D1117] border border-[#30363D] rounded overflow-hidden shadow-xs">
                    <div className="px-3 py-2 bg-[#161B22] border-b border-[#30363D] flex items-center justify-between text-xs font-mono text-gray-300">
                      <span className="font-bold">Associated Diff Snippet ({selectedEvent.targetFile || "Diff"})</span>
                      <span className="text-[11px] text-gray-400">Captured in Checkpoint</span>
                    </div>
                    <pre className="p-3 text-xs font-mono overflow-x-auto text-[#C9D1D9] leading-relaxed">
                      <code>
                        {selectedEvent.diffSnippet.split("\n").map((line, idx) => (
                          <div
                            key={idx}
                            className={
                              line.startsWith("+")
                                ? "text-[#7EE787] bg-[rgba(46,160,67,0.15)] px-1"
                                : line.startsWith("-")
                                  ? "text-[#FF7B72] bg-[rgba(248,81,73,0.15)] px-1"
                                  : "text-[#C9D1D9]"
                            }
                          >
                            {line}
                          </div>
                        ))}
                      </code>
                    </pre>
                  </div>

                  {onNavigateToDiff && selectedEvent.targetFile && (
                    <button
                      type="button"
                      data-testid="timeline-view-diff-btn"
                      onClick={() => onNavigateToDiff(selectedEvent.targetFile!, selectedEvent.linesChanged?.[0])}
                      className="px-3 py-1.5 rounded text-xs font-mono font-bold bg-brand-primary text-white dark:text-slate-950 hover:opacity-90 flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Inspect in Workbench ({selectedEvent.targetFile}{selectedEvent.linesChanged?.[0] ? `:${selectedEvent.linesChanged[0]}` : ''})</span>
                    </button>
                  )}
                </div>
              ) : selectedEvent.targetFile ? (
                <div className="p-4 bg-surface-panel border border-border-default rounded text-xs font-mono space-y-2">
                  <div className="text-text-secondary">
                    Target File: <code className="text-text-primary font-bold">{selectedEvent.targetFile}</code>
                    {selectedEvent.linesChanged && selectedEvent.linesChanged.length > 0 && (
                      <span className="text-text-tertiary ml-2">
                        (lines: {selectedEvent.linesChanged.join(", ")})
                      </span>
                    )}
                  </div>
                  {onNavigateToDiff && (
                    <button
                      type="button"
                      data-testid="timeline-view-diff-btn"
                      onClick={() => onNavigateToDiff(selectedEvent.targetFile!, selectedEvent.linesChanged?.[0])}
                      className="px-2.5 py-1 rounded text-xs font-mono bg-surface-subtle hover:bg-surface-panel border border-border-default text-text-primary flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3 text-brand-primary" />
                      <span>Open File in Workbench</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded bg-surface-subtle border border-border-default text-xs font-mono text-text-tertiary">
                  No file or diff line mapping available for this event.
                </div>
              )}
            </div>
          ) : (
            <div
              key="empty-selection"
              className="h-full flex items-center justify-center text-xs font-mono text-text-tertiary"
            >
              Select an event from the timeline to inspect its provenance and diff details.
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
