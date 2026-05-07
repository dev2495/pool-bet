import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f4f9ff",
        panel: "#ffffff",
        panel2: "#eef7ff",
        line: "#c9dceb",
        ink: "#071b35",
        muted: "#55708a",
        accent: "#ff4e45",
        win: "#059647",
        loss: "#e42335",
        warn: "#b77900",
      },
    },
  },
  plugins: [],
};

export default config;
