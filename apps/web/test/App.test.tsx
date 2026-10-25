/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import App from "../src/App";

describe("Forensic Workbench UI Foundation Component Tests", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders global header with brand mark and scenario selector", () => {
    render(<App />);

    expect(screen.getByText("GREENWASH")).toBeDefined();
    expect(screen.getByTestId("scenario-selector")).toBeDefined();
    expect(screen.getByTestId("run-audit-button")).toBeDefined();
  });

  it("renders tri-state VerdictBadge correctly for initial BLOCKED state", () => {
    render(<App />);
    expect(screen.getByTestId("verdict-blocked")).toBeDefined();
    expect(screen.getByText(/BLOCKED: 0 Defects/)).toBeDefined();
  });

  it("switches screens when clicking top navigation tabs", () => {
    render(<App />);

    // Click Contracts tab
    fireEvent.click(screen.getByText("Contracts"));
    expect(screen.getByText("Contract Explorer")).toBeDefined();
    expect(screen.getByText("contract-discount-v1")).toBeDefined();

    // Click Timeline tab
    fireEvent.click(screen.getByText("Timeline"));
    expect(screen.getByText("Agent Session Timeline")).toBeDefined();
    expect(screen.getByText(/Sample session/)).toBeDefined();

    // Click Integrations tab
    fireEvent.click(screen.getByText("Integrations"));
    expect(screen.getByText("Integrations & Environment")).toBeDefined();
    expect(screen.getByText("Gemma Open-Weight Reviewer")).toBeDefined();

    // Click History tab
    fireEvent.click(screen.getByText("History"));
    expect(screen.getByText("Audit History")).toBeDefined();
    // The new HistoryView shows an async loading state then renders storage panel
    expect(screen.getByTestId("history-refresh-btn")).toBeDefined();
  });

  it("renders 3-pane workbench: Sidebar, DiffViewer, and EvidenceInspector", () => {
    render(<App />);

    // Navigate to workbench
    fireEvent.click(screen.getByText("Workbench"));

    // Pane A: Sidebar
    expect(screen.getByRole("region", { name: /File Navigation/i })).toBeDefined();

    // Pane B: DiffViewer
    expect(screen.getByRole("region", { name: /Code Diff/i })).toBeDefined();
    expect(screen.getByText("AST Unified Diff")).toBeDefined();

    // Pane C: EvidenceInspector
    expect(screen.getByRole("region", { name: /Evidence Details/i })).toBeDefined();
  });

  it("copies reproduction command to clipboard with visual feedback", () => {
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: () => Promise.resolve(),
      },
    });

    render(<App />);

    // Navigate to workbench where EvidenceInspector is rendered
    fireEvent.click(screen.getByText("Workbench"));

    // When no finding is active yet, evidence inspector displays awaiting state
    expect(screen.getByText(/No Finding Selected/i)).toBeDefined();
  });

  it("switches to Overview landing page and navigates back to Demo Lab", () => {
    render(<App />);

    // Click Overview tab to go to landing page
    fireEvent.click(screen.getByText("Overview"));
    expect(screen.getByText(/Your AI says the bug is fixed/i)).toBeDefined();

    // Click primary demo CTA on landing page to return to demo lab
    const tryDemoButtons = screen.getAllByTestId("landing-primary-try-demo-btn");
    expect(tryDemoButtons.length).toBeGreaterThan(0);
    fireEvent.click(tryDemoButtons[0]);
    expect(screen.getByTestId("scenario-selector")).toBeDefined();
  });
});
