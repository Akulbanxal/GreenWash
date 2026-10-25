import React, { useEffect, useRef, useState } from "react";
import { Columns, AlignLeft } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { TRANSITION_FAST, TRANSITION_PANEL } from "../motion";

interface DiffLine {
  type: "normal" | "add" | "del";
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
  isFlagged?: boolean;
}

interface DiffViewerProps {
  filePath: string;
  lines: DiffLine[];
  splitView: boolean;
  onToggleSplit: () => void;
  selectedLine?: number;
  onSelectLine?: (line: number) => void;
}

export function DiffViewer({
  filePath,
  lines,
  splitView,
  onToggleSplit,
  selectedLine,
  onSelectLine,
}: DiffViewerProps) {
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const [pulseKey, setPulseKey] = useState<number>(0);

  // Auto-scroll target hunk into view smoothly when selectedLine changes & trigger brief highlight pulse (600-900ms)
  useEffect(() => {
    if (selectedLine) {
      setPulseKey((k) => k + 1);
      if (selectedRowRef.current && typeof selectedRowRef.current.scrollIntoView === "function") {
        selectedRowRef.current.scrollIntoView({
          behavior: shouldReduceMotion ? "auto" : "smooth",
          block: "center",
        });
      }
    }
  }, [selectedLine, shouldReduceMotion]);

  return (
    <div
      className="flex-1 flex flex-col bg-surface-panel h-full overflow-hidden"
      role="region"
      aria-label="Code Diff Inspector"
    >
      {/* Diff Toolbar */}
      <div className="h-9 px-4 border-b border-border-default bg-surface-panel flex items-center justify-between select-none">
        <div className="flex items-center space-x-2 min-w-0">
          <span className="text-xs font-mono font-bold text-text-primary truncate">
            {filePath}
          </span>
          <span className="text-[11px] text-text-tertiary font-mono shrink-0">
            AST Unified Diff
          </span>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <motion.button
            whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
            onClick={onToggleSplit}
            className={`px-2 py-1 text-xs font-mono rounded flex items-center space-x-1.5 border transition-colors cursor-pointer ${
              splitView
                ? "bg-brand-primary text-white dark:text-slate-950 border-brand-primary font-bold"
                : "bg-surface-subtle text-text-secondary border-border-default hover:text-text-primary"
            }`}
          >
            {splitView ? <Columns className="w-3 h-3" /> : <AlignLeft className="w-3 h-3" />}
            <span>{splitView ? "Split View" : "Unified"}</span>
          </motion.button>
        </div>
      </div>

      {/* Code Diff Surface (Themed Code Canvas) */}
      <div className="flex-1 bg-surface-code overflow-y-auto font-mono text-xs select-text">
        {lines.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 font-mono text-xs">
            No diff lines loaded
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => {
                const isSelected = Boolean(selectedLine && line.newLineNumber === selectedLine);
                const isAdd = line.type === "add";
                const isDel = line.type === "del";

                return (
                  <tr
                    key={idx}
                    ref={isSelected ? selectedRowRef : undefined}
                    onClick={() => line.newLineNumber && onSelectLine?.(line.newLineNumber)}
                    className={`leading-5 hover:bg-surface-subtle cursor-pointer transition-colors duration-100 relative ${
                      isSelected
                        ? "bg-[#D29922]/20 border-l-4 border-l-[#D29922]"
                        : isAdd
                          ? "bg-status-pass-bg"
                          : isDel
                            ? "bg-status-blocked-bg"
                            : ""
                    }`}
                  >
                    {/* Old line number */}
                    <td className="w-12 px-2 text-right text-text-tertiary select-none border-r border-border-subtle">
                      {line.oldLineNumber ?? ""}
                    </td>

                    {/* New line number */}
                    <td className="w-12 px-2 text-right text-text-tertiary select-none border-r border-border-subtle">
                      {line.newLineNumber ?? ""}
                    </td>

                    {/* Sign (+ / - / ' ') */}
                    <td className="w-6 text-center select-none font-bold">
                      {isAdd ? (
                        <span className="text-status-pass-solid">+</span>
                      ) : isDel ? (
                        <span className="text-status-blocked-solid">-</span>
                      ) : (
                        <span className="text-text-tertiary"> </span>
                      )}
                    </td>

                    {/* Code text content */}
                    <td className="px-2 py-0.5 text-text-primary whitespace-pre overflow-x-auto relative">
                      {isSelected && !shouldReduceMotion && (
                        <motion.span
                          key={`pulse-${pulseKey}`}
                          initial={{ opacity: 0.8 }}
                          animate={{ opacity: 0 }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="absolute inset-0 bg-[#D29922]/30 pointer-events-none"
                        />
                      )}
                      {line.content}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
