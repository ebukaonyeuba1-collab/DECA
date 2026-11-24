import type { Config } from "tailwindcss";

// DECA design tokens. Colours resolve to CSS variables in globals.css so a theme change is one file.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: "var(--c-forest)", 700: "var(--c-forest-700)", 900: "var(--c-forest-900)" },
        mint: { DEFAULT: "var(--c-mint)", 100: "var(--c-mint-100)", 50: "var(--c-mint-50)" },
        canvas: "var(--c-canvas)", surface: "var(--c-surface)",
        ink: { DEFAULT: "var(--c-ink)", muted: "var(--c-ink-muted)" },
        line: "var(--c-line)",
        success: "var(--c-success)", warning: "var(--c-warning)", danger: "var(--c-danger)",
      },
      fontFamily: { sans: ["'Manrope Variable'", "system-ui", "sans-serif"] },
      borderRadius: { card: "1.5rem", control: "999px", sheet: "2rem" },
      boxShadow: { soft: "0 6px 20px rgba(15,74,56,.08)", lift: "0 14px 36px rgba(15,74,56,.14)" },
      transitionTimingFunction: { deca: "cubic-bezier(.2,.8,.2,1)" },
    },
  },
  plugins: [],
};
export default config;
