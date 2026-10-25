import React, { useState, useEffect, useRef } from "react";
import { ShieldCheck, GitCommit, FileText, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, KeyRound, Lock, Sparkles, PlusCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { fetchContracts, reviewUpdateContract, synthesizeContractApi } from "../api";
import { BehaviorContract } from "@greenwash/core/dist/browser.js";
import { TRANSITION_FAST, TRANSITION_PANEL, STAGGER_CONTAINER_VARIANTS, STAGGER_ITEM_VARIANTS } from "../motion";
import { useScrollToResult } from "../hooks/useScrollToResult";

interface ContractExplorerProps {
  currentScenarioId?: string;
}

const DEFAULT_CONTRACT: BehaviorContract = {
  id: "contract-discount-v1",
  version: "1.0.0",
  description: "Protected invariant: calculateDiscount(1000, 10) must return exactly 900 cents.",
  targetFile: "src/discount.ts",
  targetFunction: "calculateDiscount",
  cases: [
    {
      id: "case-1000-cents-10-pct",
      name: "Standard 10% discount on 1000 cents",
      description: "Ensures discount computation returns 900 cents (1000 - 100).",
      input: { amountCents: 1000, discountPercent: 10 },
      expected: 900,
    },
  ],
  approvedBy: "Security & Architecture Review Board",
  approvedAt: "2026-10-20T12:00:00Z",
};

export function ContractExplorer({ currentScenarioId = "weakened-assertion" }: ContractExplorerProps) {
  const shouldReduceMotion = useReducedMotion();
  const [contracts, setContracts] = useState<BehaviorContract[]>([DEFAULT_CONTRACT]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Review & Update Modal / State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<BehaviorContract | null>(DEFAULT_CONTRACT);
  const [reviewerToken, setReviewerToken] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewStatus, setReviewStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  // Contract Synthesis Modal / State
  const [showSynthesizeModal, setShowSynthesizeModal] = useState(false);
  const [synthTask, setSynthTask] = useState("Ensure discount calculation never returns negative values or exceeds original amount");
  const [synthFile, setSynthFile] = useState("src/discount.ts");
  const [synthFunc, setSynthFunc] = useState("calculateDiscount");
  const [synthTestCode, setSynthTestCode] = useState(
    `describe("discount calculation", () => {\n  it("applies standard discount", () => {\n    const res = calculateDiscount(1000, 10);\n    expect(res).toBe(900);\n  });\n});`
  );
  const [synthStatus, setSynthStatus] = useState<"idle" | "synthesizing" | "success" | "error">("idle");
  const [synthMessage, setSynthMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const reviewMessageRef = useRef<HTMLDivElement>(null);

  // Auto-scroll modal to review feedback message
  useScrollToResult({
    targetRef: reviewMessageRef,
    triggerKey: reviewMessage,
    enabled: Boolean(reviewMessage),
    topOffset: 12,
    focusOnScroll: true,
  });

  useEffect(() => {
    loadContracts();
  }, []);

  // Handle Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showReviewModal) setShowReviewModal(false);
        if (showSynthesizeModal) setShowSynthesizeModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showReviewModal, showSynthesizeModal]);

  const loadContracts = () => {
    fetchContracts()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setContracts(data);
          setSelectedContract(data[0]);
        }
      })
      .catch((err) => {
        // Fallback default contract if API is unreachable
        const fallback: BehaviorContract = {
          id: "contract-discount-v1",
          version: "1.0.0",
          description: "Protected invariant: calculateDiscount(1000, 10) must return exactly 900 cents.",
          targetFile: "src/discount.ts",
          targetFunction: "calculateDiscount",
          cases: [
            {
              id: "case-1000-cents-10-pct",
              name: "Standard 10% discount on 1000 cents",
              description: "Ensures discount computation returns 900 cents (1000 - 100).",
              input: { amountCents: 1000, discountPercent: 10 },
              expected: 900,
            },
          ],
          approvedBy: "Security & Architecture Review Board",
          approvedAt: "2026-10-20T12:00:00Z",
        };
        setContracts([fallback]);
        setSelectedContract(fallback);
      })
      .finally(() => setLoading(false));
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract) return;

    setReviewStatus("submitting");
    setReviewMessage(null);

    try {
      const res = await reviewUpdateContract(selectedContract, reviewerToken, reviewNotes);
      setReviewStatus("success");
      setReviewMessage(`Baseline updated successfully for ${res.contractId} v${res.version} by ${res.reviewedBy}.`);
      setTimeout(() => {
        setShowReviewModal(false);
        setReviewStatus("idle");
        setReviewMessage(null);
        setReviewerToken("");
        setReviewNotes("");
      }, 2000);
    } catch (err: unknown) {
      setReviewStatus("error");
      setReviewMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSynthesize = async (e: React.FormEvent) => {
    e.preventDefault();
    setSynthStatus("synthesizing");
    setSynthMessage(null);

    try {
      const result = await synthesizeContractApi({
        taskDescription: synthTask,
        targetFile: synthFile,
        targetFunction: synthFunc,
        testCode: synthTestCode,
        author: "Developer Console Synthesizer",
      });

      const newContract = result.contract;
      setContracts((prev) => [newContract, ...prev.filter((c) => c.id !== newContract.id)]);
      setSelectedContract(newContract);
      setSynthStatus("success");
      setSynthMessage(`Synthesized contract '${newContract.id}' with ${newContract.cases.length} invariant cases.`);

      setTimeout(() => {
        setShowSynthesizeModal(false);
        setSynthStatus("idle");
        setSynthMessage(null);
      }, 1800);
    } catch (err: unknown) {
      setSynthStatus("error");
      setSynthMessage(err instanceof Error ? err.message : String(err));
    }
  };

  // Determine if current scenario ran cases against this contract
  const hasReplayed = currentScenarioId === "weakened-assertion" || currentScenarioId === "honest-fix";
  const attemptedTamper = currentScenarioId === "weakened-assertion";

  return (
    <div ref={containerRef} className="flex-1 p-6 bg-surface-base overflow-y-auto font-sans" role="region" aria-label="Contract Explorer Workspace">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary">Contract Explorer</h1>
            <p className="text-xs text-text-secondary mt-1">
              Independently approved behavioral invariants evaluated during isolated replay. Candidate patches cannot rewrite their own contracts.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSynthesizeModal(true)}
              data-testid="synthesize-contract-btn"
              className="px-3 py-1.5 text-xs font-mono font-medium rounded bg-brand-primary text-white hover:opacity-90 shadow-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Synthesize Contract</span>
            </button>
            <button
              onClick={() => setShowReviewModal(true)}
              data-testid="request-baseline-update-btn"
              className="px-3 py-1.5 text-xs font-mono font-medium rounded bg-surface-panel border border-border-default hover:border-border-strong text-text-primary shadow-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
            >
              <Lock className="w-3.5 h-3.5 text-brand-primary" />
              <span>Review & Update Baseline</span>
            </button>
          </div>
        </div>

        {/* Security Alert: Immutability Guarantee */}
        <div className="p-4 rounded-xl bg-status-pass-bg border border-status-pass-border text-xs text-status-pass-text flex items-start space-x-3">
          <ShieldCheck className="w-4 h-4 text-status-pass-solid shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Baseline Immutability Enforced</span>
            <p className="text-[11px] text-status-pass-text/90">
              Contract files loaded from trusted baselines are completely read-only during patch evaluation. Rule <code className="font-mono font-bold">CONTRACT-MODIFIED</code> immediately flags and halts any PR attempting to modify contract expectations.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-text-tertiary">Loading contracts...</div>
        ) : contracts.length === 0 ? (
          <div className="p-8 bg-surface-panel border border-border-default rounded-xl text-center text-xs text-text-tertiary">
            No contracts registered in system.
          </div>
        ) : (
          <motion.div
            variants={STAGGER_CONTAINER_VARIANTS}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {contracts.map((contract) => (
              <motion.div
                key={contract.id}
                variants={STAGGER_ITEM_VARIANTS}
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : { y: -2.5, transition: { type: "spring", stiffness: 420, damping: 26 } }
                }
                data-testid={`contract-card-${contract.id}`}
                className="bg-surface-panel border border-border-default rounded-xl p-5 space-y-4 shadow-xs hover:border-border-strong transition-colors"
              >
              <div className="flex items-start justify-between border-b border-border-default pb-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-sm text-brand-primary">{contract.id}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-status-pass-bg text-status-pass-text border border-status-pass-border font-semibold">
                      v{contract.version} (Approved)
                    </span>
                    {attemptedTamper && (
                      <span
                        data-testid="contract-tamper-flag"
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-status-blocked-bg text-status-blocked-text border border-status-blocked-border font-bold flex items-center space-x-1"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Tamper Attempt Blocked</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">{contract.description}</p>
                </div>
                <div className="text-[11px] font-mono text-text-tertiary text-right space-y-0.5 shrink-0 pl-4">
                  <div>Approved by: <span className="text-text-secondary font-medium">{contract.approvedBy || "Security Board"}</span></div>
                  <div>Target: <code className="text-brand-primary">{contract.targetFile}</code> &rarr; <code className="text-brand-primary">{contract.targetFunction}()</code></div>
                  {contract.approvedAt && <div>Approved Date: {new Date(contract.approvedAt).toLocaleDateString()}</div>}
                </div>
              </div>

              {/* Invariant Cases Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider">
                    Protected Invariant Cases ({contract.cases.length})
                  </span>
                  <span className="text-[10px] font-mono text-text-tertiary">
                    {hasReplayed ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Active in Replay Runner</span>
                    ) : (
                      "Not triggered in current scenario"
                    )}
                  </span>
                </div>
                <div className="border border-border-default rounded overflow-hidden">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-surface-subtle border-b border-border-default text-text-secondary">
                      <tr>
                        <th className="p-2.5">Case ID</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5">Input Arguments</th>
                        <th className="p-2.5">Approved Expectation</th>
                        <th className="p-2.5 text-right">Replay Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default">
                      {contract.cases.map((c) => {
                        const isViolated = attemptedTamper && c.id === "case-1000-cents-10-pct";
                        return (
                          <tr key={c.id} className="hover:bg-surface-subtle transition-colors">
                            <td className="p-2.5 font-semibold text-text-primary">{c.id}</td>
                            <td className="p-2.5 text-text-secondary max-w-xs">{c.name || c.description}</td>
                            <td className="p-2.5 text-brand-primary font-mono text-[11px]">
                              {JSON.stringify(c.input)}
                            </td>
                            <td className="p-2.5 text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                              {JSON.stringify(c.expected)} cents
                            </td>
                            <td className="p-2.5 text-right font-mono text-[10px]">
                              {isViolated ? (
                                <span className="px-1.5 py-0.5 rounded bg-status-blocked-bg text-status-blocked-text border border-status-blocked-border font-bold">
                                  VIOLATED (Returned 1000)
                                </span>
                              ) : hasReplayed ? (
                                <span className="px-1.5 py-0.5 rounded bg-status-pass-bg text-status-pass-text border border-status-pass-border font-bold">
                                  PASSED (Replayed)
                                </span>
                              ) : (
                                <span className="text-text-tertiary">Registered Baseline</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Review & Update Baseline Modal */}
        <AnimatePresence>
          {showReviewModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={TRANSITION_FAST}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans"
              role="dialog"
              aria-modal="true"
              aria-label="Review and Update Contract Baseline"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={TRANSITION_PANEL}
                className="bg-surface-panel border border-border-default rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl"
              >
                <div className="flex items-start justify-between border-b border-border-default pb-3">
                  <div className="flex items-center space-x-2">
                    <KeyRound className="w-4 h-4 text-brand-primary" />
                    <h3 className="text-sm font-bold text-text-primary">Explicit Baseline Review & Update</h3>
                  </div>
                  <button
                    onClick={() => setShowReviewModal(false)}
                    className="text-xs text-text-tertiary hover:text-text-primary"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed">
                  Updating an approved contract baseline requires explicit Security Council authority. Automated or agent-proposed PRs are rejected.
                </p>

                <form onSubmit={handleReviewSubmit} className="space-y-3">
                  <div>
                    <label htmlFor="reviewer-token" className="block text-[11px] font-mono font-bold text-text-secondary mb-1">
                      Reviewer Authorization Token
                    </label>
                    <input
                      id="reviewer-token"
                      type="password"
                      data-testid="reviewer-token-input"
                      value={reviewerToken}
                      onChange={(e) => setReviewerToken(e.target.value)}
                      placeholder="Enter SEC-COUNCIL-APPROVED-OVERRIDE"
                      className="w-full h-8 px-2.5 text-xs font-mono bg-surface-subtle border border-border-default rounded text-text-primary focus:outline-none focus:border-border-strong"
                      required
                    />
                    <span className="text-[10px] text-text-tertiary mt-1 block">
                      Demo override token: <code className="font-mono">SEC-COUNCIL-APPROVED-OVERRIDE</code>
                    </span>
                  </div>

                  <div>
                    <label htmlFor="review-notes" className="block text-[11px] font-mono font-bold text-text-secondary mb-1">
                      Review Rationale / Changelog Notes
                    </label>
                    <textarea
                      id="review-notes"
                      data-testid="review-notes-input"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={2}
                      placeholder="Document justification for invariant evolution"
                      className="w-full p-2 text-xs bg-surface-subtle border border-border-default rounded text-text-primary focus:outline-none focus:border-border-strong"
                    />
                  </div>

                  {reviewMessage && (
                    <div
                      ref={reviewMessageRef}
                      className={`p-2.5 rounded text-xs font-mono scroll-mt-2 ${
                        reviewStatus === "success"
                          ? "bg-status-pass-bg text-status-pass-text border border-status-pass-border"
                          : "bg-status-blocked-bg text-status-blocked-text border border-status-blocked-border"
                      }`}
                    >
                      {reviewMessage}
                    </div>
                  )}

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border-default">
                    <button
                      type="button"
                      onClick={() => setShowReviewModal(false)}
                      className="px-3 py-1.5 text-xs font-mono rounded text-text-secondary hover:bg-surface-subtle"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      data-testid="submit-baseline-update-btn"
                      disabled={reviewStatus === "submitting"}
                      className="px-3 py-1.5 text-xs font-mono font-bold rounded bg-brand-primary text-white dark:text-slate-950 hover:opacity-90 disabled:opacity-50"
                    >
                      {reviewStatus === "submitting" ? "Verifying..." : "Authorize Baseline Update"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}

          {showSynthesizeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={TRANSITION_FAST}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans"
              role="dialog"
              aria-modal="true"
              aria-label="Synthesize Invariant Behavior Contract"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={TRANSITION_PANEL}
                className="bg-surface-panel border border-border-default rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl"
              >
                <div className="flex items-start justify-between border-b border-border-default pb-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-brand-primary" />
                    <h3 className="text-sm font-bold text-text-primary">Synthesize Invariant Behavior Contract</h3>
                  </div>
                  <button
                    onClick={() => setShowSynthesizeModal(false)}
                    className="text-xs text-text-tertiary hover:text-text-primary"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed">
                  Synthesize an executable invariant contract from task requirements and test assertions. Creates an independent boundary ground truth that candidate patches cannot weaken.
                </p>

                <form onSubmit={handleSynthesize} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="synth-file" className="block text-[11px] font-mono font-bold text-text-secondary mb-1">
                        Target File
                      </label>
                      <input
                        id="synth-file"
                        type="text"
                        data-testid="synth-file-input"
                        value={synthFile}
                        onChange={(e) => setSynthFile(e.target.value)}
                        placeholder="src/discount.ts"
                        className="w-full h-8 px-2.5 text-xs font-mono bg-surface-subtle border border-border-default rounded text-text-primary focus:outline-none focus:border-border-strong"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="synth-func" className="block text-[11px] font-mono font-bold text-text-secondary mb-1">
                        Target Function
                      </label>
                      <input
                        id="synth-func"
                        type="text"
                        data-testid="synth-func-input"
                        value={synthFunc}
                        onChange={(e) => setSynthFunc(e.target.value)}
                        placeholder="calculateDiscount"
                        className="w-full h-8 px-2.5 text-xs font-mono bg-surface-subtle border border-border-default rounded text-text-primary focus:outline-none focus:border-border-strong"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="synth-task" className="block text-[11px] font-mono font-bold text-text-secondary mb-1">
                      Task Description / Functional Invariant
                    </label>
                    <input
                      id="synth-task"
                      type="text"
                      data-testid="synth-task-input"
                      value={synthTask}
                      onChange={(e) => setSynthTask(e.target.value)}
                      placeholder="e.g. Ensure calculateDiscount(1000, 10) returns 900"
                      className="w-full h-8 px-2.5 text-xs font-mono bg-surface-subtle border border-border-default rounded text-text-primary focus:outline-none focus:border-border-strong"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="synth-tests" className="block text-[11px] font-mono font-bold text-text-secondary mb-1">
                      Test Suite / Assertion Snippet
                    </label>
                    <textarea
                      id="synth-tests"
                      data-testid="synth-tests-input"
                      value={synthTestCode}
                      onChange={(e) => setSynthTestCode(e.target.value)}
                      rows={4}
                      placeholder="expect(calculateDiscount(1000, 10)).toBe(900);"
                      className="w-full p-2 text-xs font-mono bg-surface-subtle border border-border-default rounded text-text-primary focus:outline-none focus:border-border-strong leading-relaxed"
                    />
                  </div>

                  {synthMessage && (
                    <div
                      className={`p-2.5 rounded text-xs font-mono ${
                        synthStatus === "success"
                          ? "bg-status-pass-bg text-status-pass-text border border-status-pass-border"
                          : "bg-status-blocked-bg text-status-blocked-text border border-status-blocked-border"
                      }`}
                    >
                      {synthMessage}
                    </div>
                  )}

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border-default">
                    <button
                      type="button"
                      onClick={() => setShowSynthesizeModal(false)}
                      className="px-3 py-1.5 text-xs font-mono rounded text-text-secondary hover:bg-surface-subtle"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      data-testid="submit-synthesize-btn"
                      disabled={synthStatus === "synthesizing"}
                      className="px-3 py-1.5 text-xs font-mono font-bold rounded bg-brand-primary text-white hover:opacity-90 disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{synthStatus === "synthesizing" ? "Synthesizing..." : "Synthesize Invariant Contract"}</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
