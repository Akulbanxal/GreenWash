/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base: "var(--color-surface-base)",
          panel: "var(--color-surface-panel)",
          subtle: "var(--color-surface-subtle)",
          code: "var(--color-surface-code)",
          terminal: "var(--color-surface-terminal)",
        },
        border: {
          subtle: "var(--color-border-subtle)",
          default: "var(--color-border-default)",
          strong: "var(--color-border-strong)",
          dark: "var(--color-border-dark)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
          code: "var(--color-text-code)",
          "code-muted": "var(--color-text-code-muted)",
        },
        brand: {
          primary: "var(--color-brand-primary)",
          gemma: "var(--color-accent-gemma)",
          entire: "var(--color-accent-entire)",
          sentry: "var(--color-accent-sentry)",
        },
        status: {
          pass: {
            bg: "var(--color-status-pass-bg)",
            text: "var(--color-status-pass-text)",
            border: "var(--color-status-pass-border)",
            solid: "var(--color-status-pass-solid)",
          },
          review: {
            bg: "var(--color-status-review-bg)",
            text: "var(--color-status-review-text)",
            border: "var(--color-status-review-border)",
            solid: "var(--color-status-review-solid)",
          },
          blocked: {
            bg: "var(--color-status-blocked-bg)",
            text: "var(--color-status-blocked-text)",
            border: "var(--color-status-blocked-border)",
            solid: "var(--color-status-blocked-solid)",
          },
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        xs: ["11px", { lineHeight: "14px" }],
        sm: ["12px", { lineHeight: "16px" }],
        base: ["13px", { lineHeight: "18px" }],
        md: ["14px", { lineHeight: "20px" }],
        lg: ["16px", { lineHeight: "24px" }],
        xl: ["18px", { lineHeight: "26px" }],
      },
      borderRadius: {
        DEFAULT: "4px",
        md: "6px",
      },
    },
  },
  plugins: [],
};
