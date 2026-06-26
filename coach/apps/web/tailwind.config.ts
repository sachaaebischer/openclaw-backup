import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f14",
        card: "#141b24",
        cardborder: "#222e3a",
        muted: "#8a99a8",
        accent: "#38bdf8",
        good: "#34d399",
        warn: "#fbbf24",
        bad: "#f87171",
      },
    },
  },
  plugins: [],
};

export default config;
