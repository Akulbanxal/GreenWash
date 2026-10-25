/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../src/theme/ThemeContext";
import { Header } from "../src/components/Header";
import { AmbientSignalBackground } from "../src/components/AmbientSignalBackground";
import App from "../src/App";

describe("Theme System & Motion Tests", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("initializes with default dark mode and sets html class and data-theme", () => {
    function TestConsumer() {
      const { theme } = useTheme();
      return <div data-testid="theme-val">{theme}</div>;
    }

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme-val").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("toggles theme between dark and light, persisting to localStorage", () => {
    function ToggleTestConsumer() {
      const { theme, toggleTheme } = useTheme();
      return (
        <div>
          <span data-testid="current-theme">{theme}</span>
          <button data-testid="toggle-btn" onClick={toggleTheme}>
            Toggle
          </button>
        </div>
      );
    }

    render(
      <ThemeProvider>
        <ToggleTestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    // Toggle to Light
    fireEvent.click(screen.getByTestId("toggle-btn"));
    expect(screen.getByTestId("current-theme").textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("greenwash-theme")).toBe("light");

    // Toggle back to Dark
    fireEvent.click(screen.getByTestId("toggle-btn"));
    expect(screen.getByTestId("current-theme").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("greenwash-theme")).toBe("dark");
  });

  it("Header renders theme toggle button with accessible label and tooltips", () => {
    render(
      <ThemeProvider>
        <Header
          activeScreen="demo"
          onSelectScreen={vi.fn()}
          selectedScenarioId="weakened-assertion"
          onSelectScenario={vi.fn()}
          onRunAudit={vi.fn()}
          isAuditing={false}
          status="BLOCKED"
          findingCount={2}
        />
      </ThemeProvider>
    );

    const toggleBtn = screen.getByTestId("theme-toggle-btn");
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn.getAttribute("aria-label")).toBe("Switch to light mode");

    // Click toggle
    fireEvent.click(toggleBtn);
    expect(toggleBtn.getAttribute("aria-label")).toBe("Switch to dark mode");
  });

  it("AmbientSignalBackground mounts with canvas and container element", () => {
    render(
      <ThemeProvider>
        <AmbientSignalBackground />
      </ThemeProvider>
    );

    expect(screen.getByTestId("ambient-signal-background")).toBeDefined();
  });

  it("Full App renders with Header theme toggle and switches routes with motion container", () => {
    render(<App />);

    // Header has theme toggle
    expect(screen.getByTestId("theme-toggle-btn")).toBeDefined();

    // Verify Demo Lab is visible
    expect(screen.getByTestId("lab-run-audit-btn")).toBeDefined();

    // Switch to Contracts screen
    fireEvent.click(screen.getByText("Contracts"));
    expect(screen.getByText("Contract Explorer")).toBeDefined();

    // Toggle theme while on Contracts screen
    fireEvent.click(screen.getByTestId("theme-toggle-btn"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    // Switch to Workbench
    fireEvent.click(screen.getByText("Workbench"));
    expect(screen.getByRole("region", { name: /Workbench File Navigation/i })).toBeDefined();
  });
});
