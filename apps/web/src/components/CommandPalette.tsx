import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  Layers,
  FileCode,
  ShieldAlert,
  Play,
  Clock,
  Database,
  Sliders,
  History,
  X,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { ScreenTab } from "./Header";
import { ScenarioItem } from "../api";
import { AuditFinding } from "@greenwash/core/dist/browser.js";
import { motion, AnimatePresence } from "motion/react";
import { TRANSITION_FAST, TRANSITION_PANEL } from "../motion";

interface CommandItem {
  id: string;
  category: "Navigation" | "Actions" | "Scenarios" | "Findings";
  title: string;
  subtitle?: string;
  badge?: string;
  icon: React.ReactNode;
  onExecute: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScreen: (screen: ScreenTab) => void;
  scenarios: ScenarioItem[];
  selectedScenarioId: string;
  onSelectScenario: (id: string) => void;
  onRunAudit: () => void;
  findings?: AuditFinding[];
  onSelectFinding?: (id: string) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelectScreen,
  scenarios,
  selectedScenarioId,
  onSelectScenario,
  onRunAudit,
  findings = [],
  onSelectFinding,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus when opened & listen for Escape
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      };
      window.addEventListener("keydown", handleGlobalKeyDown);
      return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }
  }, [isOpen, onClose]);

  // Construct command list
  const allCommands = useMemo(() => {
    const items: CommandItem[] = [];

    // 1. Actions
    items.push({
      id: "action-run-audit",
      category: "Actions",
      title: "Run Integrity Audit",
      subtitle: `Audit candidate patch for active scenario`,
      badge: "Action (R)",
      icon: <Play className="w-3.5 h-3.5 text-brand-primary" />,
      onExecute: () => {
        onRunAudit();
        onClose();
      },
    });

    // 2. Navigation
    const navItems: Array<{ tab: ScreenTab; label: string; desc: string; icon: React.ReactNode }> = [
      { tab: "landing", label: "Overview & Landing Page", desc: "Cinematic visual guide, 30-sec example, and integrity walkthrough", icon: <Layers className="w-3.5 h-3.5 text-text-secondary" /> },
      { tab: "demo", label: "Red-Team Demo Lab", desc: "Scenario explorer and sandbox audit runner", icon: <Layers className="w-3.5 h-3.5 text-text-secondary" /> },
      { tab: "workbench", label: "Forensic Workbench", desc: "3-pane unified diff and contextual evidence inspector", icon: <FileCode className="w-3.5 h-3.5 text-text-secondary" /> },
      { tab: "pipeline", label: "Mastra Pipeline", desc: "Orchestrated 6-step typed workflow execution and trace logs", icon: <Sparkles className="w-3.5 h-3.5 text-text-secondary" /> },
      { tab: "contracts", label: "Contract Explorer", desc: "Protected behavioral invariants and baseline review", icon: <ShieldAlert className="w-3.5 h-3.5 text-text-secondary" /> },
      { tab: "timeline", label: "Agent Session Timeline", desc: "Entire CLI provenance logs and checkpoint trail", icon: <Clock className="w-3.5 h-3.5 text-text-secondary" /> },
      { tab: "history", label: "Audit History", desc: "Sanitized audit summaries stored in Atlas or session memory", icon: <History className="w-3.5 h-3.5 text-text-secondary" /> },
      { tab: "integrations", label: "Integrations & Environment", desc: "Gemma, Sentry, MongoDB Atlas and Entire CLI diagnostics", icon: <Sliders className="w-3.5 h-3.5 text-text-secondary" /> },
    ];

    navItems.forEach((n) => {
      items.push({
        id: `nav-${n.tab}`,
        category: "Navigation",
        title: n.label,
        subtitle: n.desc,
        badge: "Screen",
        icon: n.icon,
        onExecute: () => {
          onSelectScreen(n.tab);
          onClose();
        },
      });
    });

    // 3. Scenarios
    scenarios.forEach((s) => {
      const isSelected = s.id === selectedScenarioId;
      items.push({
        id: `scenario-${s.id}`,
        category: "Scenarios",
        title: s.title,
        subtitle: s.description,
        badge: isSelected ? "Active Scenario" : `Expected: ${s.expectedOutcome}`,
        icon: <Layers className={`w-3.5 h-3.5 ${isSelected ? "text-brand-primary" : "text-text-tertiary"}`} />,
        onExecute: () => {
          onSelectScenario(s.id);
          onClose();
        },
      });
    });

    // 4. Current Findings (if any)
    findings.forEach((f) => {
      items.push({
        id: `finding-${f.id}`,
        category: "Findings",
        title: `${f.title} (${f.ruleId})`,
        subtitle: f.summary,
        badge: f.severity.toUpperCase(),
        icon: <ShieldAlert className="w-3.5 h-3.5 text-red-500" />,
        onExecute: () => {
          onSelectScreen("workbench");
          onSelectFinding?.(f.id);
          onClose();
        },
      });
    });

    return items;
  }, [scenarios, selectedScenarioId, findings, onRunAudit, onSelectScreen, onSelectScenario, onSelectFinding, onClose]);

  // Filter commands by search query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const lower = query.toLowerCase();
    return allCommands.filter(
      (c) =>
        c.title.toLowerCase().includes(lower) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(lower)) ||
        c.category.toLowerCase().includes(lower) ||
        (c.badge && c.badge.toLowerCase().includes(lower))
    );
  }, [allCommands, query]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Keyboard navigation within palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filteredCommands.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredCommands.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].onExecute();
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={TRANSITION_FAST}
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-xs p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Command Palette"
          data-testid="command-palette-dialog"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={TRANSITION_PANEL}
            className="w-full max-w-xl bg-surface-panel border border-border-default rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[70vh] font-sans"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
        {/* Search Input Bar */}
        <div className="flex items-center px-3 py-2.5 border-b border-border-default bg-surface-panel">
          <Search className="w-4 h-4 text-text-tertiary mr-2.5 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a screen, scenario, or action..."
            aria-label="Search command palette"
            data-testid="command-palette-input"
            className="flex-1 bg-transparent text-xs text-text-primary placeholder-text-tertiary focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-text-tertiary hover:text-text-primary p-0.5 rounded mr-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-subtle text-text-tertiary border border-border-default select-none">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-tertiary font-mono">
              No matching commands or scenarios found
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.onExecute}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  data-testid={`command-item-${cmd.id}`}
                  className={`w-full text-left px-3 py-2 rounded flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-brand-primary text-white dark:text-slate-950 font-bold"
                      : "text-text-primary hover:bg-surface-subtle"
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    <span className={isSelected ? "text-white dark:text-slate-950" : ""}>{cmd.icon}</span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{cmd.title}</div>
                      {cmd.subtitle && (
                        <div
                          className={`text-[11px] truncate ${
                            isSelected ? "text-emerald-100 dark:text-emerald-950 font-medium" : "text-text-secondary"
                          }`}
                        >
                          {cmd.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {cmd.badge && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isSelected
                            ? "bg-white/20 dark:bg-black/20 text-white dark:text-slate-950 font-bold"
                            : "bg-surface-subtle text-text-tertiary border border-border-default"
                        }`}
                      >
                        {cmd.badge}
                      </span>
                    )}
                    <ArrowRight className={`w-3 h-3 ${isSelected ? "text-white dark:text-slate-950" : "text-transparent"}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-3 py-2 bg-surface-subtle border-t border-border-default flex items-center justify-between text-[10px] text-text-tertiary font-mono select-none">
          <div className="flex items-center space-x-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>esc to close</span>
          </div>
          <div>Greenwash Navigation Palette</div>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
  );
}
