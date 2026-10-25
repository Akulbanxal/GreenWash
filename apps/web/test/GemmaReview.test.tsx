/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ContextualEvidenceInspector } from "../src/components/ContextualEvidenceInspector";
import { IntegrationsView } from "../src/components/IntegrationsView";
import * as api from "../src/api";
import { AuditFinding, AuditReport } from "@greenwash/core/dist/browser.js";

describe("Gemma Semantic Review UI & Untrusted Guardrails", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  const mockFinding: AuditFinding = {
    id: "finding-assert-1",
    ruleId: "AST-ASSERT-WEAKENED",
    title: "Exact assertion loosened",
    summary: "Replaced toBe(900) with toBeGreaterThanOrEqual(0)",
    severity: "critical",
    source: "deterministic",
    actionRequired: "BLOCKED",
    humanAction: "Reject patch; restore exact assertion.",
    expected: "toBe(900)",
    actual: "toBeGreaterThanOrEqual(0)",
    evidence: [
      {
        ruleId: "AST-ASSERT-WEAKENED",
        filePath: "tests/discount.test.ts",
        startLine: 7,
        endLine: 7,
        title: "Relational assertion used",
        detail: "Loosened to >= 0",
        diffHunk: "- expect(d).toBe(900);\n+ expect(d).toBeGreaterThanOrEqual(0);",
      },
    ],
  };

  const mockReport: AuditReport = {
    id: "rep_123",
    scenarioId: "weakened-assertion",
    status: "BLOCKED",
    createdAt: new Date().toISOString(),
    summary: "Diff audit detected 1 critical issue",
    limitations: [],
    checks: [],
    findings: [mockFinding],
  };

  it("renders Gemma Model-Assisted Analysis panel with explicit untrusted advisory notice", () => {
    render(<ContextualEvidenceInspector finding={mockFinding} report={mockReport} />);

    expect(screen.getByText(/\[Gemma\] Model-Assisted Analysis/i)).toBeTruthy();
    expect(screen.getByText(/Advisory Only/i)).toBeTruthy();
    expect(
      screen.getByText(/Model output is untrusted and cannot alter deterministic findings or status/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/Candidate tests require human review and are never executed automatically/i)
    ).toBeTruthy();
    expect(screen.getByTestId("request-gemma-review-btn")).toBeTruthy();
  });

  it("executes review request and displays genuine telemetry and candidate edge cases", async () => {
    const mockApiResponse = {
      success: true,
      modelName: "gemma:2b",
      runtime: "Ollama / Local (42ms)",
      latencyMs: 42,
      response: {
        explanation: "Assertion changed from strict value to range inequality.",
        weakeningAnalysis: "Permits any value >= 0, masking discount bugs where calculation returns 0.",
        riskLevel: "high",
        suggestedEdgeCases: [
          {
            description: "Zero discount check",
            suggestedCheck: "expect(calculateDiscount(1000, 0)).toBe(1000);",
          },
        ],
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    } as unknown as Response);

    render(<ContextualEvidenceInspector finding={mockFinding} report={mockReport} />);

    const requestBtn = screen.getByTestId("request-gemma-review-btn");
    fireEvent.click(requestBtn);

    await waitFor(() => {
      expect(screen.getByText(/Permits any value >= 0/i)).toBeTruthy();
    });

    // Check telemetry is honest and rendered
    expect(screen.getByText(/gemma:2b/i)).toBeTruthy();
    expect(screen.getAllByText(/42ms/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Risk: high/i)).toBeTruthy();

    // Check edge case is clearly flagged as requiring human review
    expect(screen.getByText(/Zero discount check/i)).toBeTruthy();
    expect(screen.getByText(/Review Required/i)).toBeTruthy();
    expect(screen.getByText(/expect\(calculateDiscount\(1000, 0\)\)\.toBe\(1000\);/i)).toBeTruthy();
  });

  it("handles unconfigured/offline Gemma endpoint gracefully with error message", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: "Gemma endpoint not configured. Set GEMMA_ENDPOINT in environment.",
      }),
    } as unknown as Response);

    render(<ContextualEvidenceInspector finding={mockFinding} report={mockReport} />);

    const requestBtn = screen.getByTestId("request-gemma-review-btn");
    fireEvent.click(requestBtn);

    await waitFor(() => {
      expect(screen.getByText(/Gemma Unavailable/i)).toBeTruthy();
      expect(screen.getByText(/Gemma endpoint not configured/i)).toBeTruthy();
    });

    expect(screen.getByText(/Retry Call/i)).toBeTruthy();
  });

  describe("IntegrationsView live connection test", () => {
    it("displays honest not-configured status by default", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (typeof url === "string" && url.includes("/api/gemma/check")) {
          return {
            ok: true,
            json: async () => ({
              configured: false,
              connected: false,
              error: "Endpoint not configured",
            }),
          };
        }
        return { ok: true, json: async () => ({}) };
      });

      render(<IntegrationsView />);

      await waitFor(() => {
        const badge = screen.getByTestId("gemma-status-badge");
        expect(badge.textContent).toBe("not-configured");
      });
    });

    it("triggers live test on button click and updates status when connected", async () => {
      let userClicked = false;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (typeof url === "string" && url.includes("/api/gemma/check")) {
          if (!userClicked) {
            return {
              ok: true,
              json: async () => ({
                configured: false,
                connected: false,
              }),
            };
          }
          return {
            ok: true,
            json: async () => ({
              configured: true,
              connected: true,
              model: "gemma:7b",
              endpoint: "http://localhost:11434",
              latencyMs: 38,
            }),
          };
        }
        return { ok: true, json: async () => ({}) };
      });

      render(<IntegrationsView />);

      // Wait for the initial mount check to fully settle
      await waitFor(() => {
        expect(screen.getByTestId("gemma-status-badge").textContent).toBe("not-configured");
        expect(screen.getByText(/Configured:/i)).toBeTruthy();
      });

      userClicked = true;
      const testBtn = screen.getByTestId("test-gemma-btn");
      fireEvent.click(testBtn);

      await waitFor(() => {
        expect(screen.getByTestId("gemma-status-badge").textContent).toBe("connected");
        expect(screen.getAllByText(/gemma:7b/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/38ms/i)).toBeTruthy();
      });
    });
  });
});
