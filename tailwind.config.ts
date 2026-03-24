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
        surface: {
          0: "#0a0a0a",
          1: "#111111",
          2: "#1a1a1a",
          3: "#222222",
        },
        accent: {
          DEFAULT: "#2563eb",
          hover: "#1d4ed8",
          dim: "rgba(37,99,235,0.15)",
          border: "rgba(37,99,235,0.30)",
        },
        content: {
          primary: "#ffffff",
          secondary: "#888888",
          tertiary: "#555555",
          muted: "#444444",
          faint: "#333333",
        },
        border: {
          subtle: "rgba(255,255,255,0.06)",
          DEFAULT: "rgba(255,255,255,0.08)",
          active: "rgba(255,255,255,0.15)",
          strong: "rgba(255,255,255,0.20)",
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
