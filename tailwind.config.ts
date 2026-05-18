import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Layered dark surface palette (deepest → brightest border)
        "background-deep": "#050505",
        "surface-dark": "#0a0a0a",
        "surface-lighter": "#0c0c0c",
        "border-dim": "#1a1a1a",
        "border-mid": "#222222",
        "border-bright": "#333333",

        // Sui brand accents
        "sui-blue": "#4DA2FF",
        "sui-aqua": "#6FBCF0",

        // Legacy tokens — remapped onto the new palette so existing
        // components stay coherent while we migrate.
        ink: "#050505",
        panel: "#0a0a0a",
        line: "#222222",
        accent: "#6FBCF0",
        accent2: "#4DA2FF",
        muted: "#7c8093",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        display: ["Outfit", "Inter", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(77, 162, 255, 0.55)",
        "glow-blue": "0 0 15px rgba(77, 162, 255, 0.4)",
        "glow-aqua": "0 0 15px rgba(111, 188, 240, 0.4)",
      },
    },
  },
  plugins: [],
};
export default config;
