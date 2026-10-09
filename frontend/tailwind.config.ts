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
      keyframes: {
        sceneIn: {
          from: { opacity: "0", transform: "scale(1.02)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "scene-in": "sceneIn .5s ease",
      },
    },
  },
  plugins: [],
  darkMode: "class",
};

export default config;
