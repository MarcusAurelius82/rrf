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
    },
  },
  plugins: [],
};
export default config;
