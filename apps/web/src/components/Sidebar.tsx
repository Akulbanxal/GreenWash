import React from "react";
import { FileCode, AlertOctagon, AlertTriangle, Info, ChevronRight, File } from "lucide-react";

export interface SidebarFinding {
  id: string;
  ruleId: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  filePath?: string;
  line?: number;
}

interface SidebarProps {
  files: Array<{ path: string; status: "modified" | "added" | "deleted"; count: number }>;
  selectedFilePath: string;
  onSelectFile: (path: string) => void;
  findings: SidebarFinding[];
  selectedFindingId: string | null;
  onSelectFinding: (id: string) => void;
}

export function Sidebar({
  files,
  selectedFilePath,
  onSelectFile,
  findings,
  selectedFindingId,
  onSelectFinding,
}: SidebarProps) {
  return (
    <aside
      className="w-[280px] bg-surface-base border-r border-border-default flex flex-col h-full overflow-hidden select-none"
      role="region"
      aria-label="File Navigation and Findings Index"
    >
      {/* Section 1: Changed Files Index */}
      <div className="p-3 border-b border-border-default flex flex-col max-h-48 overflow-y-auto">
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
            const isSelected = file.path === selectedFilePath;
            return (
              <button
                key={file.path}
                onClick={() => onSelectFile(file.path)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono flex items-center justify-between transition-colors ${
                  isSelected
                    ? "bg-surface-panel border border-border-strong text-text-primary font-semibold shadow-2xs"
                    : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <FileCode className="w-3.5 h-3.5 shrink-0 text-text-tertiary" />
                  <span className="truncate">{file.path}</span>
                </div>
                <span
                  className={`text-[10px] font-bold ${
                    file.status === "deleted"
                      ? "text-status-blocked-solid"
                      : file.status === "added"
                        ? "text-status-pass-solid"
                        : "text-status-review-solid"
                  }`}
                >
                  {file.status === "deleted" ? "-" : file.status === "added" ? "+" : "!"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Integrity Findings Index */}
      <div className="flex-1 p-3 overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider">
            Integrity Findings
          </span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
              findings.length > 0
                ? "bg-status-blocked-bg text-status-blocked-text border border-status-blocked-border"
                : "bg-status-pass-bg text-status-pass-text border border-status-pass-border"
            }`}
          >
            {findings.length}
          </span>
        </div>

        {findings.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-text-tertiary">
            <span className="text-xs font-mono">No findings detected</span>
            <span className="text-[11px] text-text-secondary mt-1">Patch preserved test integrity</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {findings.map((f) => {
              const isSelected = f.id === selectedFindingId;
              const isCritical = f.severity === "critical" || f.severity === "high";

              return (
                <button
                  key={f.id}
                  onClick={() => onSelectFinding(f.id)}
                  className={`w-full text-left p-2 rounded text-xs font-sans border transition-all flex flex-col relative ${
                    isSelected
                      ? "bg-surface-panel border-border-strong shadow-xs pl-3 border-l-4 border-l-status-blocked-solid"
                      : "bg-surface-subtle border-border-default hover:border-border-strong"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      {isCritical ? (
                        <AlertOctagon className="w-3.5 h-3.5 text-status-blocked-solid shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-status-review-solid shrink-0" />
                      )}
                      <span className="font-mono text-[11px] font-bold text-text-primary truncate">
                        {f.ruleId}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-mono uppercase px-1 py-0.2 rounded ${
                        isCritical
                          ? "bg-status-blocked-bg text-status-blocked-text border border-status-blocked-border"
                          : "bg-status-review-bg text-status-review-text border border-status-review-border"
                      }`}
                    >
                      {f.severity}
                    </span>
                  </div>

                  <span className="text-xs text-text-secondary mt-1 font-medium line-clamp-1">
                    {f.title}
                  </span>

                  {f.filePath && (
                    <span className="text-[10px] font-mono text-text-tertiary mt-1 truncate">
                      {f.filePath}{f.line ? `:${f.line}` : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
