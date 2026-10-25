import React, { useState } from "react";
import { Copy, Check, Terminal, Sparkles, ShieldAlert, Cpu } from "lucide-react";
import { AuditFinding } from "@greenwash/core/dist/browser.js";

interface EvidenceInspectorProps {
  finding: AuditFinding | null;
}

export function EvidenceInspector({ finding }: EvidenceInspectorProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!finding) {
    return (
      <aside
        className="w-[380px] bg-surface-panel border-l border-border-default p-4 flex flex-col justify-center items-center text-center text-text-tertiary select-none"
        role="region"
        aria-label="Evidence Details"
      >
        <span className="font-mono text-xs">No finding selected</span>
        <span className="text-[11px] text-text-secondary mt-1">
          Select an integrity finding or click a highlighted diff line.
        </span>
      </aside>
    );
  }

  const isDeterministic = finding.source === "static-rule" || finding.source === "contract-replay";

  return (
    <aside
      className="w-[380px] bg-surface-panel border-l border-border-default flex flex-col h-full overflow-y-auto p-4 space-y-4 select-text"
      role="region"
      aria-label="Evidence Details"
    >
      {/* Card 1: Finding Meta */}
      <div className="border border-border-default rounded p-3 bg-surface-subtle">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-xs font-bold text-text-primary">{finding.ruleId}</span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
              isDeterministic
                ? "bg-slate-800 dark:bg-slate-700 text-white dark:text-slate-100"
                : "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800"
            }`}
          >
            {isDeterministic ? "[DET] Deterministic" : "[GEMMA] Semantic"}
          </span>
        </div>
        <h2 className="text-sm font-semibold text-text-primary">{finding.title}</h2>
        <p className="text-xs text-text-secondary mt-1">{finding.summary}</p>
      </div>

      {/* Card 2: Behavioral Contract Comparison */}
      {(finding.expected !== undefined || finding.actual !== undefined) && (
        <div className="border border-border-default rounded p-3 bg-surface-panel space-y-2">
          <div className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider">
            Behavioral Contract Invariant
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded bg-status-pass-bg border border-status-pass-border text-status-pass-text">
              <div className="text-[10px] text-text-secondary uppercase">Approved Baseline</div>
              <div className="font-bold mt-0.5">{JSON.stringify(finding.expected)}</div>
            </div>
            <div className="p-2 rounded bg-status-blocked-bg border border-status-blocked-border text-status-blocked-text">
              <div className="text-[10px] text-text-secondary uppercase">Candidate Patch</div>
              <div className="font-bold mt-0.5">{JSON.stringify(finding.actual)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Card 3: Deterministic Repro Command Box */}
      {finding.reproductionCommand && (
        <div className="border border-border-default rounded p-3 bg-[#161B22] text-white space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-gray-400">Reproduction Command</span>
            <button
              onClick={() => handleCopy(finding.reproductionCommand)}
              data-testid="copy-repro-btn"
              className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 flex items-center space-x-1 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? "Copied!" : "Copy Command (C)"}</span>
            </button>
          </div>
          <div className="font-mono text-xs text-[#58A6FF] break-all select-all">
            $ {finding.reproductionCommand}
          </div>
        </div>
      )}

      {/* Card 4: Human Action & Recommendations */}
      <div className="border border-border-default rounded p-3 bg-surface-subtle space-y-1">
        <span className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider">
          Required Human Action
        </span>
        <p className="text-xs text-text-primary leading-relaxed">{finding.humanAction}</p>
      </div>

      {/* Card 5: Semantic Inference Panel (Gemma Offline Notice or Analysis) */}
      <div className="border border-sky-200 dark:border-sky-800/50 bg-sky-50 dark:bg-sky-950/30 rounded p-3 text-xs space-y-1">
        <div className="flex items-center space-x-1.5 text-sky-800 dark:text-sky-300 font-mono font-semibold text-[11px]">
          <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span>Gemma Semantic Explanation</span>
        </div>
        <p className="text-sky-950 dark:text-sky-200 text-xs leading-relaxed">
          The agent relaxed test assertions rather than fixing the domain calculation. Deterministic rule{" "}
          <code className="font-mono font-bold text-[11px] text-sky-950 dark:text-sky-100">{finding.ruleId}</code> remains fully active and authoritative.
        </p>
      </div>
    </aside>
  );
}
