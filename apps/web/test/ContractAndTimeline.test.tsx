/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import App from "../src/App";

const MOCK_CONTRACT = {
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

const MOCK_SESSION_RESULT = {
  isLive: false,
  sourceLabel: "Sample session — not a live connection",
  sessionId: "sample-session-billing-evasion",
  warning: "Displaying checked-in sanitized sample session. No active Entire CLI connection detected.",
  setupGuide: {
    title: "Connect Entire CLI Provenance",
    steps: [
      "1. Install Entire CLI: npm install -g entireio/cli (or go install github.com/entireio/cli@latest)",
      "2. Initialize Entire in your repository: entire enable",
      "3. Run your coding agent with checkpoint tracking: entire run --agent <agent-name>",
      "4. Set environment variable ENTIRE_SESSION_PATH in Greenwash API server",
    ],
    documentationUrl: "https://entire.io/docs",
  },
  events: [
    {
      id: "ev-1-sample",
      timestamp: "2026-10-22T14:02:11Z",
      type: "prompt",
      source: "Entire CLI (Claude Code)",
      summary: "PROMPT: Fix intermittent discount calculation error on enterprise tiers with [REDACTED_SECRET]",
      isFlagged: false,
    },
    {
      id: "ev-2-sample",
      timestamp: "2026-10-22T14:02:18Z",
      type: "test_run",
      source: "vitest runner",
      summary: "Test suite execution: FAILED ($ vitest run tests/discount.test.ts)",
      targetFile: "tests/discount.test.ts",
      command: "vitest run tests/discount.test.ts",
      testOutcome: "failed",
      isFlagged: false,
    },
    {
      id: "ev-3-sample",
      timestamp: "2026-10-22T14:02:35Z",
      type: "file_edit",
      source: "agent editor",
      summary: "Edited tests/discount.test.ts (lines: 8)",
      targetFile: "tests/discount.test.ts",
      linesChanged: [8],
      diffSnippet: "-    expect(discounted).toBe(900);\n+    expect(discounted).toBeGreaterThanOrEqual(0);",
      isFlagged: true,
      flagReason: "Suspicious Pattern: Test failed, followed by an edit to test file rather than source code, followed by green pass. Warrants review.",
    },
    {
      id: "ev-4-sample",
      timestamp: "2026-10-22T14:02:42Z",
      type: "test_run",
      source: "vitest runner",
      summary: "Test suite execution: PASSED ($ vitest run tests/discount.test.ts)",
      targetFile: "tests/discount.test.ts",
      command: "vitest run tests/discount.test.ts",
      testOutcome: "passed",
      isFlagged: true,
      flagReason: "Suspicious Pattern: Suite turned green immediately after test code modification.",
    },
    {
      id: "ev-5-sample",
      timestamp: "2026-10-22T14:02:50Z",
      type: "commit",
      source: "git commit",
      summary: "Committed change (c84f91a) with Entire-Checkpoint trailer",
      commitHash: "c84f91a27e3d81b2a4e981273901bca234567890",
      targetFile: "tests/discount.test.ts",
      isFlagged: false,
    },
  ],
};

describe("Contract Explorer & Agent Session Timeline Integration Tests", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((input: any, options?: any) => {
      const urlStr = typeof input === "string" ? input : input.url || "";
      if (urlStr.includes("/api/contracts/review-update")) {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (body.reviewerToken !== "SEC-COUNCIL-APPROVED-OVERRIDE") {
          return Promise.resolve({
            ok: false,
            status: 403,
            statusText: "Forbidden",
            json: () =>
              Promise.resolve({
                error: "Forbidden: Updating contract baseline requires explicit Security Review Council authorization token.",
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              contractId: "contract-discount-v1",
              version: "1.0.0",
              reviewedBy: "Security Review Council",
              reviewNotes: body.reviewNotes || "Authorized baseline update",
              timestamp: new Date().toISOString(),
            }),
        });
      }
      if (urlStr.includes("/api/contracts")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([MOCK_CONTRACT]),
        });
      }
      if (urlStr.includes("/api/session")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_SESSION_RESULT),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
        text: () => Promise.resolve(""),
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders Contract Explorer with contract versions, cases, and baseline immutability notice", async () => {
    render(<App />);

    // Navigate to Contracts screen
    fireEvent.click(screen.getByText("Contracts"));

    expect(screen.getByText("Contract Explorer")).toBeDefined();
    expect(screen.getByText("Baseline Immutability Enforced")).toBeDefined();
    expect(screen.getByText("contract-discount-v1")).toBeDefined();
    expect(screen.getByText(/v1.0.0 \(Approved\)/)).toBeDefined();

    // Verify invariant case is displayed
    expect(screen.getByText("case-1000-cents-10-pct")).toBeDefined();
    expect(screen.getAllByText(/900 cents/).length).toBeGreaterThan(0);
  });

  it("flags attempted contract changes when evaluating evasion scenarios", async () => {
    render(<App />);

    // By default, selected scenario is weakened-assertion
    fireEvent.click(screen.getByText("Contracts"));

    // Check that attempted tamper is visibly flagged
    expect(screen.getByTestId("contract-tamper-flag")).toBeDefined();
    expect(screen.getByText("Tamper Attempt Blocked")).toBeDefined();
    expect(screen.getByText(/VIOLATED \(Returned 1000\)/)).toBeDefined();
  });

  it("requires explicit review authorization token to update contract baseline", async () => {
    render(<App />);

    fireEvent.click(screen.getByText("Contracts"));

    // Open review modal
    const openModalBtn = screen.getByTestId("request-baseline-update-btn");
    fireEvent.click(openModalBtn);

    expect(screen.getByText("Explicit Baseline Review & Update")).toBeDefined();
    expect(screen.getByTestId("reviewer-token-input")).toBeDefined();

    // Attempt update with unauthorized token
    fireEvent.change(screen.getByTestId("reviewer-token-input"), {
      target: { value: "unauthorized-token-123" },
    });
    fireEvent.submit(screen.getByTestId("reviewer-token-input").closest("form")!);

    await waitFor(() => {
      expect(
        screen.getByText(/Forbidden: Updating contract baseline requires explicit Security Review Council/)
      ).toBeDefined();
    });

    // Provide authorized Security Council override token
    fireEvent.change(screen.getByTestId("reviewer-token-input"), {
      target: { value: "SEC-COUNCIL-APPROVED-OVERRIDE" },
    });
    fireEvent.change(screen.getByTestId("review-notes-input"), {
      target: { value: "Approved invariant evolution for 2026 holiday promotions" },
    });
    fireEvent.submit(screen.getByTestId("reviewer-token-input").closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/Baseline updated successfully/)).toBeDefined();
    });
  });

  it("renders Agent Session Timeline with honest 'Sample session' label and setup guide", async () => {
    render(<App />);

    // Navigate to Timeline screen
    fireEvent.click(screen.getByText("Timeline"));

    expect(screen.getByText("Agent Session Timeline")).toBeDefined();
    // Honest sample badge - Never claim live when CLI not running
    const badge = screen.getByTestId("session-source-badge");
    expect(badge.textContent).toBe("Sample session — not a live connection");

    // Check setup guide toggle
    const setupGuideBtn = screen.getByTestId("setup-guide-btn");
    fireEvent.click(setupGuideBtn);
    expect(screen.getByTestId("setup-guide-panel")).toBeDefined();
    expect(screen.getByText("Connect Entire CLI Provenance")).toBeDefined();
    expect(screen.getByText(/Install Entire CLI: npm install -g entireio\/cli/)).toBeDefined();
  });

  it("highlights suspicious sequences (test failure -> test edit -> green pass) as review patterns", async () => {
    render(<App />);

    fireEvent.click(screen.getByText("Timeline"));

    // Filter by suspicious patterns
    const checkbox = screen.getByTestId("filter-flagged-checkbox");
    fireEvent.click(checkbox);

    // Verify suspicious sequence events are displayed
    const flaggedItems = screen.getAllByText(/Suspicious pattern detected/);
    expect(flaggedItems.length).toBeGreaterThan(0);

    // Select the flagged file edit event to view details & capture diff
    const flaggedEventRow = screen.getByTestId("session-event-row-ev-3-sample");
    fireEvent.click(flaggedEventRow);

    // Details panel shows pattern review disclaimer (not proof of intent)
    expect(screen.getByText("Review Warranted (Behavior Pattern)")).toBeDefined();
    expect(
      screen.getByText(/Patterns describe sequences that warrant human review; they are not proof of malicious intent\./)
    ).toBeDefined();

    // Check associated diff snippet preview
    expect(screen.getByText(/Associated Diff Snippet/)).toBeDefined();
    expect(screen.getAllByText(/expect\(discounted\)/).length).toBeGreaterThan(0);
  });
});
