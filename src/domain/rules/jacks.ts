import type { CardId } from "../types";

export type JackType = "two-eye" | "one-eye";

/**
 * 주어진 카드가 잭인지 판별
 */
export function isJack(cardId: CardId): boolean {
  const parts = cardId.split("_");
  return parts[1] === "j";
}

/**
 * Two-eyed Jack (와일드 배치): 카드 ID가 *_j_2 형태
 * 보드의 어떤 빈 칸에도 아군 칩 배치 가능
 */
export function isTwoEyedJack(cardId: CardId): boolean {
  return cardId.endsWith("_j_2");
}

/**
 * One-eyed Jack (상대 칩 제거): 카드 ID가 *_j_1 형태
 * 완성된 시퀀스 칩 제거 불가(변형 규칙)
 */
export function isOneEyedJack(cardId: CardId): boolean {
  return cardId.endsWith("_j_1");
}

/**
 * 잭 종류 반환. 잭이 아니면 null
 */
export function getJackType(cardId: CardId): JackType | null {
  if (isTwoEyedJack(cardId)) return "two-eye";
  if (isOneEyedJack(cardId)) return "one-eye";
  return null;
}
