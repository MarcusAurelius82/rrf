import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["var(--font-mono)", "IBM Plex Mono", "monospace"],
        sans: ["var(--font-sans)", "IBM Plex Sans", "sans-serif"],
      },
      colors: {
        // Surface backgrounds — resolved from CSS variables, auto-switch on theme change
        surface: {
          0: "var(--surface-0)",
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
        },
        // Accent — blue, theme-invariant
        accent: {
          DEFAULT: "#2563eb",
          hover:   "#1d4ed8",
          dim:     "rgba(37,99,235,0.15)",
          border:  "rgba(37,99,235,0.30)",
        },
        // Text hierarchy
        content: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary:  "var(--text-tertiary)",
          muted:     "var(--text-muted)",
          faint:     "var(--text-faint)",
        },
        // Border opacity tokens (full RGBA baked in per theme)
        border: {
          subtle:  "var(--border-subtle)",
          DEFAULT: "var(--border-default)",
          active:  "var(--border-active)",
          strong:  "var(--border-strong)",
        },
      },
      fontSize: {
        "2xs": ["8px", { lineHeight: "12px" }],
        "3xs": ["9px", { lineHeight: "14px" }],
        "xs": ["10px", { lineHeight: "16px" }],
        "sm": ["11px", { lineHeight: "18px" }],
      },
      letterSpacing: {
        label: "0.08em",
        heading: "0.12em",
        wide: "0.06em",
        wider: "0.10em",
      },
      screens: {
        xs: "480px",
      },
    },
  },
  plugins: [],
};
export default config;
