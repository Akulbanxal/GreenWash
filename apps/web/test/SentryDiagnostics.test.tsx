/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { IntegrationsView } from "../src/components/IntegrationsView";
import * as api from "../src/api";

describe("IntegrationsView — Sentry Agent Tracing Diagnostics", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "checkGemmaConnection").mockResolvedValue({
      configured: false,
      connected: false,
    });
  });

  it("1. User with no DSN sees 'Not configured' and local audit is uninhibited", async () => {
    vi.spyOn(api, "fetchSentryDiagnostics").mockResolvedValue({
      status: "NOT_CONFIGURED",
      dsnConfigured: false,
      environment: "development",
      sampleRate: 1.0,
      redactionActive: true,
    });

    render(<IntegrationsView />);

    await waitFor(() => {
      const badge = screen.getByTestId("sentry-status-badge");
      expect(badge).toHaveTextContent("Not configured");
    });

    // Verification card should indicate local audit only
    expect(screen.getByTestId("sentry-diagnostics-state-badge")).toHaveTextContent("Not configured");
  });

  it("2. Live view does NOT fabricate example traces when none recorded", async () => {
    vi.spyOn(api, "fetchSentryDiagnostics").mockResolvedValue({
      status: "CONFIGURED",
      dsnConfigured: true,
      dsnHost: "o0.ingest.sentry.io",
      projectId: "12345",
      environment: "development",
      sampleRate: 1.0,
      redactionActive: true,
      lastTraceReference: undefined, // No audit run yet
    });

    render(<IntegrationsView />);

    await waitFor(() => {
      expect(screen.getByTestId("sentry-no-live-trace-msg")).toBeInTheDocument();
    });

    expect(screen.getByTestId("sentry-no-live-trace-msg")).toHaveTextContent(
      "No live trace recorded yet. Run an audit in Red-Team Lab or Mastra Pipeline to generate an actual workflow trace."
    );
    expect(screen.queryByTestId("sentry-live-trace-id")).not.toBeInTheDocument();
  });

  it("3. Sample trace section is explicitly labeled 'Sample Trace (Non-production demo)'", async () => {
    vi.spyOn(api, "fetchSentryDiagnostics").mockResolvedValue({
      status: "NOT_CONFIGURED",
      dsnConfigured: false,
      environment: "development",
      sampleRate: 1.0,
      redactionActive: true,
    });

    render(<IntegrationsView />);

    await waitFor(() => {
      expect(screen.getByText("Sample Trace (Non-production demo)")).toBeInTheDocument();
    });

    expect(screen.getByText("Sample Reference Only")).toBeInTheDocument();
  });

  it("4. Displays actual live trace reference returned by real workflow execution", async () => {
    vi.spyOn(api, "fetchSentryDiagnostics").mockResolvedValue({
      status: "CONFIGURED",
      dsnConfigured: true,
      dsnHost: "o0.ingest.sentry.io",
      projectId: "12345",
      environment: "development",
      sampleRate: 1.0,
      redactionActive: true,
      lastTraceReference: {
        traceId: "7bf53c7cd5c5478a9d562f9012120a5d",
        spanId: "b98f0801a8cd0183",
        sentryUrl: "https://o0.ingest.sentry.io/trace/7bf53c7cd5c5478a9d562f9012120a5d",
        timestamp: new Date().toISOString(),
        scenarioId: "weakened-assertion",
        resultStatus: "BLOCKED",
      },
    });

    render(<IntegrationsView />);

    await waitFor(() => {
      expect(screen.getByTestId("sentry-live-trace-id")).toHaveTextContent("7bf53c7cd5c5478a9d562f9012120a5d");
    });

    expect(screen.getByText("weakened-assertion")).toBeInTheDocument();
    expect(screen.getByText("BLOCKED")).toBeInTheDocument();
    expect(screen.getByText("Open in Sentry Performance UI")).toBeInTheDocument();
  });

  it("5. Triggering Sentry connection verification updates diagnostics state", async () => {
    vi.spyOn(api, "fetchSentryDiagnostics").mockResolvedValue({
      status: "CONFIGURED",
      dsnConfigured: true,
      environment: "development",
      sampleRate: 1.0,
      redactionActive: true,
    });

    vi.spyOn(api, "verifySentryConnectionApi").mockResolvedValue({
      check: {
        timestamp: new Date().toISOString(),
        status: "passed",
        message: "Sentry Agent Tracing verified for host 'o0.ingest.sentry.io'",
        traceId: "check-1234567890abcdef1234567890abcdef",
      },
      status: {
        status: "CONFIGURED",
        dsnConfigured: true,
        environment: "development",
        sampleRate: 1.0,
        redactionActive: true,
        lastVerifiedCheck: {
          timestamp: new Date().toISOString(),
          status: "passed",
          message: "Sentry Agent Tracing verified for host 'o0.ingest.sentry.io'",
          traceId: "check-1234567890abcdef1234567890abcdef",
        },
      },
    });

    render(<IntegrationsView />);

    const verifyBtn = screen.getByTestId("test-sentry-btn");
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(api.verifySentryConnectionApi).toHaveBeenCalled();
      expect(screen.getByText(/verified for host 'o0.ingest.sentry.io'/)).toBeInTheDocument();
    });
  });
});
