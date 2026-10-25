import React, { useState } from "react";
import { Play, Search, Menu, X, Clock, ShieldAlert, FileDown, Sun, Moon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { VerdictBadge } from "./VerdictBadge";
import { AuditStatus } from "@greenwash/core/dist/browser.js";
import { useTheme } from "../theme/ThemeContext";

export type ScreenTab =
  | "landing"
  | "demo"
  | "workbench"
  | "pipeline"
  | "contracts"
  | "timeline"
  | "history"
  | "integrations"
  | "graphify";

interface HeaderProps {
  activeScreen: ScreenTab;
  onSelectScreen: (screen: ScreenTab) => void;
  selectedScenarioId: string;
  onSelectScenario: (id: string) => void;
  onRunAudit: () => void;
  isAuditing: boolean;
  status: AuditStatus;
  findingCount: number;
  onOpenCommandPalette?: () => void;
}

const PRIMARY_NAV_TABS: Array<{ tab: ScreenTab; label: string }> = [
  { tab: "landing", label: "Overview" },
  { tab: "demo", label: "Demo Lab" },
  { tab: "workbench", label: "Workbench" },
  { tab: "contracts", label: "Contracts" },
  { tab: "history", label: "History" },
];

const DIAGNOSTIC_NAV_TABS: Array<{ tab: ScreenTab; label: string }> = [
  { tab: "pipeline", label: "Pipeline" },
  { tab: "graphify", label: "Graphify" },
  { tab: "timeline", label: "Timeline" },
  { tab: "integrations", label: "Integrations" },
];

const ALL_NAV_TABS = [...PRIMARY_NAV_TABS, ...DIAGNOSTIC_NAV_TABS];

export function Header({
  activeScreen,
  onSelectScreen,
  selectedScenarioId,
  onSelectScenario,
  onRunAudit,
  isAuditing,
  status,
  findingCount,
  onOpenCommandPalette,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-12 bg-surface-panel/95 backdrop-blur-md border-b border-border-default px-4 flex items-center justify-between gap-3 select-none relative z-20 shadow-2xs">
      {/* Left Region: Brand mark, version pill, vertical divider, tabs, scenario selector */}
      <div className="flex items-center space-x-2.5 min-w-0 flex-1 overflow-hidden">
        {/* Brand Mark with Security Shield Badge */}
        <div
          className="flex items-center space-x-2 cursor-pointer shrink-0 group"
          onClick={() => onSelectScreen("landing")}
          data-testid="header-brand-mark"
        >
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="font-mono font-bold text-lg text-text-primary tracking-tight">
            GREENWASH
          </span>
          <span className="text-[10px] bg-surface-subtle text-text-secondary px-1.5 py-0.5 rounded font-mono border border-border-default hidden sm:inline-block font-semibold">
            v0.1.0
          </span>
        </div>

        <div className="h-4 w-px bg-border-default mx-0.5 shrink-0" />

        {/* Screen Navigation Tabs - Primary Flow & Secondary Diagnostics */}
        <nav
          className="hidden lg:flex items-center space-x-1 shrink-0"
          aria-label="Main Navigation"
        >
          {PRIMARY_NAV_TABS.map(({ tab, label }) => {
            const isActive = activeScreen === tab;
            return (
              <button
                key={tab}
                onClick={() => onSelectScreen(tab)}
                className={`relative px-2.5 py-1 text-xs rounded-md transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? "text-white font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-subtle font-medium"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="header-active-nav-pill"
                    className="absolute inset-0 bg-slate-900 dark:bg-emerald-600/90 rounded-md -z-10 shadow-xs"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}

          <div className="h-3.5 w-px bg-border-default mx-1 shrink-0" />
          <span className="text-[10px] font-mono text-text-tertiary font-semibold uppercase tracking-wider px-1 shrink-0 hidden xl:inline">
            Diagnostics:
          </span>

          {DIAGNOSTIC_NAV_TABS.map(({ tab, label }) => {
            const isActive = activeScreen === tab;
            return (
              <button
                key={tab}
                onClick={() => onSelectScreen(tab)}
                className={`relative px-2 py-1 text-xs rounded-md transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? "text-white font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-subtle font-normal"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="header-active-nav-pill"
                    className="absolute inset-0 bg-slate-800 dark:bg-slate-700 rounded-md -z-10 shadow-xs"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Mobile / Tablet Menu Trigger */}
        <div className="lg:hidden relative shrink-0">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-md bg-surface-subtle border border-border-default text-text-secondary hover:text-text-primary"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          {mobileMenuOpen && (
            <div className="absolute left-0 top-9 w-56 bg-surface-panel border border-border-default rounded-md shadow-lg py-1 z-30">
              <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-text-tertiary border-b border-border-subtle">
                Primary Flow
              </div>
              {PRIMARY_NAV_TABS.map(({ tab, label }) => (
                <button
                  key={tab}
                  onClick={() => {
                    onSelectScreen(tab);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    activeScreen === tab
                      ? "bg-slate-900 dark:bg-emerald-600/90 text-white font-semibold"
                      : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary font-medium"
                  }`}
                >
                  {label}
                </button>
              ))}

              <div className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-text-tertiary border-t border-border-subtle mt-1">
                Diagnostics
              </div>
              {DIAGNOSTIC_NAV_TABS.map(({ tab, label }) => (
                <button
                  key={tab}
                  onClick={() => {
                    onSelectScreen(tab);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    activeScreen === tab
                      ? "bg-slate-800 dark:bg-slate-700 text-white font-semibold"
                      : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
                  }`}
                >
                  {label}
                </button>
              ))}

              <div className="sm:hidden px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-text-tertiary border-t border-border-subtle mt-1">
                Active Scenario
              </div>
              <div className="sm:hidden px-2 pb-1.5">
                <select
                  value={selectedScenarioId}
                  onChange={(e) => {
                    onSelectScenario(e.target.value);
                    setMobileMenuOpen(false);
                  }}
                  disabled={isAuditing}
                  className="w-full text-xs font-mono bg-surface-subtle border border-border-default rounded p-1 text-text-primary"
                >
                  <option value="weakened-assertion">Scenario 1: Weakened Assertion</option>
                  <option value="deleted-test">Scenario 2: Deleted Test</option>
                  <option value="skipped-test">Scenario 3: Skipped Test</option>
                  <option value="excessive-mocking">Scenario 4: Excessive Mocking</option>
                  <option value="weakened-ci-gate">Scenario 5: Weakened CI Gate</option>
                  <option value="honest-fix">Scenario 6: Honest Bug Fix</option>
                </select>
              </div>

              <div className="px-3 pt-2 pb-1.5 border-t border-border-subtle flex items-center justify-between">
                <span className="text-xs text-text-secondary">Theme</span>
                <button
                  onClick={toggleTheme}
                  className="px-2 py-1 text-xs rounded bg-surface-subtle border border-border-default text-text-primary flex items-center gap-1.5"
                >
                  {theme === "dark" ? <Sun className="w-3 h-3 text-amber-400" /> : <Moon className="w-3 h-3 text-indigo-500" />}
                  <span>{theme === "dark" ? "Light" : "Dark"}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-border-default mx-0.5 shrink-0 hidden sm:block" />

        {/* Scenario dropdown selector (accessible on sm/md/lg/xl screens) */}
        <div className="relative hidden sm:block shrink min-w-0 max-w-[170px] md:max-w-[210px] lg:max-w-[230px]">
          <select
            data-testid="scenario-selector"
            value={selectedScenarioId}
            onChange={(e) => onSelectScenario(e.target.value)}
            disabled={isAuditing}
            aria-label="Select Scenario"
            className="w-full h-8 pl-2 pr-5 text-xs font-mono bg-surface-subtle border border-border-default rounded-md text-text-primary focus:outline-none focus:border-indigo-500 cursor-pointer transition-colors duration-150 truncate hover:bg-surface-panel"
          >
            <option value="weakened-assertion">Scenario 1: Weakened Assertion (Billing)</option>
            <option value="deleted-test">Scenario 2: Deleted Test (Concurrency)</option>
            <option value="skipped-test">Scenario 3: Skipped Test (Stripe Webhook)</option>
            <option value="excessive-mocking">Scenario 4: Excessive Mocking (Auth Token)</option>
            <option value="weakened-ci-gate">Scenario 5: Weakened CI Quality Gate</option>
            <option value="honest-fix">Scenario 6: Honest Bug Fix (Preserved Contract)</option>
          </select>
        </div>
      </div>

      {/* Right Region: Command palette search, Report download, Theme Toggle, Run action button & Tri-state Verdict Badge */}
      <div className="flex items-center space-x-2 shrink-0">
        {onOpenCommandPalette && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenCommandPalette}
            aria-label="Search and command palette"
            data-testid="header-command-palette-btn"
            className="h-8 px-2.5 rounded-md bg-surface-subtle hover:bg-surface-panel border border-border-default text-text-secondary hover:text-text-primary text-xs font-mono flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Search className="w-3.5 h-3.5 text-text-tertiary" />
            <span className="hidden sm:inline font-medium text-[11px]">Search</span>
            <kbd className="text-[10px] text-text-secondary px-1 rounded bg-surface-panel border border-border-default font-mono">
              ⌘K
            </kbd>
          </motion.button>
        )}

        <motion.a
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          href="/api/report/download"
          download="GREENWASH_FULL_FEATURE_REPORT.md"
          data-testid="header-download-report-btn"
          aria-label="Download Full Architecture and Feature Report"
          className="h-8 px-2.5 rounded-md bg-surface-subtle hover:bg-surface-panel border border-border-default text-text-secondary hover:text-text-primary text-xs font-mono flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs group"
          title="Download Complete System Architecture & Feature Report (Markdown)"
        >
          <FileDown className="w-3.5 h-3.5 text-brand-secondary group-hover:scale-110 transition-transform" />
          <span className="hidden md:inline font-medium text-[11px]">Report</span>
        </motion.a>

        {/* Functional Dark/Light Mode Theme Toggle Button */}
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={toggleTheme}
          data-testid="theme-toggle-btn"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="h-8 w-8 rounded-md bg-surface-subtle hover:bg-surface-panel border border-border-default text-text-secondary hover:text-text-primary flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
          title={theme === "dark" ? "Switch to light mode (current: dark)" : "Switch to dark mode (current: light)"}
        >
          <motion.div
            key={theme}
            initial={{ rotate: -90, scale: 0.7, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.7, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {theme === "dark" ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
            )}
          </motion.div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRunAudit}
          disabled={isAuditing}
          data-testid="run-audit-button"
          aria-label="Run Integrity Audit"
          className="h-8 px-3.5 rounded-md bg-gradient-to-r from-slate-900 to-indigo-950 dark:from-emerald-700 dark:to-teal-900 hover:from-slate-800 hover:to-indigo-900 text-white text-xs font-mono font-semibold flex items-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-xs border border-indigo-500/20"
        >
          {isAuditing ? (
            <Clock className="w-3 h-3 animate-spin shrink-0 text-indigo-300" />
          ) : (
            <Play className="w-3 h-3 fill-current shrink-0 text-emerald-400" />
          )}
          <span>{isAuditing ? "Auditing…" : "Run Audit (R)"}</span>
        </motion.button>

        <div className="transition-all duration-180">
          <VerdictBadge status={status} findingCount={findingCount} isRunning={isAuditing} />
        </div>
      </div>
    </header>
  );
}
