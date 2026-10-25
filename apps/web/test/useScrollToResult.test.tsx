/**
 * @vitest-environment jsdom
 */
import React, { useRef, useState } from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import {
  useScrollToResult,
  scrollToResultElement,
  getScrollableParent,
  isElementTopVisible,
} from "../src/hooks/useScrollToResult";

describe("useScrollToResult and auto-scroll utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("finds scrollable parent correctly", () => {
    const parent = document.createElement("div");
    parent.style.overflowY = "auto";
    Object.defineProperty(parent, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(parent, "clientHeight", { value: 400, configurable: true });

    const child = document.createElement("div");
    parent.appendChild(child);
    document.body.appendChild(parent);

    // Mock getComputedStyle for jsdom
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = vi.fn().mockImplementation((el) => {
      if (el === parent) {
        return { overflowY: "auto" } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(el);
    });

    const scrollParent = getScrollableParent(child);
    expect(scrollParent).toBe(parent);

    window.getComputedStyle = originalGetComputedStyle;
    document.body.removeChild(parent);
  });

  it("calculates isElementTopVisible accurately", () => {
    const target = document.createElement("div");
    target.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 50,
      bottom: 250,
      height: 200,
    });

    const container = document.createElement("div");
    container.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 0,
      bottom: 600,
      height: 600,
    });

    // When element top is within visible bounds
    expect(isElementTopVisible(target, container, 24)).toBe(true);

    // When element top is far below container
    target.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 700,
      bottom: 900,
      height: 200,
    });
    expect(isElementTopVisible(target, container, 24)).toBe(false);
  });

  it("scrolls container smoothly to target with topOffset", () => {
    const container = document.createElement("div");
    container.scrollTop = 100;
    container.scrollTo = vi.fn();
    container.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 100,
      bottom: 500,
      height: 400,
    });

    const target = document.createElement("div");
    target.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 700, // 600px below container top
      bottom: 850,
      height: 150,
    });
    container.appendChild(target);

    const scrolled = scrollToResultElement(target, {
      container,
      topOffset: 24,
      reducedMotion: false,
      focusOnScroll: true,
    });

    expect(scrolled).toBe(true);
    expect(container.scrollTo).toHaveBeenCalledWith({
      top: 100 + (700 - 100) - 24, // 676
      behavior: "smooth",
    });
    expect(target.getAttribute("tabindex")).toBe("-1");
  });

  it("respects reduced motion by using auto behavior", () => {
    const container = document.createElement("div");
    container.scrollTop = 0;
    container.scrollTo = vi.fn();
    container.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 0,
      bottom: 400,
      height: 400,
    });

    const target = document.createElement("div");
    target.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 600,
      bottom: 800,
      height: 200,
    });
    container.appendChild(target);

    scrollToResultElement(target, {
      container,
      topOffset: 20,
      reducedMotion: true,
    });

    expect(container.scrollTo).toHaveBeenCalledWith({
      top: 580,
      behavior: "auto",
    });
  });

  it("triggers scroll via useScrollToResult hook when triggerKey updates", () => {
    const onScrolled = vi.fn();

    function TestComponent() {
      const containerRef = useRef<HTMLDivElement>(null);
      const targetRef = useRef<HTMLDivElement>(null);
      const [triggerKey, setTriggerKey] = useState<string | null>(null);

      useScrollToResult({
        targetRef,
        containerRef,
        triggerKey,
        enabled: Boolean(triggerKey),
        topOffset: 24,
        onScrolled,
      });

      return (
        <div ref={containerRef} style={{ height: "400px", overflowY: "auto" }}>
          <button data-testid="trigger-btn" onClick={() => setTriggerKey("result-123")}>
            Run
          </button>
          <div style={{ height: "800px" }} />
          <div ref={targetRef} data-testid="target-result">
            Result Card
          </div>
        </div>
      );
    }

    render(<TestComponent />);

    const target = screen.getByTestId("target-result");
    target.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 900,
      bottom: 1100,
      height: 200,
    });

    // Click button to set triggerKey
    act(() => {
      fireEvent.click(screen.getByTestId("trigger-btn"));
    });

    // Advance RAF timers
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(onScrolled).toHaveBeenCalled();
  });
});
