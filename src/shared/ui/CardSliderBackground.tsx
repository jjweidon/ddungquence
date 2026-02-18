"use client";

import { useEffect, useMemo, useState } from "react";

const SUITS = ["clover", "diamond", "heart", "spade"] as const;
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "a", "j", "q", "k"] as const;

const ALL_CARD_PATHS: string[] = [
  ...SUITS.flatMap((suit) =>
    RANKS.map((rank) => `/cards/webp/${suit}_${rank}_1.webp`)
  ),
  "/cards/webp/o_o_1.webp",
  "/cards/webp/o_o_2.webp",
];

// Fisher-Yates
function shuffleCopy<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// 카드 1장: 169×244 원본 비율, 표시 48×69px
function CardImage({ src, index }: { src: string; index: number }) {
  return (
    <img
      src={src}
      alt=""
      width={48}
      height={69}
      loading={index < 20 ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      style={{
        flexShrink: 0,
        width: 48,
        height: 69,
        borderRadius: 5,
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
        objectFit: "cover",
        userSelect: "none",
        pointerEvents: "none",
      }}
    />
  );
}

interface SliderRowProps {
  cards: string[];
  duration: string;
}

function SliderRow({ cards, duration }: SliderRowProps) {
  const doubled = useMemo(() => [...cards, ...cards], [cards]);

  return (
    <div style={{ overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          animation: `dq-slide ${duration} linear infinite`,
          willChange: "transform",
        }}
      >
        {doubled.map((src, i) => (
          <CardImage key={`${src}-${i}`} src={src} index={i} />
        ))}
      </div>
    </div>
  );
}

export function CardSliderBackground() {
  /*
   * SSR에서는 렌더링하지 않는다.
   * Math.random()이 서버/클라이언트에서 다른 결과를 내기 때문에
   * hydration 불일치가 발생하므로, 마운트 후에만 표시한다.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const row1 = useMemo(() => shuffleCopy(ALL_CARD_PATHS), []);
  const row2 = useMemo(() => shuffleCopy(ALL_CARD_PATHS), []);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none"
    >
      {/* 카드 트랙: -8deg 회전 + 뷰포트 밖까지 확장 */}
      <div
        style={{
          position: "absolute",
          inset: "-30%",
          transform: "rotate(-8deg)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 28,
        }}
      >
        <SliderRow cards={row1} duration="60s" />
        <SliderRow cards={row2} duration="80s" />
      </div>

      {/*
       * 상단 페이드 — 라이트: white 기준 / 다크: #111318 기준
       * Tailwind dark: arbitrary value로 표현
       */}
      <div className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-white dark:from-dq-charcoalDeep to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-white dark:from-dq-charcoalDeep to-transparent" />

      {/* 전체 오버레이 — 라이트: 흰색 반투명 / 다크: 어두운 반투명 */}
      <div className="absolute inset-0 bg-white/60 dark:bg-dq-charcoalDeep/55" />
    </div>
  );
}
