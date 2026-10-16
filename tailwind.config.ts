import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // Two radii carry the hierarchy: 10px for panels, 6px for the controls inside them.
    // Overridden rather than extended so a stray `rounded-2xl` can't drift past 14px.
    borderRadius: {
      none: "0",
      sm: "4px",
      DEFAULT: "6px",
      md: "6px",
      lg: "10px",
      xl: "14px",
      "2xl": "14px",
      "3xl": "14px",
      full: "9999px",
    },
    // The system is borders, not shadows. Any `shadow-*` still in the
    // codebase resolves to nothing rather than reintroducing float.
    boxShadow: {
      none: "none",
      sm: "none",
      DEFAULT: "none",
      md: "none",
      lg: "none",
      xl: "none",
      "2xl": "none",
      inner: "none",
    },
    extend: {
      colors: {
        ground: "#ECEEF2", // cool concrete — the page itself
        panel: "#FFFFFF", // raised surfaces
        "panel-alt": "#E3E6EC", // table headers, rails
        ink: "#1A1F36", // primary text, and the top bar
        "ink-muted": "#586079", // secondary text
        rule: "#CBD0DB", // container borders
        "rule-soft": "#E2E5EB", // row dividers
        accent: "#3B34C8", // ultramarine — links, primary progress
        highlight: "#FFD23F", // gaffer-tape yellow — only the active marker in the dark bar
        warn: "#8F5E00", // pending, gaps, unpaid
        danger: "#C0341D", // overdue, over budget
        success: "#23855A", // registration fill
        proposed: "#A2389C", // AI-proposed blocks awaiting approval
      },
      fontFamily: {
        sans: ["var(--font-public-sans)", "ui-sans-serif", "sans-serif"],
        display: ["var(--font-big-shoulders)", "ui-sans-serif", "sans-serif"],
        // Figures stay in the UI face; globals.css makes them tabular so columns line up.
        mono: ["var(--font-public-sans)", "ui-sans-serif", "sans-serif"],
      },
      fontSize: {
        // The system leans on a few precise sizes that aren't on Tailwind's scale.
        micro: ["11.5px", { lineHeight: "1.25", letterSpacing: "0.01em" }],
        meta: ["11px", { lineHeight: "1.35" }],
        caption: ["12.5px", { lineHeight: "1.45" }],
        ui: ["13.5px", { lineHeight: "1.45" }],
      },
      height: {
        bar: "60px", // top chrome
        row: "80px", // data table row
        head: "38px", // data table header
      },
    },
  },
  plugins: [],
};
export default config;
