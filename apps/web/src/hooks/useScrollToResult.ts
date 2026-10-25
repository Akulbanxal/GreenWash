import { useEffect, useRef, useCallback } from "react";
import { useReducedMotion } from "motion/react";

export interface ScrollToResultOptions {
  /**
   * Ref attached to the result container element.
   */
  targetRef: React.RefObject<HTMLElement | null>;
  /**
   * Optional ref to the scrollable parent container.
   * If omitted, the closest scrollable ancestor (or window) will be found automatically.
   */
  containerRef?: React.RefObject<HTMLElement | null>;
  /**
   * Value that uniquely identifies a newly completed action or result.
   * (e.g., report.id, timestamp, status, error message, selected id).
   * Scrolling only executes when this key changes to a truthy value.
   */
  triggerKey?: unknown;
  /**
   * Condition guarding whether scrolling is active.
   * Defaults to true.
   */
  enabled?: boolean;
  /**
   * Top offset in pixels (gap between the container top/header and the result heading).
   * Defaults to 24px.
   */
  topOffset?: number;
  /**
   * If true, applies tabindex="-1" and focuses the result element safely without jumping.
   * Defaults to false.
   */
  focusOnScroll?: boolean;
  /**
   * Logical block alignment when scrollIntoView fallback is used.
   * Defaults to 'start'.
   */
  block?: ScrollLogicalPosition;
  /**
   * Optional callback fired after scroll is initiated.
   */
  onScrolled?: () => void;
}

/**
 * Finds the nearest scrollable ancestor for a given DOM node.
 */
export function getScrollableParent(node: HTMLElement | null): HTMLElement | Window {
  if (!node || typeof window === "undefined") return window;

  let current = node.parentElement;
  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    const isScrollable = (overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight;
    if (isScrollable) {
      return current;
    }
    current = current.parentElement;
  }

  return window;
}

/**
 * Determines whether an element's heading/top region is already comfortably visible
 * within its scroll container to prevent jarring, redundant scrolls.
 */
export function isElementTopVisible(
  element: HTMLElement,
  container: HTMLElement | Window = window,
  topOffset = 24
): boolean {
  if (!element || typeof window === "undefined") return true;

  const rect = element.getBoundingClientRect();

  if (container === window) {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    // Visible if top is below header offset and within the top 75% of viewport
    return rect.top >= topOffset && rect.top <= viewportHeight * 0.75;
  }

  const cRect = (container as HTMLElement).getBoundingClientRect();
  const visibleTopMin = cRect.top + topOffset - 10;
  const visibleTopMax = cRect.top + Math.min(cRect.height * 0.7, 400);

  return rect.top >= visibleTopMin && rect.top <= visibleTopMax;
}

/**
 * Smoothly scrolls the target element into view inside its scroll container,
 * accounting for fixed headers, offsets, and reduced motion preferences.
 */
export function scrollToResultElement(
  element: HTMLElement | null,
  options: {
    container?: HTMLElement | Window;
    topOffset?: number;
    reducedMotion?: boolean;
    block?: ScrollLogicalPosition;
    focusOnScroll?: boolean;
    force?: boolean;
  } = {}
): boolean {
  if (!element || typeof window === "undefined") return false;

  const {
    container = getScrollableParent(element),
    topOffset = 24,
    reducedMotion = false,
    block = "start",
    focusOnScroll = false,
    force = false,
  } = options;

  // If the result top is already comfortably visible, avoid distracting unnecessary movement
  if (!force && isElementTopVisible(element, container, topOffset)) {
    return false;
  }

  const behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";

  if (container instanceof HTMLElement) {
    const cRect = container.getBoundingClientRect();
    const eRect = element.getBoundingClientRect();
    const currentScrollTop = container.scrollTop;
    const delta = eRect.top - cRect.top - topOffset;
    const targetScrollTop = Math.max(0, currentScrollTop + delta);

    if (typeof container.scrollTo === "function") {
      container.scrollTo({ top: targetScrollTop, behavior });
    } else {
      container.scrollTop = targetScrollTop;
    }
  } else {
    // Window / document scrolling
    const eRect = element.getBoundingClientRect();
    const currentScrollY = window.scrollY || window.pageYOffset;
    const targetScrollY = Math.max(0, currentScrollY + eRect.top - topOffset);

    if (typeof window.scrollTo === "function") {
      window.scrollTo({ top: targetScrollY, behavior });
    } else {
      window.pageYOffset = targetScrollY;
    }
  }

  // Fallback / backup scrollIntoView with scroll-margin-top
  try {
    element.style.scrollMarginTop = `${topOffset}px`;
    if (typeof element.scrollIntoView === "function" && !(container instanceof HTMLElement)) {
      element.scrollIntoView({ behavior, block });
    }
  } catch {
    // Graceful fallback
  }

  // Optional accessible focus management
  if (focusOnScroll) {
    if (!element.hasAttribute("tabindex")) {
      element.setAttribute("tabindex", "-1");
    }
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
  }

  return true;
}

/**
 * Reusable React hook that smoothly brings a newly rendered action result
 * into view when its triggerKey or completion state updates.
 */
export function useScrollToResult({
  targetRef,
  containerRef,
  triggerKey,
  enabled = true,
  topOffset = 24,
  focusOnScroll = false,
  block = "start",
  onScrolled,
}: ScrollToResultOptions): void {
  const shouldReduceMotion = useReducedMotion();
  const lastProcessedKeyRef = useRef<unknown>(undefined);
  const rafIdRef = useRef<number | null>(null);

  const performScroll = useCallback(() => {
    if (!targetRef.current) return;

    const container = containerRef?.current || getScrollableParent(targetRef.current);
    const didScroll = scrollToResultElement(targetRef.current, {
      container,
      topOffset,
      reducedMotion: Boolean(shouldReduceMotion),
      block,
      focusOnScroll,
    });

    if (didScroll && onScrolled) {
      onScrolled();
    }
  }, [targetRef, containerRef, topOffset, shouldReduceMotion, block, focusOnScroll, onScrolled]);

  useEffect(() => {
    // Do nothing if disabled or trigger key is empty/falsy
    if (!enabled || triggerKey === undefined || triggerKey === null || triggerKey === false || triggerKey === "") {
      return;
    }

    // Only scroll when trigger key actually changes
    if (lastProcessedKeyRef.current === triggerKey) {
      return;
    }

    lastProcessedKeyRef.current = triggerKey;

    // Use double requestAnimationFrame to ensure React rendering, Framer Motion transitions,
    // and layout calculation have all settled before measuring coordinates
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = requestAnimationFrame(() => {
        performScroll();
      });
    });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [triggerKey, enabled, performScroll]);
}
