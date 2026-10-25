/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import App from "../src/App";

describe("Red-Team Demo Lab Interactive Suite", () => {
  beforeEach(() => {
    // Mock global fetch for API
    global.fetch = vi.fn().mockImplementation((input: any, options?: any) => {
      const urlStr = typeof input === "string" ? input : input.url || "";
      if (urlStr.includes("scenarios")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: "weakened-assertion",
                title: "Weakened Assertion",
                description: "Loosened equality to inequality",
                threatCategory: "test-integrity",
                expectedOutcome: "BLOCKED",
                expectedRuleIds: ["AST-ASSERT-WEAKENED"],
                fixturePath: "fixtures/scenarios/weakened-assertion/test.patched.ts",
                diffPath: "fixtures/scenarios/weakened-assertion/patch.diff",
              },
              {
                id: "honest-fix",
                title: "Honest Bug Fix",
                description: "Preserved assertion and fixed math",
                threatCategory: "honest-fix",
                expectedOutcome: "PASS",
                expectedRuleIds: [],
                fixturePath: "fixtures/scenarios/honest-fix/test.patched.ts",
                diffPath: "fixtures/scenarios/honest-fix/patch.diff",
              },
            ]),
        });
      }

      if (urlStr.includes("audits/demo")) {
        const body = JSON.parse(options?.body || "{}");
        if (body.scenarioId === "weakened-assertion") {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: "audit-weakened-assertion-12345",
                createdAt: new Date().toISOString(),
                scenarioId: "weakened-assertion",
                status: "BLOCKED",
                summary: "Audit BLOCKED: 2 issue(s) detected.",
                limitations: ["Diff scanning identifies modified test syntax."],
                findings: [
                  {
                    id: "fnd-1",
                    ruleId: "AST-ASSERT-WEAKENED",
                    title: "Weakened Test Assertion",
                    summary: "toBe(900) replaced by toBeGreaterThanOrEqual(0)",
                    severity: "critical",
                    source: "static-rule",
                    evidence: [{ filePath: "tests/discount.test.ts", startLine: 8 }],
                    expected: 900,
                    actual: 1000,
                    reproductionCommand: "npx vitest run tests/discount.test.ts",
                    humanAction: "Restore strict assertion",
                    limitations: [],
                  },
                ],
                checks: [
                  { id: "c1", label: "AST Integrity", status: "failed", detail: "Weakened assertion" },
                  { id: "c2", label: "Contract Replay", status: "failed", detail: "Returned 1000" },
                ],
              }),
          });
        }

        if (body.scenarioId === "honest-fix") {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: "audit-honest-fix-12345",
                createdAt: new Date().toISOString(),
                scenarioId: "honest-fix",
                status: "PASS",
                summary: "Audit PASS: All configured checks completed with zero blocking findings.",
                limitations: ["PASS means configured checks did not detect an issue."],
                findings: [],
                checks: [
                  { id: "c1", label: "AST Integrity", status: "passed", detail: "All assertions preserved" },
                  { id: "c2", label: "Contract Replay", status: "passed", detail: "Returned 900" },
                ],
              }),
          });
        }
      }

      return Promise.reject(new Error("Unknown route: " + urlStr));
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders Red-Team Demo Lab as default route", () => {
    render(<App />);
    expect(screen.getByRole("region", { name: "Red-Team Demo Lab" })).toBeDefined();
    expect(screen.getByText("Can you trust this green build?")).toBeDefined();
  });

  it("switches scenarios and clears stale results", async () => {
    render(<App />);

    const honestCard = await screen.findByTestId("scenario-card-honest-fix");
    fireEvent.click(honestCard);

    // Active scenario in selector should be honest-fix
    const selector = screen.getByTestId("scenario-selector") as HTMLSelectElement;
    expect(selector.value).toBe("honest-fix");
  });

  it("runs audit for weakened-assertion and displays BLOCKED verdict card with real checks", async () => {
    render(<App />);

    const runBtn = screen.getByTestId("lab-run-audit-btn");
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByTestId("lab-result-card")).toBeDefined();
    });

    expect(screen.getByText(/Audit Verdict: BLOCKED/)).toBeDefined();
    expect(screen.getByText("Inspect in Workbench")).toBeDefined();
    expect(screen.getAllByText("[failed]").length).toBeGreaterThanOrEqual(1);
  });

  it("navigates into Workbench when clicking 'Inspect in Workbench'", async () => {
    render(<App />);

    const runBtn = screen.getByTestId("lab-run-audit-btn");
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByTestId("lab-inspect-workbench-btn")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("lab-inspect-workbench-btn"));

    // Should switch active screen to Workbench
    expect(screen.getByRole("region", { name: /File Navigation/i })).toBeDefined();
    expect(screen.getByRole("region", { name: /Code Diff/i })).toBeDefined();
    expect(screen.getByRole("region", { name: /Evidence Details/i })).toBeDefined();
  });

  it("runs honest-fix and displays PASS verdict card", async () => {
    render(<App />);

    const honestCard = await screen.findByTestId("scenario-card-honest-fix");
    fireEvent.click(honestCard);

    const runBtn = screen.getByTestId("lab-run-audit-btn");
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByTestId("lab-result-card")).toBeDefined();
    });

    expect(screen.getByText(/Audit Verdict: PASS/)).toBeDefined();
    expect(screen.getAllByText("[passed]").length).toBeGreaterThan(0);
  });

  it("triggers audit via keyboard shortcut 'R'", async () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "r", code: "KeyR" });

    await waitFor(() => {
      expect(screen.getByTestId("lab-result-card")).toBeDefined();
    });
  });

  it("handles API failure gracefully with retry option", async () => {
    (global.fetch as any).mockImplementation((input: any) => {
      const urlStr = String(input);
      if (urlStr.includes("scenarios")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: false,
        statusText: "Internal Server Error",
        json: () => Promise.resolve({ error: "Subprocess runner failed to connect" }),
      });
    });

    render(<App />);
    const runBtn = screen.getByTestId("lab-run-audit-btn");
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText("Audit Execution Error")).toBeDefined();
      expect(screen.getByText("Subprocess runner failed to connect")).toBeDefined();
    });

    expect(screen.getByText("Retry")).toBeDefined();
  });
});
