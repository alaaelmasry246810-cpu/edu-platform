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
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-5px)" },
          "75%": { transform: "translateX(5px)" },
        },
        pop: {
          "0%": { transform: "scale(.6)", opacity: "0" },
          "70%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        sceneIn: {
          from: { opacity: "0", transform: "scale(1.02)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "scene-in": "sceneIn .5s ease",
        shake: "shake .3s ease-in-out",
        pop: "pop .45s ease-out",
      },
    },
  },
  plugins: [],
  darkMode: "class",
};

export default config;
