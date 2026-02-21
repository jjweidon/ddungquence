import type { CardId } from "../types";

export type JackType = "two-eye" | "one-eye";

/** 클로버·다이아 잭 → Two-eyed Jack (와일드 배치) */
const TWO_EYE_SUITS = new Set(["clover", "diamond"]);
/** 스페이드·하트 잭 → One-eyed Jack (칩 제거) */
const ONE_EYE_SUITS = new Set(["spade", "heart"]);

/**
 * 주어진 카드가 잭인지 판별
 */
export function isJack(cardId: CardId): boolean {
  const parts = cardId.split("_");
  return parts[1] === "j";
}

/**
 * Two-eyed Jack (와일드 배치): 클로버·다이아 잭 (j_1, j_2 모두)
 * 보드의 어떤 빈 칸에도 아군 칩 배치 가능
 */
export function isTwoEyedJack(cardId: CardId): boolean {
  const parts = cardId.split("_");
  return parts[1] === "j" && TWO_EYE_SUITS.has(parts[0]);
}

/**
 * One-eyed Jack (칩 제거): 스페이드·하트 잭 (j_1, j_2 모두)
 * 완성된 시퀀스 칩 제거 불가(변형 규칙)
 */
export function isOneEyedJack(cardId: CardId): boolean {
  const parts = cardId.split("_");
  return parts[1] === "j" && ONE_EYE_SUITS.has(parts[0]);
}

/**
 * 잭 종류 반환. 잭이 아니면 null
 */
export function getJackType(cardId: CardId): JackType | null {
  if (isTwoEyedJack(cardId)) return "two-eye";
  if (isOneEyedJack(cardId)) return "one-eye";
  return null;
}
