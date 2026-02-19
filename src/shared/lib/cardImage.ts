/**
 * 카드 이미지 경로 유틸리티
 *
 * 카드 ID 규격: {suit}_{rank}_{variant}
 *   suit   : spade | heart | diamond | clover | o (코너)
 *   rank   : 2..10 | j | q | k | a | o (코너)
 *   variant: 1 | 2 (일반), 1..4 (코너)
 *
 * 이미지 위치: public/cards/webp/{cardId}.webp
 */

const SUIT_KO: Record<string, string> = {
  spade: "스페이드",
  heart: "하트",
  diamond: "다이아",
  clover: "클로버",
  o: "코너",
};

const RANK_KO: Record<string, string> = {
  a: "에이스",
  k: "킹",
  q: "퀸",
  j: "잭",
  o: "",
};

/**
 * cardId → webp 이미지 경로
 * @example cardImageUrl("spade_2_1") → "/cards/webp/spade_2_1.webp"
 */
export function cardImageUrl(cardId: string): string {
  return `/cards/webp/${cardId}.webp`;
}

/**
 * cardId → 접근성용 한국어 alt 텍스트
 * @example cardAltText("heart_j_1") → "하트 잭"
 * @example cardAltText("o_o_3")     → "코너 3"
 */
export function cardAltText(cardId: string): string {
  const parts = cardId.split("_");
  const suit = SUIT_KO[parts[0]] ?? parts[0];

  if (parts[0] === "o") {
    return `코너 ${parts[2]}`;
  }

  const rank = RANK_KO[parts[1]] ?? parts[1].toUpperCase();
  return `${suit} ${rank}`;
}

