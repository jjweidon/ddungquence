import type { CardId, Suit, Rank } from "../types";

const SUITS: Suit[] = ["spade", "heart", "diamond", "clover"];
const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "j", "q", "k", "a"];

/**
 * 108장 덱 생성 (표준 52장 × 2벌 + 코너 카드 4장)
 * 카드 ID: "{suit}_{rank}_{variant}" — variant 1은 첫 번째 벌, 2는 두 번째 벌
 * 코너: o_o_1, o_o_2, o_o_3, o_o_4 (보드 cellId 0, 9, 90, 99에 대응)
 */
export function createDeck(): CardId[] {
  const cards: CardId[] = [];
  for (const variant of [1, 2] as const) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push(`${suit}_${rank}_${variant}`);
      }
    }
  }
  // 코너 카드 4장 (변형 규칙: 코너에 칩을 놓으려면 해당 코너 카드 필요)
  cards.push("o_o_1", "o_o_2", "o_o_3", "o_o_4");
  return cards; // 104 + 4 = 108
}

/**
 * Fisher-Yates 셔플 — 원본 배열을 변경하지 않고 새 배열 반환
 */
export function shuffle(deck: CardId[]): CardId[] {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 덱 생성 후 셔플까지 한 번에 */
export function createShuffledDeck(): CardId[] {
  return shuffle(createDeck());
}
