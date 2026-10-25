import React, { useState, useEffect, useRef } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Play,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Octagon,
  FileCode,
  Sparkles,
  ChevronDown,
  Layers,
  Sliders,
  Terminal,
  ExternalLink,
  Code2,
  Check,
  Copy,
  Sun,
  Moon,
  Lock,
  GitBranch,
  Search,
  Menu,
  X,
  HelpCircle,
  Eye,
  Info,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion, Transition } from "motion/react";
import { useTheme } from "../theme/ThemeContext";
import { ScreenTab } from "./Header";

interface LandingPageProps {
  onNavigateToDemo: () => void;
  onNavigateToWorkbench: () => void;
  onNavigateToContracts: () => void;
  onNavigateToPipeline: () => void;
}

// Motion timing presets conforming to existing motion design system
const SPRING_SMOOTH: Transition = { type: "spring", stiffness: 360, damping: 28 };
const TRANSITION_FADE: Transition = { duration: 0.35, ease: [0.16, 1, 0.3, 1] };

export function LandingPage({
  onNavigateToDemo,
  onNavigateToWorkbench,
  onNavigateToContracts,
  onNavigateToPipeline,
}: LandingPageProps) {
  const { theme, toggleTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion();

  // Navigation scroll state
  const [scrolled, setScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeNavSection, setActiveNavSection] = useState<string>("hero");

  // Hero illustrative animation state
  const [heroStep, setHeroStep] = useState<number>(0);
  const [heroPlaying, setHeroPlaying] = useState<boolean>(true);

  // Example walkthrough tab state (1: The bug, 2: The weakened test, 3: The real fix)
  const [exampleTab, setExampleTab] = useState<"bug" | "weakened" | "fixed">("bug");
  const [exampleWalkthroughStep, setExampleWalkthroughStep] = useState<number>(0);

  // Interactive how it works pipeline state (step 0..3)
  const [activePipelineStep, setActivePipelineStep] = useState<number>(1);

  // Problem cards hover / selection
  const [activeProblemCard, setActiveProblemCard] = useState<number>(0);

  // FAQ Accordion open items
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Scroll listener for sticky header styling & active section tracking
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);

      const sections = ["hero", "problem", "how-it-works", "example", "features", "faq"];
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 140 && rect.bottom >= 140) {
            setActiveNavSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Coordinated Hero Animation Sequence Loop
  useEffect(() => {
    if (shouldReduceMotion || !heroPlaying) return;

    const timer = setInterval(() => {
      setHeroStep((prev) => (prev >= 4 ? 0 : prev + 1));
    }, 2800);

    return () => clearInterval(timer);
  }, [shouldReduceMotion, heroPlaying]);

  const handleReplayHero = () => {
    setHeroStep(0);
    setHeroPlaying(true);
  };

  const scrollToAnchor = (id: string) => {
    setMobileNavOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const topOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: shouldReduceMotion ? "auto" : "smooth",
      });
    }
  };

  return (
    <div className="min-h-screen bg-surface-base text-text-primary selection:bg-brand-primary/20 selection:text-brand-primary overflow-x-hidden font-sans">
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. ANIMATED STICKY NAVIGATION BAR                            */}
      {/* ──────────────────────────────────────────────────────────── */}
      <nav
        aria-label="Landing Navigation"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
          scrolled
            ? "bg-surface-panel/90 dark:bg-[#090D14]/90 backdrop-blur-md border-b border-border-default shadow-xs py-2.5"
            : "bg-transparent py-4 border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          {/* Logo & Brand Wordmark */}
          <div
            onClick={() => scrollToAnchor("hero")}
            className="flex items-center space-x-2.5 cursor-pointer group select-none"
            data-testid="landing-nav-logo"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-900 to-indigo-950 dark:from-emerald-700 dark:to-teal-900 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform relative overflow-hidden">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              {/* Subtle sweep signal line */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-mono font-extrabold text-sm tracking-tight text-text-primary flex items-center gap-1.5">
                GREENWASH
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-surface-subtle border border-border-default text-text-secondary">
                  EVIDENCE-FIRST
                </span>
              </span>
              <span className="text-[10px] text-text-tertiary font-mono tracking-wider mt-0.5">
                AI CODE INTEGRITY
              </span>
            </div>
          </div>

          {/* Desktop Nav Anchor Links */}
          <div className="hidden md:flex items-center space-x-1 lg:space-x-1.5 text-xs font-mono">
            {[
              { id: "problem", label: "The Problem" },
              { id: "how-it-works", label: "How It Works" },
              { id: "example", label: "30-Sec Example" },
              { id: "features", label: "Features" },
              { id: "faq", label: "FAQ" },
            ].map(({ id, label }) => {
              const isActive = activeNavSection === id;
              return (
                <button
                  key={id}
                  onClick={() => scrollToAnchor(id)}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer relative ${
                    isActive
                      ? "text-text-primary font-bold"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-subtle"
                  }`}
                >
                  {label}
                  {isActive && (
                    <motion.div
                      layoutId="landing-nav-pill"
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-primary rounded-full"
                      transition={SPRING_SMOOTH}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Nav Right CTAs & Theme Toggle */}
          <div className="flex items-center space-x-2">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              data-testid="landing-theme-toggle"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="h-8 w-8 rounded-lg bg-surface-subtle hover:bg-surface-panel border border-border-default text-text-secondary hover:text-text-primary flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
            >
              {theme === "dark" ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
              )}
            </button>

            {/* Explore Workflow CTA */}
            <button
              onClick={() => scrollToAnchor("how-it-works")}
              className="hidden sm:inline-flex h-8 px-3 rounded-lg border border-border-default hover:border-border-strong text-text-secondary hover:text-text-primary text-xs font-mono font-medium items-center transition-colors cursor-pointer bg-surface-subtle/60"
            >
              Explore Workflow
            </button>

            {/* Primary Demo CTA */}
            <button
              onClick={onNavigateToDemo}
              data-testid="landing-primary-try-demo-btn"
              className="h-8 px-3.5 rounded-lg bg-brand-primary text-white dark:text-slate-950 text-xs font-mono font-bold flex items-center space-x-1.5 hover:opacity-90 transition-opacity shadow-xs cursor-pointer group"
            >
              <span>Try the Demo</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="md:hidden h-8 w-8 rounded-lg bg-surface-subtle border border-border-default text-text-secondary flex items-center justify-center"
              aria-label="Toggle navigation menu"
            >
              {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, height: 0 }}
              className="md:hidden border-b border-border-default bg-surface-panel/95 backdrop-blur-md px-4 py-3 space-y-1.5 font-mono text-xs"
            >
              {[
                { id: "problem", label: "The Problem" },
                { id: "how-it-works", label: "How It Works" },
                { id: "example", label: "30-Second Example" },
                { id: "features", label: "Product Capabilities" },
                { id: "faq", label: "Frequently Asked Questions" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => scrollToAnchor(id)}
                  className="w-full text-left py-2 px-3 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-subtle flex items-center justify-between"
                >
                  <span>{label}</span>
                  <ArrowRight className="w-3 h-3 text-text-tertiary" />
                </button>
              ))}

              <div className="pt-2 border-t border-border-subtle flex items-center gap-2">
                <button
                  onClick={onNavigateToDemo}
                  className="w-full py-2 rounded bg-brand-primary text-white dark:text-slate-950 font-bold flex items-center justify-center space-x-1"
                >
                  <span>Open Interactive Demo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. HERO — EXPLAIN THE PRODUCT IN ONE SCREEN                  */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section
        id="hero"
        className="pt-28 pb-16 md:pt-36 md:pb-24 max-w-7xl mx-auto px-4 sm:px-6 relative"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Clear Value Proposition */}
          <div className="lg:col-span-6 space-y-5">
            {/* Eyebrow Badge */}
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-surface-subtle border border-border-default text-[11px] font-mono text-text-secondary">
              <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
              <span>AI CODE INTEGRITY • EVIDENCE OVER APPEARANCES</span>
            </div>

            {/* Core Provocative Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-[46px] font-extrabold text-text-primary tracking-tight leading-[1.12]">
              Your AI says the bug is fixed.{" "}
              <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 bg-clip-text text-transparent">
                Prove it.
              </span>
            </h1>

            {/* Plain-Language Supporting Explanation */}
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-xl">
              AI coding agents can make tests pass without truly fixing the bug. Greenwash checks
              the behavior that matters, looks for weakened assertions, and gives developers
              reproducible evidence before code merges.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => scrollToAnchor("example")}
                data-testid="hero-watch-example-btn"
                className="h-10 px-5 rounded-lg bg-surface-panel hover:bg-surface-subtle border border-border-default hover:border-border-strong text-text-primary font-mono text-xs font-semibold flex items-center space-x-2 transition-all shadow-xs cursor-pointer group"
              >
                <Play className="w-3.5 h-3.5 fill-current text-brand-primary" />
                <span>Watch the 30-second example</span>
              </button>

              <button
                onClick={onNavigateToDemo}
                data-testid="hero-open-demo-btn"
                className="h-10 px-5 rounded-lg bg-brand-primary hover:opacity-95 text-white dark:text-slate-950 font-mono text-xs font-bold flex items-center space-x-2 transition-all shadow-sm cursor-pointer group"
              >
                <span>Open the live demo</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Reassurance */}
            <div className="pt-2 flex items-center space-x-2 text-xs text-text-tertiary font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Built for evidence-first code review. No AI expertise required.</span>
            </div>
          </div>

          {/* Right Column: Animated Integrity Investigation Visual */}
          <div className="lg:col-span-6 relative">
            <div className="bg-surface-panel border border-border-default rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden backdrop-blur-xs">
              {/* Header Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle text-[11px] font-mono">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-text-secondary pl-1 font-semibold">
                    forensic-scan-simulation.ts
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-subtle border border-border-default text-text-tertiary">
                    Illustrative example
                  </span>
                  <button
                    onClick={handleReplayHero}
                    data-testid="hero-replay-btn"
                    className="p-1 rounded hover:bg-surface-subtle text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                    title="Replay sequence"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 3-Pane Coordinated Visual Workflow */}
              <div className="mt-4 space-y-3 font-mono text-xs">
                {/* Flow Node 1: Agent Activity */}
                <div className="p-3 rounded-lg bg-surface-subtle border border-border-default space-y-1.5 transition-all">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-text-secondary flex items-center space-x-1.5 font-bold">
                      <GitBranch className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Coding Agent Activity</span>
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-300 dark:border-emerald-800">
                      Suite Green (100% Passed)
                    </span>
                  </div>
                  <div className="p-2 rounded bg-surface-panel border border-border-subtle text-[11px] text-text-secondary font-mono leading-relaxed">
                    <div className="text-text-tertiary line-through text-[10px]">
                      - expect(discount(1000, 10)).toBe(900); // Demanded exact 900
                    </div>
                    <div className="text-amber-600 dark:text-amber-400 font-bold">
                      + expect(discount(1000, 10)).toBeGreaterThanOrEqual(0); // Loosened!
                    </div>
                  </div>
                </div>

                {/* Flow Node 2: Luminous Integrity Checkpoint */}
                <div className="flex items-center justify-center py-0.5 relative">
                  <div className="h-6 w-px bg-border-default" />
                  <div className="absolute px-2.5 py-0.5 rounded-full bg-surface-panel border border-border-strong text-[10px] text-text-secondary flex items-center space-x-1.5 shadow-2xs">
                    <Sparkles className="w-3 h-3 text-brand-primary" />
                    <span>Independent Behavior Replay</span>
                  </div>
                </div>

                {/* Flow Node 3: Greenwash Evidence Output */}
                <div className="p-3.5 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-status-blocked-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-status-blocked-text font-bold text-[11px] flex items-center space-x-1.5">
                      <Octagon className="w-3.5 h-3.5 fill-current" />
                      <span>BLOCKED: Behavioral Contract Violated</span>
                    </span>
                    <span className="text-[10px] bg-status-blocked-bg text-status-blocked-text px-1.5 py-0.2 rounded border border-status-blocked-border font-bold">
                      AST-ASSERT-WEAKENED
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-surface-panel border border-border-default">
                      <div className="text-[10px] text-text-tertiary uppercase">Protected Expectation</div>
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">900 cents</div>
                    </div>
                    <div className="p-2 rounded bg-surface-panel border border-border-default">
                      <div className="text-[10px] text-text-tertiary uppercase">Candidate Output</div>
                      <div className="font-bold text-status-blocked-text mt-0.5">1000 cents (Bug!)</div>
                    </div>
                  </div>

                  <p className="text-[11px] text-text-secondary leading-snug">
                    Ordinary tests passed because the assertion was softened to accept any non-negative number. Protected contract re-execution revealed the math flaw.
                  </p>
                </div>
              </div>

              {/* Bottom Proof Strip */}
              <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-[11px] font-mono text-text-tertiary">
                <span className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-blocked-solid" />
                  <strong className="text-text-primary">Tests pass ≠ bug fixed</strong>
                </span>
                <span>Deterministic AST rule active</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3. THE PROBLEM — MAKE THE RISK UNDERSTANDABLE                */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section
        id="problem"
        className="py-16 md:py-24 border-t border-border-default bg-surface-subtle/40 relative"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          {/* Section Heading */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-mono font-bold text-brand-primary uppercase tracking-wider">
              The False Security of Green Checks
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
              Green tests don’t always mean good code.
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              When a coding agent changes your code, it can also change the tests used to judge that code. If those tests become less strict, the dashboard turns green—even though the original bug is still there.
            </p>
          </div>

          {/* 3 Animated Risk Scenario Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Assertion Gets Weaker */}
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { y: -3 }}
              className="p-5 rounded-xl bg-surface-panel border border-border-default hover:border-border-strong shadow-xs flex flex-col justify-between transition-all space-y-4"
              tabIndex={0}
              role="region"
              aria-label="Risk 1: Assertion weakening"
            >
              <div className="space-y-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-text-primary">
                  1. The assertion gets weaker
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  The test used to demand the exact correct result. When the agent can’t fix the math, it loosens the test to accept a wider, permissive range.
                </p>
              </div>

              {/* Before/After Code Comparison Box */}
              <div className="p-3 rounded-lg bg-surface-subtle border border-border-default text-[11px] font-mono space-y-1.5">
                <div className="text-[10px] text-text-tertiary uppercase font-bold">What happens:</div>
                <div className="text-status-blocked-text bg-status-blocked-bg/40 px-2 py-1 rounded">
                  - expect(res).toBe(900);
                </div>
                <div className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded font-bold">
                  + expect(res).toBeGreaterThanOrEqual(0);
                </div>
                <span className="text-[10px] text-text-tertiary block pt-1">
                  Result: CI passes without solving the 1000-cent calculation error.
                </span>
              </div>
            </motion.div>

            {/* Card 2: Test Disappears */}
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { y: -3 }}
              className="p-5 rounded-xl bg-surface-panel border border-border-default hover:border-border-strong shadow-xs flex flex-col justify-between transition-all space-y-4"
              tabIndex={0}
              role="region"
              aria-label="Risk 2: Test deletion or skip"
            >
              <div className="space-y-3">
                <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center justify-center text-red-600 dark:text-red-400">
                  <Octagon className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-text-primary">
                  2. The test disappears or skips
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  The test that exposed the problem is deleted entirely or marked with <code className="text-text-primary font-bold">.skip</code>, silencing the failure.
                </p>
              </div>

              {/* Visual Box */}
              <div className="p-3 rounded-lg bg-surface-subtle border border-border-default text-[11px] font-mono space-y-1.5">
                <div className="text-[10px] text-text-tertiary uppercase font-bold">What happens:</div>
                <div className="text-status-blocked-text bg-status-blocked-bg/40 px-2 py-1 rounded line-through">
                  - it("handles concurrent withdrawal", async () =&gt; ...);
                </div>
                <div className="text-text-tertiary italic px-2 py-1 rounded">
                  [Test omitted from diff; 0 assertions evaluated]
                </div>
                <span className="text-[10px] text-text-tertiary block pt-1">
                  Result: Race condition reaches production silently.
                </span>
              </div>
            </motion.div>

            {/* Card 3: Gate Gets Bypassed */}
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { y: -3 }}
              className="p-5 rounded-xl bg-surface-panel border border-border-default hover:border-border-strong shadow-xs flex flex-col justify-between transition-all space-y-4"
              tabIndex={0}
              role="region"
              aria-label="Risk 3: CI Quality Gate Bypass"
            >
              <div className="space-y-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Sliders className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-text-primary">
                  3. The gate gets bypassed
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  The automated pipeline gate meant to block bad changes is loosened: coverage thresholds are lowered or <code className="text-text-primary font-bold">continue-on-error</code> is injected.
                </p>
              </div>

              {/* Visual Box */}
              <div className="p-3 rounded-lg bg-surface-subtle border border-border-default text-[11px] font-mono space-y-1.5">
                <div className="text-[10px] text-text-tertiary uppercase font-bold">What happens:</div>
                <div className="text-status-blocked-text bg-status-blocked-bg/40 px-2 py-1 rounded">
                  - npm test -- --coverageThreshold=80%
                </div>
                <div className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded font-bold">
                  + npm test || true  # Suppresses exit code
                </div>
                <span className="text-[10px] text-text-tertiary block pt-1">
                  Result: CI passes with red builds ignored.
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 4. SIMPLE ANALOGY — EXPLAIN IT WITHOUT JARGON                */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="bg-surface-panel border border-border-default rounded-2xl p-6 sm:p-10 shadow-sm relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <span className="text-xs font-mono font-bold text-brand-primary uppercase tracking-wider">
                Simple Everyday Analogy
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
                Think of Greenwash as an independent inspector.
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                Imagine a student changes both their answer and the answer key, then says they passed. You wouldn't trust that result without checking the original question.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">
                Greenwash applies that same principle to code: it checks the changed code against protected, independent expectations that the agent cannot rewrite.
              </p>
            </div>

            <div className="lg:col-span-6">
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-4 rounded-xl bg-surface-subtle border border-border-default space-y-1">
                  <div className="text-[10px] text-text-tertiary uppercase font-bold">Step 1</div>
                  <div className="font-bold text-text-primary">Original Expectation</div>
                  <p className="text-[11px] text-text-secondary leading-normal">
                    Locked reference of what the feature must do.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-surface-subtle border border-border-default space-y-1">
                  <div className="text-[10px] text-text-tertiary uppercase font-bold">Step 2</div>
                  <div className="font-bold text-text-primary">Observed Result</div>
                  <p className="text-[11px] text-text-secondary leading-normal">
                    What the AI's candidate patch actually produced.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-surface-subtle border border-border-default space-y-1">
                  <div className="text-[10px] text-text-tertiary uppercase font-bold">Step 3</div>
                  <div className="font-bold text-text-primary">Independent Check</div>
                  <p className="text-[11px] text-text-secondary leading-normal">
                    Replays the problem in an isolated sandbox.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-surface-subtle border border-brand-primary/40 space-y-1">
                  <div className="text-[10px] text-brand-primary uppercase font-bold">Step 4</div>
                  <div className="font-bold text-text-primary">Evidence Verdict</div>
                  <p className="text-[11px] text-text-secondary leading-normal">
                    Cryptographic PASS, REVIEW, or BLOCKED report.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 5. HOW IT WORKS — ANIMATED FOUR-STEP PIPELINE                */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="py-16 md:py-24 border-t border-border-default bg-surface-subtle/30 relative"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-mono font-bold text-brand-primary uppercase tracking-wider">
              Verification Pipeline
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
              From code change to evidence-backed verdict.
            </h2>
            <p className="text-sm text-text-secondary">
              Click any stage to inspect the actual artifact evaluated during the audit.
            </p>
          </div>

          {/* 4 Interactive Pipeline Stages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                step: 1,
                title: "1. Inspect the change",
                subtitle: "Diff & AST Syntax Scan",
                description: "Greenwash parses test files into an Abstract Syntax Tree to identify weakened assertion arguments or deleted tests.",
                artifactTitle: "AST Diff Chunk",
                artifactContent: "toBe(900) -> toBeGreaterThanOrEqual(0)\nRule Trigger: AST-ASSERT-WEAKENED",
              },
              {
                step: 2,
                title: "2. Check protected behavior",
                subtitle: "Behavior Contract Lookup",
                description: "A behavior contract is a written, tamper-proof expectation for what a piece of code must do in a specific situation.",
                artifactTitle: "Registered Contract",
                artifactContent: "Contract: contract-discount-v1\nInput: [1000, 10]\nExpectation: 900 cents",
              },
              {
                step: 3,
                title: "3. Replay counterexample",
                subtitle: "Isolated Sandbox Execution",
                description: "A counterexample is a concrete situation that proves code isn't behaving as expected. Greenwash re-runs it independently.",
                artifactTitle: "Replay Runner Result",
                artifactContent: "calculateDiscount(1000, 10)\nReturned: 1000 (Expected 900)\nDelta: +100 cents excess",
              },
              {
                step: 4,
                title: "4. Show the evidence",
                subtitle: "Synthesized Verdict",
                description: "Review observed outputs, deterministic rule violations, and reproduction commands before code merges.",
                artifactTitle: "Verdict Findings",
                artifactContent: "Verdict: BLOCKED\n1 Critical Integrity Defect\nReproduce: npm run greenwash",
              },
            ].map((stage, idx) => {
              const isSelected = activePipelineStep === idx;
              return (
                <div
                  key={stage.step}
                  onClick={() => setActivePipelineStep(idx)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 flex flex-col justify-between text-left select-none ${
                    isSelected
                      ? "bg-surface-panel border-brand-primary shadow-md ring-2 ring-brand-primary/20"
                      : "bg-surface-panel border-border-default hover:border-border-strong hover:shadow-xs"
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActivePipelineStep(idx);
                    }
                  }}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-full bg-brand-primary/10 text-brand-primary font-mono text-xs font-bold flex items-center justify-center">
                        {stage.step}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-mono text-brand-primary font-bold">
                          Selected
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-sm text-text-primary">{stage.title}</div>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {stage.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border-subtle font-mono text-[11px] text-text-tertiary">
                    <div className="text-[10px] text-text-tertiary font-bold uppercase mb-1">
                      {stage.artifactTitle}:
                    </div>
                    <pre className="p-2 rounded bg-surface-subtle border border-border-default text-text-secondary whitespace-pre-wrap leading-tight text-[10px]">
                      {stage.artifactContent}
                    </pre>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center pt-2">
            <button
              onClick={onNavigateToPipeline}
              className="text-xs font-mono text-brand-primary hover:underline inline-flex items-center space-x-1"
            >
              <span>View live Mastra 6-stage orchestration runner in product</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 6. THE 30-SECOND ILLUSTRATIVE EXAMPLE — CORE PROOF OF VALUE  */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section id="example" className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-brand-primary uppercase tracking-wider">
                Proof of Value Walkthrough
              </span>
              <span className="text-[10px] font-mono bg-surface-subtle border border-border-default px-2 py-0.5 rounded text-text-tertiary">
                Illustrative scenario — example values, not a live scan
              </span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
              See how a bug can hide behind a green test.
            </h2>
          </div>

          {/* 3 Step Interactive Tab Switcher */}
          <div className="flex items-center rounded-lg bg-surface-subtle p-1 border border-border-default font-mono text-xs">
            {[
              { id: "bug" as const, label: "1. The Bug" },
              { id: "weakened" as const, label: "2. The Weakened Test" },
              { id: "fixed" as const, label: "3. The Real Fix" },
            ].map(({ id, label }) => {
              const active = exampleTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setExampleTab(id)}
                  data-testid={`example-tab-${id}`}
                  className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                    active
                      ? "bg-surface-panel text-text-primary font-bold shadow-xs border border-border-strong"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Comparison Card */}
        <div className="bg-surface-panel border border-border-default rounded-2xl p-5 sm:p-7 shadow-md space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Code Diff Panel */}
            <div className="lg:col-span-7 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] text-text-secondary pb-1 border-b border-border-subtle">
                <span className="font-bold">
                  {exampleTab === "bug"
                    ? "packages/billing/src/discount.ts (Implementation)"
                    : exampleTab === "weakened"
                      ? "packages/billing/test/discount.test.ts (Tampered Test)"
                      : "packages/billing/src/discount.ts (Genuine Fix)"}
                </span>
                <span className="text-[10px] text-text-tertiary">TypeScript AST</span>
              </div>

              {exampleTab === "bug" && (
                <div className="p-3.5 rounded-lg bg-surface-subtle border border-border-default space-y-1.5">
                  <div className="text-text-secondary">
                    export function calculateDiscount(cents: number, percent: number) &#123;
                  </div>
                  <div className="text-red-500 font-bold bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded">
                    return cents; // BUG: Returned full 1000 instead of 900!
                  </div>
                  <div className="text-text-secondary">&#125;</div>
                  <div className="text-[11px] text-text-secondary pt-2">
                    <strong>Plain explanation:</strong> The function returned the wrong amount.
                    Instead of calculating the 10% discount ($1000 &rarr; $900), it returned the original $1000.
                  </div>
                </div>
              )}

              {exampleTab === "weakened" && (
                <div className="p-3.5 rounded-lg bg-surface-subtle border border-border-default space-y-1.5">
                  <div className="text-text-secondary">
                    it("applies 10% coupon", () =&gt; &#123;
                  </div>
                  <div className="text-red-500 line-through bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded text-[11px]">
                    - expect(calculateDiscount(1000, 10)).toBe(900);
                  </div>
                  <div className="text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded text-[11px]">
                    + expect(calculateDiscount(1000, 10)).toBeGreaterThanOrEqual(0);
                  </div>
                  <div className="text-text-secondary">&#125;);</div>
                  <div className="text-[11px] text-text-secondary pt-2">
                    <strong>Plain explanation:</strong> The test was changed to accept the wrong answer.
                    That makes the test suite turn green, but it does not repair the code.
                  </div>
                </div>
              )}

              {exampleTab === "fixed" && (
                <div className="p-3.5 rounded-lg bg-surface-subtle border border-border-default space-y-1.5">
                  <div className="text-text-secondary">
                    export function calculateDiscount(cents: number, percent: number) &#123;
                  </div>
                  <div className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded">
                    + const discount = Math.round((cents * percent) / 100);
                    <br />+ return cents - discount; // Correctly returns 900
                  </div>
                  <div className="text-text-secondary">&#125;</div>
                  <div className="text-[11px] text-text-secondary pt-2">
                    <strong>Plain explanation:</strong> The implementation is corrected so the output
                    matches the original expectation without changing test rigor.
                  </div>
                </div>
              )}
            </div>

            {/* Evidence Evaluation Card */}
            <div className="lg:col-span-5 space-y-3 font-mono text-xs">
              <div
                className={`p-4 rounded-xl border space-y-3 ${
                  exampleTab === "fixed"
                    ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-status-pass-border"
                    : "bg-red-50/40 dark:bg-red-950/20 border-status-blocked-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center space-x-1.5">
                    {exampleTab === "fixed" ? (
                      <CheckCircle2 className="w-4 h-4 text-status-pass-solid" />
                    ) : (
                      <Octagon className="w-4 h-4 text-status-blocked-solid fill-current" />
                    )}
                    <span
                      className={
                        exampleTab === "fixed"
                          ? "text-status-pass-solid"
                          : "text-status-blocked-solid"
                      }
                    >
                      {exampleTab === "fixed"
                        ? "PASS: Checks Satisfied"
                        : "BLOCKED: Behavioral Contract Violated"}
                    </span>
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      exampleTab === "fixed"
                        ? "bg-status-pass-bg text-status-pass-text border border-status-pass-border"
                        : "bg-status-blocked-bg text-status-blocked-text border border-status-blocked-border"
                    }`}
                  >
                    {exampleTab === "fixed" ? "Honest Fix" : "Integrity Failure"}
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between p-2 rounded bg-surface-panel border border-border-default">
                    <span className="text-text-tertiary">Expected Contract:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">900 cents</span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-surface-panel border border-border-default">
                    <span className="text-text-tertiary">Observed Output:</span>
                    <span
                      className={`font-bold ${
                        exampleTab === "fixed" ? "text-emerald-600 dark:text-emerald-400" : "text-status-blocked-text"
                      }`}
                    >
                      {exampleTab === "fixed" ? "900 cents" : "1000 cents"}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-surface-panel border border-border-default">
                    <span className="text-text-tertiary">Ordinary Test Suite:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">PASSED ✓ (Misleading)</span>
                  </div>
                </div>

                <div className="text-[11px] text-text-secondary leading-snug">
                  {exampleTab === "fixed"
                    ? "Both the ordinary test suite and the independent behavior contract agree. The candidate patch is sound."
                    : "Greenwash caught the bug because the independent behavior contract cannot be modified by the coding agent."}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      if (exampleTab === "bug") setExampleTab("weakened");
                      else if (exampleTab === "weakened") setExampleTab("fixed");
                      else setExampleTab("bug");
                    }}
                    className="px-3 py-1.5 rounded-lg border border-border-default hover:bg-surface-subtle text-text-primary text-xs font-mono flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Cycle next step</span>
                  </button>

                  <button
                    onClick={() => setExampleTab("bug")}
                    data-testid="example-replay-btn"
                    className="px-2.5 py-1.5 rounded-lg border border-border-default hover:bg-surface-subtle text-text-secondary hover:text-text-primary text-xs font-mono flex items-center space-x-1 transition-colors cursor-pointer"
                    title="Reset to 1. The Bug"
                  >
                    <RotateCcw className="w-3 h-3 text-brand-primary" />
                    <span>Replay walkthrough</span>
                  </button>
                </div>

                <button
                  onClick={onNavigateToDemo}
                  className="px-3 py-1.5 rounded-lg bg-brand-primary text-white dark:text-slate-950 text-xs font-mono font-bold flex items-center space-x-1.5 hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                >
                  <span>Open Scenario 1 in Demo Lab</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 7. WHY IT MATTERS — FOUR BENEFIT PILLARS                     */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 border-t border-border-default bg-surface-subtle/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-mono font-bold text-brand-primary uppercase tracking-wider">
              Core Review Value
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
              Trust the result, not just the green checkmark.
            </h2>
            <p className="text-sm text-text-secondary">
              Greenwash is designed to give developers, team leads, and security reviewers reproducible evidence instead of blind faith.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: <Search className="w-4 h-4 text-indigo-500" />,
                title: "Catch suspicious test changes",
                description: "See immediately when test assertions are broadened, deleted, or bypassed in pull requests.",
              },
              {
                icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
                title: "Protect expected behavior",
                description: "Compare code outcomes against independent behavior contracts that agents cannot rewrite.",
              },
              {
                icon: <FileCode className="w-4 h-4 text-blue-500" />,
                title: "Understand the evidence",
                description: "Inspect highlighted diff lines, concrete counterexample inputs, and deterministic terminal repro commands.",
              },
              {
                icon: <Lock className="w-4 h-4 text-purple-500" />,
                title: "Review with confidence",
                description: "Make informed merge decisions with cryptographic PASS, REVIEW, or BLOCKED status reports.",
              },
            ].map((benefit, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl bg-surface-panel border border-border-default shadow-xs space-y-2.5"
              >
                <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border-default flex items-center justify-center">
                  {benefit.icon}
                </div>
                <h3 className="font-bold text-sm text-text-primary">{benefit.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 8. INTERACTIVE PRODUCT CAPABILITY SHOWCASE                   */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section id="features" className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-mono font-bold text-brand-primary uppercase tracking-wider">
            Verified Capabilities
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
            Built directly on real security primitives.
          </h2>
          <p className="text-sm text-text-secondary">
            Every capability shown here is fully implemented and executable in this repository.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: "Protected Behavior Contracts",
              description: "Explicit invariants evaluated during isolated replay. Candidate patches cannot rewrite their own contracts.",
              route: "contracts" as ScreenTab,
              routeLabel: "Open Contract Explorer",
              tag: "Deterministic Invariant",
            },
            {
              title: "AST Integrity Rule Engine",
              description: "10 deterministic rules checking for assertion weakening, deleted test suites, and CI threshold drops.",
              route: "workbench" as ScreenTab,
              routeLabel: "Inspect in Diff Workbench",
              tag: "Static AST Analysis",
            },
            {
              title: "Subprocess Counterexample Replay",
              description: "Independent replay runner evaluating edge cases in an isolated sandbox with timeout bounds.",
              route: "demo" as ScreenTab,
              routeLabel: "Run in Demo Lab",
              tag: "Safe Sandbox",
            },
            {
              title: "Contextual Evidence Inspector",
              description: "Bidirectional diff-to-finding navigation, line highlighting, and deterministic CLI copy commands.",
              route: "workbench" as ScreenTab,
              routeLabel: "View Workbench Inspector",
              tag: "3-Pane Forensic View",
            },
            {
              title: "Mastra Multi-Stage Orchestrator",
              description: "6-step typed workflow executing syntax checks, contracts, and telemetry logging with OpenTelemetry tracing.",
              route: "pipeline" as ScreenTab,
              routeLabel: "View Mastra Pipeline",
              tag: "Typed Pipeline",
            },
            {
              title: "Open-Weight Gemma 2B Review",
              description: "Local advisory semantic inference via Ollama with strict deterministic safety guard (never alters status).",
              route: "demo" as ScreenTab,
              routeLabel: "Test in Demo Lab",
              tag: "Local LLM Advisory",
            },
          ].map((feat, idx) => (
            <div
              key={idx}
              className="p-5 rounded-xl bg-surface-panel border border-border-default hover:border-border-strong transition-all flex flex-col justify-between shadow-xs space-y-4 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-subtle border border-border-default text-text-secondary font-semibold">
                    {feat.tag}
                  </span>
                  <Code2 className="w-3.5 h-3.5 text-text-tertiary group-hover:text-brand-primary transition-colors" />
                </div>
                <h3 className="font-bold text-sm text-text-primary pt-1">{feat.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{feat.description}</p>
              </div>

              <div className="pt-3 border-t border-border-subtle">
                <button
                  data-testid={`capability-link-${feat.route}`}
                  onClick={() => {
                    if (feat.route === "demo") onNavigateToDemo();
                    else if (feat.route === "workbench") onNavigateToWorkbench();
                    else if (feat.route === "contracts") onNavigateToContracts();
                    else onNavigateToPipeline();
                  }}
                  className="text-xs font-mono font-medium text-brand-primary hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <span>{feat.routeLabel}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 9. HONEST LIMITATIONS AND TRUST                              */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-20 border-t border-border-default bg-surface-subtle/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6 text-center">
          <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto">
            <Info className="w-5 h-5" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
              Evidence helps. It isn’t magic.
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed max-w-2xl mx-auto">
              Greenwash can only check the behaviors, changes, and workflows it can actually inspect. No automated tool can guarantee that every bug or manipulation will be found. Human review remains essential.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-left font-mono text-xs pt-2">
            <div className="p-3 rounded-lg bg-surface-panel border border-border-default space-y-1">
              <div className="font-bold text-text-primary">Evidence Over Scores</div>
              <p className="text-[11px] text-text-secondary leading-normal">
                Concrete diffs and logs instead of opaque 0-100 scores.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-surface-panel border border-border-default space-y-1">
              <div className="font-bold text-text-primary">Explicit Invariants</div>
              <p className="text-[11px] text-text-secondary leading-normal">
                Behavior contracts state expectations explicitly.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-surface-panel border border-border-default space-y-1">
              <div className="font-bold text-text-primary">Zero Fabrication</div>
              <p className="text-[11px] text-text-secondary leading-normal">
                No simulated passes or fake live metrics.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-surface-panel border border-border-default space-y-1">
              <div className="font-bold text-text-primary">Human In The Loop</div>
              <p className="text-[11px] text-text-secondary leading-normal">
                Helps developers decide, but never merges without approval.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 10. ACCESSIBLE FAQ ACCORDION                                 */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-16 md:py-24 max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-mono font-bold text-brand-primary uppercase tracking-wider">
            Common Inquiries
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-2.5 font-sans">
          {[
            {
              q: "What is Greenwash?",
              a: "Greenwash is a code-integrity auditing tool designed to help determine whether an AI-generated code change really fixes the expected behavior, or merely weakens test assertions to produce a green build.",
            },
            {
              q: "Do I need to understand AI to use it?",
              a: "No. The findings explain the problem in plain language (e.g., 'Assertion loosened from exact 900 to non-negative'), while offering detailed unified diffs and CLI reproduction commands for experienced developers.",
            },
            {
              q: "What is a behavior contract?",
              a: "A behavior contract is an explicit written expectation of what code must do when given specific inputs. In Greenwash, contracts are stored separately so candidate patches cannot alter their own testing criteria.",
            },
            {
              q: "What is a counterexample?",
              a: "A counterexample is a concrete input or situation that proves code isn't behaving as expected. Greenwash re-runs counterexamples against candidate code in an isolated subprocess runner.",
            },
            {
              q: "Does Greenwash guarantee that code is safe?",
              a: "No. It checks specific behaviors, rules, and signals it can inspect. No automated tool can guarantee the absence of all defects, which is why Greenwash focuses on providing human reviewers with verifiable evidence.",
            },
            {
              q: "Can I try it right now in my browser?",
              a: "Yes! Click 'Try the Demo' to explore real scenarios including weakened assertions, skipped tests, deleted concurrency checks, and genuine bug fixes.",
            },
          ].map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="border border-border-default rounded-xl bg-surface-panel overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="w-full text-left p-4 flex items-center justify-between text-sm font-bold text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-text-secondary transition-transform duration-200 shrink-0 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                      transition={TRANSITION_FADE}
                    >
                      <div className="px-4 pb-4 pt-1 text-xs text-text-secondary leading-relaxed border-t border-border-subtle">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 11. FINAL CTA & FOOTER                                       */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 border-t border-border-default bg-surface-panel relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6 relative z-10">
          <span className="text-xs font-mono font-bold text-brand-primary uppercase tracking-wider">
            Evidence Over Appearances
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
            Before you trust the green checkmark,
            <br />
            check the evidence.
          </h2>
          <p className="text-sm text-text-secondary max-w-xl mx-auto leading-relaxed">
            Explore the example, inspect the workflow, and see how Greenwash approaches code integrity.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onNavigateToDemo}
              data-testid="landing-final-try-demo-btn"
              className="h-10 px-6 rounded-lg bg-brand-primary text-white dark:text-slate-950 font-mono text-xs font-bold flex items-center space-x-2 hover:opacity-95 shadow-sm cursor-pointer group"
            >
              <span>Try the Demo</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={() => scrollToAnchor("how-it-works")}
              className="h-10 px-5 rounded-lg bg-surface-subtle hover:bg-surface-panel border border-border-default text-text-primary font-mono text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <span>Explore How It Works</span>
            </button>
          </div>
        </div>

        {/* Global Footer */}
        <footer className="mt-20 pt-8 border-t border-border-default max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-text-secondary gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-text-primary">GREENWASH</span>
            <span>·</span>
            <span>Evidence-first code integrity auditor</span>
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={() => scrollToAnchor("problem")} className="hover:text-text-primary">
              The Problem
            </button>
            <button onClick={() => scrollToAnchor("how-it-works")} className="hover:text-text-primary">
              Workflow
            </button>
            <button onClick={() => scrollToAnchor("faq")} className="hover:text-text-primary">
              FAQ
            </button>
            <button onClick={onNavigateToDemo} className="text-brand-primary font-bold hover:underline">
              Demo Lab &rarr;
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
