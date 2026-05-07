import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#071626",
        panel: "#10253a",
        panel2: "#17334c",
        line: "#2e5470",
        ink: "#f4fbff",
        muted: "#a6bfd0",
        accent: "#38e8ff",
        win: "#22c55e",
        loss: "#ff5b6b",
        warn: "#fbbf24",
      },
    },
  },
  plugins: [],
};

export default config;
