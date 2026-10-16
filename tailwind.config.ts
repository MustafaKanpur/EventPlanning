import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // Overridden, not extended: capping the scale at 3px is how the "no pill cards"
    // rule is actually enforced — `rounded-xl` left over in a page clamps to 3px
    // instead of quietly staying round. `full` survives for dots and avatars.
    borderRadius: {
      none: "0",
      sm: "2px",
      DEFAULT: "3px",
      md: "3px",
      lg: "3px",
      xl: "3px",
      "2xl": "3px",
      "3xl": "3px",
      full: "9999px",
    },
    // Same reasoning: the system is borders, not shadows. Any `shadow-*` still in the
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
