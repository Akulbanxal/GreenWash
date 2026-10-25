import React from "react";
import { Terminal, Shield, Cpu, Activity } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

export function StatusBar() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <footer
      className="h-7 bg-surface-panel/95 dark:bg-[#090D16] border-t border-border-default dark:border-slate-800 px-4 flex items-center justify-between text-[11px] font-mono text-text-secondary dark:text-slate-400 select-none shrink-0 z-20 backdrop-blur-xs"
      role="contentinfo"
      aria-label="Engine Status and Telemetry"
    >
      <div className="flex items-center space-x-3">
        {/* Soft breathing status indicator */}
        <div className="flex items-center space-x-1.5 text-text-primary dark:text-slate-200 font-medium">
          <span className="relative flex h-2 w-2">
            {!shouldReduceMotion && (
              <motion.span
                animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inline-flex h-full w-full rounded-full bg-emerald-400"
              />
            )}
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>Engine: Local Deterministic AST & Subprocess Runner (Timeout Bounded)</span>
        </div>

        <div className="h-3 w-px bg-border-default dark:bg-slate-800" />

        <div className="flex items-center space-x-1 text-text-tertiary dark:text-slate-400 hidden sm:flex">
          <Terminal className="w-3 h-3 text-brand-secondary" />
          <span>TypeScript AST Parser (ts-morph / babel)</span>
        </div>
      </div>

      <div className="flex items-center space-x-4 text-text-secondary dark:text-slate-400">
        <div className="flex items-center space-x-1 hidden md:flex">
          <Shield className="w-3 h-3 text-status-pass-solid" />
          <span className="text-text-primary dark:text-slate-300">Behavioral Replay Contract: Active</span>
        </div>
        <div className="flex items-center space-x-1">
          <Cpu className="w-3 h-3 text-brand-secondary" />
          <span className="text-text-primary dark:text-slate-300">Zero-Credential Safe Mode</span>
        </div>
      </div>
    </footer>
  );
}
