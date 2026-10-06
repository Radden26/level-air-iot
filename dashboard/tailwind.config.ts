import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#070b19",
        primary: "#0ea5e9",
        card: "#0f172a",
        border: "#1e293b",
      },
      keyframes: {
        wave: {
          "0%": { transform: "translateX(-50%)" },
          "100%": { transform: "translateX(0%)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 12px currentColor" },
          "50%": { opacity: "0.7", boxShadow: "0 0 24px currentColor" },
        }
      },
      animation: {
        wave: "wave 3s linear infinite",
        pulseGlow: "pulseGlow 1.5s ease-in-out infinite",
      }
    },
  },
  plugins: [],
};
export default config;
