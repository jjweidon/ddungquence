import type { Config } from "tailwindcss";

export default {
  darkMode: "media",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/shared/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dq: {
          black: "#0B0B0F",
          charcoal: "#1A1D24",
          charcoalDeep: "#111318",
          white: "#F8FAFC",
          red: "#D61F2C",
          redDark: "#A0121C",
          redLight: "#FF4D5A",
          blue: "#2563EB",
          green: "#16A34A",
        },
      },
      fontFamily: {
        sans: ["var(--font-noto-sans-kr)", "var(--font-inter)", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      animation: {
        "dq-slide-slow": "dq-slide 60s linear infinite",
        "dq-slide-slower": "dq-slide 80s linear infinite",
      },
      keyframes: {
        "dq-slide": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
