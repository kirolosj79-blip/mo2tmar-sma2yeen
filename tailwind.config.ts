import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        gold: "#F2B84B",
        teal: "#2DD4BF",
        coral: "#FB7185",
        violet: "#A78BFA",
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface2)",
        border: "var(--border)",
        text: "var(--text)",
        textdim: "var(--textdim)",
        track: "var(--track)",
      },
      fontFamily: {
        display: ["Manrope", "Tajawal", "sans-serif"],
        body: ["Inter", "Tajawal", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
      },
    },
  },
  plugins: [],
};
export default config;
