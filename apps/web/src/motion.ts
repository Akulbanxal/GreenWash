import { Variants, Transition } from "motion/react";

/**
 * Top-tier motion tokens adhering to Linear/Vercel/Apple design physics:
 * - Ultra-smooth inertia easing: [0.16, 1, 0.3, 1]
 * - Tactile spring physics: stiffness 420, damping 26 (crisp, zero overshoot)
 * - Micro-interactions: 120–180 ms
 * - Surface / panel transitions: 200–260 ms
 */

export const EASING_PREMIUM = [0.16, 1, 0.3, 1] as const;

export const TRANSITION_FAST: Transition = {
  duration: 0.16,
  ease: EASING_PREMIUM,
};

export const TRANSITION_PANEL: Transition = {
  duration: 0.24,
  ease: EASING_PREMIUM,
};

export const TRANSITION_DRAWER: Transition = {
  duration: 0.22,
  ease: EASING_PREMIUM,
};

export const STAGGER_CONTAINER_VARIANTS: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.015,
    },
  },
};

export const STAGGER_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: EASING_PREMIUM,
    },
  },
};

export const FADE_SLIDE_VARIANTS: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: TRANSITION_PANEL },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12, ease: "easeIn" } },
};

export const TAB_CONTENT_VARIANTS: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASING_PREMIUM } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

export const PAGE_ENTRANCE_VARIANTS: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.24,
      ease: EASING_PREMIUM,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: 0.14,
      ease: "easeIn",
    },
  },
};

export const BUTTON_INTERACTION = {
  whileHover: { scale: 1.015, transition: { duration: 0.12, ease: EASING_PREMIUM } },
  whileTap: { scale: 0.97, transition: { duration: 0.08 } },
};

export const CARD_HOVER_INTERACTION = {
  whileHover: {
    y: -2.5,
    transition: { type: "spring", stiffness: 420, damping: 26 },
  },
  whileTap: {
    scale: 0.99,
    transition: { duration: 0.08 },
  },
};

export const VERDICT_PULSE_VARIANTS: Variants = {
  initial: { scale: 0.92, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 420,
      damping: 22,
    },
  },
};
