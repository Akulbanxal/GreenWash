import React from "react";
import { AlertOctagon, AlertTriangle, FileCode, Filter } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { AuditFinding } from "@greenwash/core/dist/browser.js";
import { ParsedDiffFile } from "../diffParser";
import { TRANSITION_FAST, TRANSITION_PANEL } from "../motion";

export type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";

interface WorkbenchSidebarProps {
  files: ParsedDiffFile[];
  selectedFilePath: string;
  onSelectFile: (path: string) => void;
  findings: AuditFinding[];
  selectedFindingId: string | null;
  onSelectFinding: (id: string) => void;
  severityFilter: SeverityFilter;
  onSetSeverityFilter: (filter: SeverityFilter) => void;
}

export function WorkbenchSidebar({
  files,
  selectedFilePath,
  onSelectFile,
  findings,
  selectedFindingId,
  onSelectFinding,
  severityFilter,
  onSetSeverityFilter,
}: WorkbenchSidebarProps) {
  const shouldReduceMotion = useReducedMotion();
  const filteredFindings = findings.filter((f) => {
    if (severityFilter === "all") return true;
    return f.severity === severityFilter;
  });

  return (
    <aside
      className="w-[280px] bg-surface-base border-r border-border-default flex flex-col h-full overflow-hidden select-none"
      role="region"
      aria-label="Workbench File Navigation and Findings Index"
    >
      {/* Changed Files Section */}
      <div className="p-3 border-b border-border-default flex flex-col max-h-52 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider">
            Changed Files
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-subtle text-text-secondary border border-border-default">
            {files.length}
          </span>
        </div>

        <div className="space-y-1">
          {files.map((file) => {
            const isSelected = file.filePath === selectedFilePath;
            return (
              <button
                key={file.filePath}
                onClick={() => onSelectFile(file.filePath)}
                data-testid={`file-item-${file.filePath}`}
                className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono flex items-center justify-between transition-colors relative ${
                  isSelected
                    ? "bg-surface-panel border border-border-strong text-text-primary font-semibold shadow-2xs"
                    : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <FileCode className="w-3.5 h-3.5 shrink-0 text-text-tertiary" />
                  <span className="truncate">{file.filePath}</span>
                </div>
                <div className="flex items-center space-x-1 text-[10px] font-mono">
                  {file.additions > 0 && <span className="text-status-pass-solid">+{file.additions}</span>}
                  {file.deletions > 0 && <span className="text-status-blocked-solid">-{file.deletions}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Findings Section with Filter */}
      <div className="flex-1 p-3 overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider">
            Findings ({filteredFindings.length})
          </span>
          {/* Severity Filter Dropdown */}
          <div className="flex items-center space-x-1">
            <Filter className="w-3 h-3 text-text-tertiary" />
            <select
              value={severityFilter}
              onChange={(e) => onSetSeverityFilter(e.target.value as SeverityFilter)}
              data-testid="severity-filter"
              aria-label="Filter findings by severity"
              className="text-[10px] font-mono bg-surface-subtle border border-border-default rounded px-1 py-0.5 text-text-secondary cursor-pointer"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {filteredFindings.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-text-tertiary">
            <span className="text-xs font-mono font-semibold text-text-secondary">No Integrity Findings</span>
            <span className="text-[11px] text-text-secondary mt-1">
              {severityFilter === "all"
                ? "Diff cleanly passed all static and contract checks."
                : `No ${severityFilter} findings matched the filter.`}
            </span>
          </div>
        ) : (
          <div className="space-y-1.5 relative">
            {filteredFindings.map((f) => {
              const isSelected = f.id === selectedFindingId;
              const isCritical = f.severity === "critical" || f.severity === "high";

              return (
                <motion.button
                  key={f.id}
                  layout={!shouldReduceMotion}
                  whileHover={shouldReduceMotion ? undefined : { x: 2, transition: TRANSITION_FAST }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                  onClick={() => onSelectFinding(f.id)}
                  data-testid={`finding-row-${f.id}`}
                  className={`w-full text-left p-2.5 rounded border text-xs transition-colors flex flex-col space-y-1 relative cursor-pointer ${
                    isSelected
                      ? "bg-surface-panel border-border-strong text-text-primary shadow-xs ring-1 ring-brand-primary"
                      : "bg-surface-panel border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary"
                  }`}
                >
                  {/* Shared selection indicator */}
                  {isSelected && (
                    <motion.div
                      layoutId="activeFindingIndicator"
                      className="absolute inset-0 rounded border-2 border-brand-primary pointer-events-none"
                      transition={TRANSITION_PANEL}
                    />
                  )}

                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[11px] text-text-primary truncate">
                      {f.ruleId}
                    </span>
                    <span
                      className={`text-[9px] font-mono uppercase px-1 py-0.2 rounded font-semibold flex items-center space-x-1 ${
                        isCritical
                          ? "bg-status-blocked-bg text-status-blocked-text border border-status-blocked-border"
                          : "bg-status-review-bg text-status-review-text border border-status-review-border"
                      }`}
                    >
                      {isCritical ? (
                        <AlertOctagon className="w-2.5 h-2.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                      )}
                      <span>{f.severity}</span>
                    </span>
                  </div>

                  <p className="text-[11px] text-text-secondary leading-snug line-clamp-2">
                    {f.title}
                  </p>

                  <div className="text-[10px] font-mono text-text-tertiary flex items-center justify-between pt-1">
                    <span>Line {f.evidence[0]?.startLine ?? "—"}</span>
                    <span>{f.source}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
