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
          blue: "#1E3A8A",
          blueDark: "#152A6B",
          blueLight: "#6B9AE8",
          green: "#16A34A",
        },
      },
      fontFamily: {
        sans: ["var(--font-noto-sans-kr)", "var(--font-inter)", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        "dq-slide": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "dq-sequence-pop-in": {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "15%": { opacity: "1", transform: "scale(1.08)" },
          "30%": { transform: "scale(1)" },
          "85%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(0.95)" },
        },
        // 일반 카드 칩 배치: 작게 시작 → 살짝 오버슈트 → 안착
        "chip-place": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "55%": { transform: "scale(1.22)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        // 2-eye Wild Jack 배치: 더 크게 튀어나왔다 → 스프링 정착
        "chip-place-wild": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "45%": { transform: "scale(1.55)", opacity: "1" },
          "70%": { transform: "scale(0.88)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        // 1-eye Jack 제거: 살짝 부풀었다 → 1초에 걸쳐 스르륵 사라짐
        "chip-remove": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "15%": { transform: "scale(1.12)", opacity: "0.9" },
          "100%": { transform: "scale(0.1)", opacity: "0" },
        },
        // 턴 타이머 임박: 빨간색 강조 펄스
        "timer-warning": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.85", transform: "scale(1.05)" },
        },
      },
      animation: {
        "dq-slide-slow": "dq-slide 60s linear infinite",
        "dq-slide-slower": "dq-slide 80s linear infinite",
        "dq-sequence-pop": "dq-sequence-pop-in 2s ease-out forwards",
        "chip-place": "chip-place 0.42s cubic-bezier(0.34,1.56,0.64,1) forwards",
        "chip-place-wild": "chip-place-wild 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards",
        "chip-remove": "chip-remove 1s ease-in forwards",
        "timer-warning": "timer-warning 0.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
