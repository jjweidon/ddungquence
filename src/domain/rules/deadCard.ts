import type { CardId, ChipsByCell } from "../types";
import boardLayoutJson from "../board/board-layout.v1.json";

const BOARD_LAYOUT = boardLayoutJson as string[];

/**
 * 카드 ID에서 variant 접미사를 제거한 베이스 ID 반환
 * "clover_7_1" → "clover_7",  "heart_10_2" → "heart_10"
 */
function toBaseCardId(cardId: CardId): string {
  const parts = cardId.split("_");
  return parts.slice(0, -1).join("_");
}

function isCornerCard(cardId: CardId): boolean {
  return cardId.startsWith("o_o_");
}

function isJackCard(cardId: CardId): boolean {
  const parts = cardId.split("_");
  return parts[1] === "j";
}

/**
 * 베이스 카드 ID → 보드 cellId 목록 (모든 등장 위치)
 * 예) "clover_7" → [20, 42]
 * 코너(o_o_*)는 맵에 포함하지 않는다.
 */
const BASE_CARD_TO_CELLS: Readonly<Record<string, number[]>> = (() => {
  const map: Record<string, number[]> = {};
  for (let cellId = 0; cellId < BOARD_LAYOUT.length; cellId++) {
    const cardId = BOARD_LAYOUT[cellId];
    if (isCornerCard(cardId)) continue;
    const base = toBaseCardId(cardId);
    if (!map[base]) map[base] = [];
    map[base].push(cellId);
  }
  return map;
})();

/**
 * 데드 카드 판정 (변형 규칙 고정)
 *
 * - 잭, 코너 카드는 항상 false (보드에 고정 칸이 없거나 손패에 없음)
 * - 일반 카드: 해당 rank/suit의 모든 보드 칸이 점유된 경우 true
 * - 데드 카드는 손에 유지, 사용 불가(교체 없음)
 *
 * @param cardId  플레이어 손패의 카드 ID
 * @param chipsByCell  현재 보드 칩 점유 맵
 */
export function isDeadCard(cardId: CardId, chipsByCell: ChipsByCell): boolean {
  if (isJackCard(cardId) || isCornerCard(cardId)) return false;

  const base = toBaseCardId(cardId);
  const cells = BASE_CARD_TO_CELLS[base];

  if (!cells || cells.length === 0) return false;

  return cells.every((cellId) => chipsByCell[String(cellId)] !== undefined);
}

/**
 * 손패 전체에서 데드 카드 목록 반환
 */
export function findDeadCards(hand: CardId[], chipsByCell: ChipsByCell): CardId[] {
  return hand.filter((cardId) => isDeadCard(cardId, chipsByCell));
}

/**
 * 주어진 카드 ID가 플레이 가능한 칸 목록 반환 (비어 있는 칸만)
 * 잭 카드는 별도 처리 필요 — 여기서는 일반 카드 전용
 */
export function getPlayableCells(cardId: CardId, chipsByCell: ChipsByCell): number[] {
  if (isJackCard(cardId) || isCornerCard(cardId)) return [];

  const base = toBaseCardId(cardId);
  const cells = BASE_CARD_TO_CELLS[base] ?? [];

  return cells.filter((cellId) => chipsByCell[String(cellId)] === undefined);
}
