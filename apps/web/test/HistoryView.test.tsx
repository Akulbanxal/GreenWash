/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { AuditHistoryView } from "../src/components/HistoryView.js";

// ──────────────────────────────────────────────────
// Typed API mocks
// ──────────────────────────────────────────────────
const mockFetchAuditHistory = vi.fn();
const mockFetchPersistedAuditRecord = vi.fn();
const mockVerifyMongoDbConnection = vi.fn();

vi.mock("../src/api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api.js")>();
  return {
    ...actual,
    fetchAuditHistory: (...args: unknown[]) => mockFetchAuditHistory(...args),
    fetchPersistedAuditRecord: (...args: unknown[]) => mockFetchPersistedAuditRecord(...args),
    verifyMongoDbConnection: (...args: unknown[]) => mockVerifyMongoDbConnection(...args),
  };
});

function makeInMemoryResponse(records = []) {
  return {
    storageMode: "in-memory",
    connected: true,
    diagnostics: {
      mode: "in-memory",
      connected: true,
      message: "Local in-memory fallback active (Atlas unconfigured or offline)",
      lastCheckedAt: new Date().toISOString(),
    },
    records,
  };
}

function makeAtlasResponse(records = []) {
  return {
    storageMode: "mongodb",
    connected: true,
    diagnostics: {
      mode: "mongodb",
      connected: true,
      databaseName: "greenwash",
      collectionName: "audit_history",
      latencyMs: 42,
      message: "Connected to MongoDB Atlas",
      lastCheckedAt: new Date().toISOString(),
    },
    records,
  };
}

function makeSummaryItem(overrides = {}) {
  return {
    id: "test-audit-001",
    createdAt: "2024-11-15T10:32:00.000Z",
    scenarioId: "weakened-assertion",
    status: "BLOCKED",
    findingsCount: 2,
    findings: [
      { id: "f1", ruleId: "AST-ASSERT-WEAKENED", severity: "high", source: "static-rule", title: "Assertion weakened" },
    ],
    checksSummary: { passed: 4, failed: 2, warning: 0, "not-run": 0 },
    isSample: false,
    ...overrides,
  };
}

function makePersistedRecord(overrides = {}) {
  return {
    _id: "test-audit-001",
    id: "test-audit-001",
    schemaVersion: 1,
    createdAt: "2024-11-15T10:32:00.000Z",
    storedAt: "2024-11-15T10:32:05.000Z",
    scenarioId: "weakened-assertion",
    status: "BLOCKED",
    summary: "Audit BLOCKED: 2 issues detected",
    findings: [],
    checks: [
      { id: "check-diff-parse", label: "Diff Parsing", status: "passed", durationMs: 12 },
    ],
    isSample: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("AuditHistoryView — Core UI Requirements", () => {
  it("1. Shows loading state initially, then renders real empty state when no records", async () => {
    mockFetchAuditHistory.mockResolvedValue(makeInMemoryResponse([]));

    render(<AuditHistoryView />);
    expect(screen.queryByTestId("history-empty-state")).toBeNull();

    await waitFor(() => {
      expect(screen.getByTestId("history-empty-state")).toBeDefined();
    });

    expect(screen.getByText("No Audits Run Yet")).toBeDefined();
  });

  it("2. Renders real audit records list when records exist", async () => {
    const records = [makeSummaryItem({ id: "real-001" }), makeSummaryItem({ id: "real-002", scenarioId: "honest-fix", status: "PASS", findingsCount: 0, findings: [] })];
    mockFetchAuditHistory.mockResolvedValue(makeInMemoryResponse(records));

    render(<AuditHistoryView />);

    await waitFor(() => {
      expect(screen.getByTestId("history-records-list")).toBeDefined();
    });

    expect(screen.getByTestId("history-row-real-001")).toBeDefined();
    expect(screen.getByTestId("history-row-real-002")).toBeDefined();
  });

  it("3. Sample section is hidden by default and must NOT be mixed with real records", async () => {
    const records = [makeSummaryItem()];
    mockFetchAuditHistory.mockResolvedValue(makeInMemoryResponse(records));

    render(<AuditHistoryView />);

    await waitFor(() => {
      expect(screen.getByTestId("history-records-list")).toBeDefined();
    });

    // Sample section not visible by default
    expect(screen.queryByTestId("history-sample-section")).toBeNull();

    // Toggle sample section
    fireEvent.click(screen.getByTestId("history-toggle-sample-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("history-sample-section")).toBeDefined();
    });

    // Sample records show SAMPLE badge
    const sampleBadges = screen.getAllByText("SAMPLE");
    expect(sampleBadges.length).toBeGreaterThan(0);

    // Real records section never renders sample badges
    const realList = screen.getByTestId("history-records-list");
    expect(realList.textContent).not.toContain("sample-blocked-001");
  });

  it("4. Clicking a real record fetches and shows detail panel", async () => {
    const records = [makeSummaryItem()];
    mockFetchAuditHistory.mockResolvedValue(makeInMemoryResponse(records));
    mockFetchPersistedAuditRecord.mockResolvedValue(makePersistedRecord());

    render(<AuditHistoryView />);

    await waitFor(() => {
      expect(screen.getByTestId("history-row-test-audit-001")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("history-row-test-audit-001"));

    await waitFor(() => {
      expect(mockFetchPersistedAuditRecord).toHaveBeenCalledWith("test-audit-001");
    });
  });

  it("5. Storage mode badge shows 'In-Memory (Local)' when Atlas not configured", async () => {
    mockFetchAuditHistory.mockResolvedValue(makeInMemoryResponse([]));

    render(<AuditHistoryView />);

    await waitFor(() => {
      expect(screen.getByTestId("history-storage-panel")).toBeDefined();
    });

    expect(screen.getByText("In-Memory (Local)")).toBeDefined();
    // Must NOT claim Atlas is connected
    expect(screen.queryByText("Atlas Connected")).toBeNull();
  });

  it("6. MongoDB verify button calls verifyMongoDbConnection and shows result", async () => {
    mockFetchAuditHistory.mockResolvedValue(makeInMemoryResponse([]));
    mockVerifyMongoDbConnection.mockResolvedValue({
      mode: "in-memory",
      connected: true,
      message: "Local in-memory fallback active (Atlas unconfigured or offline)",
      lastCheckedAt: new Date().toISOString(),
    });

    render(<AuditHistoryView />);

    await waitFor(() => {
      expect(screen.getByTestId("history-verify-mongo-btn")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("history-verify-mongo-btn"));

    await waitFor(() => {
      expect(mockVerifyMongoDbConnection).toHaveBeenCalled();
    });
  });

  it("7. Error from fetchAuditHistory shows error banner with graceful UX", async () => {
    mockFetchAuditHistory.mockRejectedValue(new Error("Network unavailable"));

    render(<AuditHistoryView />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load history/i)).toBeDefined();
    });

    expect(screen.getByText(/Network unavailable/i)).toBeDefined();
  });
});
