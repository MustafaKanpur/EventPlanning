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
        ground: "#F7F5EF", // warm paper — the page itself
        panel: "#FFFDF8", // raised surfaces
        "panel-alt": "#F2EFE6", // table headers, rails
        ink: "#1C1B18", // primary text
        "ink-muted": "#6A675F", // secondary text
        rule: "#D8D2C3", // container borders
        "rule-soft": "#EBE6DA", // row dividers
        accent: "#2A5547", // deep pine — links, primary progress
        warn: "#8A6A1F", // pending, gaps, unpaid
        danger: "#A33A1F", // overdue, over budget
        success: "#6E8F5E", // registration fill
      },
      fontFamily: {
        sans: ["var(--font-archivo)", "ui-sans-serif", "sans-serif"],
        display: ["var(--font-instrument-serif)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // The system leans on a few precise sizes that aren't on Tailwind's scale.
        micro: ["10.5px", { lineHeight: "1.2", letterSpacing: "0.09em" }],
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
