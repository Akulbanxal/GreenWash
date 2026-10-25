import React from "react";
import { Octagon, AlertTriangle, CheckCircle2, RotateCw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { AuditStatus } from "@greenwash/core/dist/browser.js";
import { TRANSITION_FAST } from "../motion";

interface VerdictBadgeProps {
  status: AuditStatus;
  findingCount?: number;
  isRunning?: boolean;
}

export function VerdictBadge({ status, findingCount = 0, isRunning = false }: VerdictBadgeProps) {
  const isBlocked = status === "BLOCKED";
  const isReview = status === "REVIEW";
  const shouldReduceMotion = useReducedMotion();

  if (isRunning) {
    return (
      <motion.div
        key="running-verdict"
        initial={shouldReduceMotion ? false : { scale: 0.96, opacity: 0.8 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={TRANSITION_FAST}
        data-testid="verdict-running"
        className="flex items-center space-x-2 px-3 py-1 rounded text-white font-mono text-xs shadow-xs bg-slate-700 select-none border border-slate-600"
      >
        <motion.div
          animate={shouldReduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        >
          <RotateCw className="w-3.5 h-3.5 text-slate-300 shrink-0" />
        </motion.div>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="font-bold tracking-tight truncate text-slate-100">
            AUDIT RUNNING…
          </span>
          <span className="text-[10px] font-sans truncate opacity-80 text-slate-300">
            Evaluating AST & contracts
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key={status}
      initial={shouldReduceMotion ? false : { scale: 0.96, opacity: 0.8 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={TRANSITION_FAST}
      data-testid={isBlocked ? "verdict-blocked" : isReview ? "verdict-review" : "verdict-pass"}
      className={`flex items-center space-x-2 px-3 py-1 rounded text-white font-mono text-xs shadow-xs transition-colors duration-180 select-none ${
        isBlocked
          ? "bg-[#DC2626]"
          : isReview
            ? "bg-[#D97706]"
            : "bg-[#059669]"
      }`}
    >
      <motion.div
        key={`icon-${status}`}
        initial={shouldReduceMotion ? false : { rotate: -15, scale: 0.8 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={TRANSITION_FAST}
      >
        {isBlocked ? (
          <Octagon className="w-3.5 h-3.5 fill-current shrink-0" />
        ) : isReview ? (
          <AlertTriangle className="w-3.5 h-3.5 fill-current shrink-0" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        )}
      </motion.div>

      <div className="flex flex-col leading-tight min-w-0">
        <span className="font-bold tracking-tight truncate">
          {isBlocked
            ? `BLOCKED: ${findingCount} ${findingCount === 1 ? "Defect" : "Defects"}`
            : isReview
              ? "REVIEW REQUIRED: Ambiguous Diff"
              : "PASS: Checks Satisfied"}
        </span>
        <span className="text-[10px] font-sans truncate opacity-90">
          {isBlocked
            ? "Fails protected behavior replay"
            : isReview
              ? "Assertion changed without contract coverage"
              : "No violations detected in supported rules"}
        </span>
      </div>
    </motion.div>
  );
}
