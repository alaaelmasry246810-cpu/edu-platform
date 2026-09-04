import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        arabic: ["Noto Kufi Arabic", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      colors: {
        brand: {
          50:  "#EFF6FF",
          100: "#DBEAFE",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          900: "#1E3A8A",
        },
        teal: {
          500: "#14B8A6",
          600: "#0891B2",
        }
      },
    },
  },
  plugins: [],
  darkMode: "class",
};

export default config;
