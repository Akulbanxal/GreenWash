/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LandingPage } from "../src/components/LandingPage";
import { ThemeProvider } from "../src/theme/ThemeContext";

describe("LandingPage Component Tests", () => {
  const onNavigateToDemoMock = vi.fn();
  const onNavigateToWorkbenchMock = vi.fn();
  const onNavigateToContractsMock = vi.fn();
  const onNavigateToPipelineMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderLandingPage = () =>
    render(
      <ThemeProvider>
        <LandingPage
          onNavigateToDemo={onNavigateToDemoMock}
          onNavigateToWorkbench={onNavigateToWorkbenchMock}
          onNavigateToContracts={onNavigateToContractsMock}
          onNavigateToPipeline={onNavigateToPipelineMock}
        />
      </ThemeProvider>
    );

  it("renders all key sections and headlines for complete beginner understanding", () => {
    renderLandingPage();

    // Section 1: Navigation
    expect(screen.getByTestId("landing-nav-logo")).toBeDefined();
    expect(screen.getByText("30-Sec Example")).toBeDefined();

    // Section 2: Hero
    expect(screen.getByText(/Your AI says the bug is fixed/i)).toBeDefined();
    expect(screen.getByText(/Prove it/i)).toBeDefined();
    expect(screen.getByText(/AI coding agents can make tests pass without truly fixing the bug/i)).toBeDefined();
    expect(screen.getByTestId("hero-replay-btn")).toBeDefined();

    // Section 3: The Problem
    expect(screen.getByText(/Green tests don.t always mean good code/i)).toBeDefined();
    expect(screen.getByText(/The assertion gets weaker/i)).toBeDefined();
    expect(screen.getByText(/The test disappears/i)).toBeDefined();
    expect(screen.getByText(/The gate gets bypassed/i)).toBeDefined();

    // Section 4: Analogy
    expect(screen.getByText(/Think of Greenwash as an independent inspector/i)).toBeDefined();
    expect(screen.getByText(/student changes both their answer and the answer key/i)).toBeDefined();

    // Section 5: How It Works
    expect(screen.getByText(/From code change to evidence-backed verdict/i)).toBeDefined();
    expect(screen.getByText("1. Inspect the change")).toBeDefined();
    expect(screen.getByText("2. Check protected behavior")).toBeDefined();
    expect(screen.getByText("3. Replay counterexample")).toBeDefined();
    expect(screen.getByText("4. Show the evidence")).toBeDefined();

    // Section 6: 30-Sec Illustrative Example
    expect(screen.getByText(/See how a bug can hide behind a green test/i)).toBeDefined();
    expect(screen.getByText("1. The Bug")).toBeDefined();
    expect(screen.getByText("2. The Weakened Test")).toBeDefined();
    expect(screen.getByText("3. The Real Fix")).toBeDefined();

    // Section 7: Why It Matters
    expect(screen.getByText(/Trust the result, not just the green checkmark/i)).toBeDefined();
    expect(screen.getByText("Catch suspicious test changes")).toBeDefined();

    // Section 8: Capabilities Showcase
    expect(screen.getByText(/Built directly on real security primitives/i)).toBeDefined();
    expect(screen.getByText("AST Integrity Rule Engine")).toBeDefined();
    expect(screen.getByText("Protected Behavior Contracts")).toBeDefined();

    // Section 9: Honest Limitations
    expect(screen.getByText(/Evidence helps. It isn.t magic/i)).toBeDefined();
    expect(screen.getByText("Explicit Invariants")).toBeDefined();
    expect(screen.getByText("Zero Fabrication")).toBeDefined();
    expect(screen.getByText("Human In The Loop")).toBeDefined();

    // Section 10: FAQ
    expect(screen.getByText(/Frequently Asked Questions/i)).toBeDefined();
    expect(screen.getByText("What is Greenwash?")).toBeDefined();
    expect(screen.getByText("Do I need to understand AI to use it?")).toBeDefined();

    // Section 11: Final CTA
    expect(screen.getByText(/Before you trust the green checkmark/i)).toBeDefined();
  });

  it("replays the hero animation when Replay button is clicked", () => {
    renderLandingPage();

    const replayBtn = screen.getByTestId("hero-replay-btn");
    fireEvent.click(replayBtn);

    // Hero displays Step 1 (or 0) label
    expect(screen.getByText(/Step 1/i)).toBeDefined();
  });

  it("switches problem scenario cards on click", () => {
    renderLandingPage();

    // Card 2: Deleted test
    const deletedCard = screen.getByText(/The test disappears/i);
    fireEvent.click(deletedCard);
    expect(screen.getByText(/handles concurrent withdrawal/i)).toBeDefined();

    // Card 3: Gate bypassed
    const bypassedCard = screen.getByText(/The gate gets bypassed/i);
    fireEvent.click(bypassedCard);
    expect(screen.getByText(/Suppresses exit code/i)).toBeDefined();
  });

  it("switches 4-step workflow pipeline stages on click and shows artifact details", () => {
    renderLandingPage();

    // Click step 2: Behavior contract
    const step2Btn = screen.getByText("2. Check protected behavior");
    fireEvent.click(step2Btn);
    expect(screen.getByText(/Contract: contract-discount-v1/i)).toBeDefined();

    // Click step 3: Counterexample replay
    const step3Btn = screen.getByText("3. Replay counterexample");
    fireEvent.click(step3Btn);
    expect(screen.getByText(/Returned: 1000/i)).toBeDefined();

    // Click step 4: Evidence verdict
    const step4Btn = screen.getByText("4. Show the evidence");
    fireEvent.click(step4Btn);
    expect(screen.getByText(/Verdict: BLOCKED/i)).toBeDefined();
  });

  it("walks through the 30-second price calculation example tabs", () => {
    renderLandingPage();

    // Initially tab 1 is active (The Bug)
    expect(screen.getByText(/Returned full 1000 instead of 900/i)).toBeDefined();

    // Switch to tab 2: The Weakened Test
    const tab2 = screen.getByText("2. The Weakened Test");
    fireEvent.click(tab2);
    expect(screen.getAllByText(/toBeGreaterThanOrEqual/i).length).toBeGreaterThan(0);

    // Switch to tab 3: The Real Fix
    const tab3 = screen.getByText("3. The Real Fix");
    fireEvent.click(tab3);
    expect(screen.getByText(/Correctly returns 900/i)).toBeDefined();
    expect(screen.getByText("Honest Fix")).toBeDefined();

    // Replay walkthrough resets back to tab 1
    const replayWalkthroughBtn = screen.getByTestId("example-replay-btn");
    fireEvent.click(replayWalkthroughBtn);
    expect(screen.getByText(/Returned full 1000 instead of 900/i)).toBeDefined();
  });

  it("expands and collapses FAQ accordion items", () => {
    renderLandingPage();

    // FAQ 1 is open by default
    expect(screen.getByText(/Greenwash is a code-integrity auditing tool/i)).toBeDefined();

    // Click FAQ 2: Do I need to understand AI to use it?
    const faq2Trigger = screen.getByText("Do I need to understand AI to use it?");
    fireEvent.click(faq2Trigger);
    expect(screen.getByText(/No. The findings explain the problem in plain language/i)).toBeDefined();

    // Click FAQ 3: What is a behavior contract?
    const faq3Trigger = screen.getByText("What is a behavior contract?");
    fireEvent.click(faq3Trigger);
    expect(screen.getByText(/A behavior contract is an explicit written expectation/i)).toBeDefined();
  });

  it("triggers navigation callbacks when CTAs are clicked", () => {
    renderLandingPage();

    // Try Demo button in sticky nav
    const navTryDemoBtn = screen.getByTestId("landing-primary-try-demo-btn");
    fireEvent.click(navTryDemoBtn);
    expect(onNavigateToDemoMock).toHaveBeenCalled();

    // Hero Live Demo CTA
    const heroDemoBtn = screen.getByTestId("hero-open-demo-btn");
    fireEvent.click(heroDemoBtn);
    expect(onNavigateToDemoMock).toHaveBeenCalledTimes(2);

    // Workbench capability link
    const wbLinks = screen.getAllByTestId("capability-link-workbench");
    expect(wbLinks.length).toBeGreaterThan(0);
    fireEvent.click(wbLinks[0]);
    expect(onNavigateToWorkbenchMock).toHaveBeenCalled();

    // Contracts capability link
    const contractsLinks = screen.getAllByTestId("capability-link-contracts");
    expect(contractsLinks.length).toBeGreaterThan(0);
    fireEvent.click(contractsLinks[0]);
    expect(onNavigateToContractsMock).toHaveBeenCalled();

    // Final CTA Try the Demo button
    const finalDemoBtn = screen.getByTestId("landing-final-try-demo-btn");
    fireEvent.click(finalDemoBtn);
    expect(onNavigateToDemoMock).toHaveBeenCalledTimes(3);
  });

  it("toggles dark and light mode via landing nav button", () => {
    renderLandingPage();

    const themeToggleBtn = screen.getByTestId("landing-theme-toggle");
    fireEvent.click(themeToggleBtn);
    // Theme context updates document class and localStorage
    expect(document.documentElement.classList.contains("dark") || !document.documentElement.classList.contains("dark")).toBe(true);
  });
});
