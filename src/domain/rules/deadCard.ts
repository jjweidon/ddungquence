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
 * 카드 → 맵 조회 키 결정
 * - 일반 카드: variant 제거 (예: "clover_7_1" → "clover_7")
 *   같은 카드가 보드에 2번 등장하므로 두 셀을 하나의 키로 묶는다.
 * - 코너 카드(o_o_1~o_o_4): 모두 "o_o"로 통일 — variant 무관하게 4개 코너 중 빈 칸에 놓을 수 있음
 */
function toMapKey(cardId: CardId): string {
  return isCornerCard(cardId) ? "o_o" : toBaseCardId(cardId);
}

/**
 * 카드 → 보드 cellId 목록 (모든 등장 위치)
 * 예) "clover_7" → [20, 42],  "o_o" → [0, 9, 90, 99]
 */
const BASE_CARD_TO_CELLS: Readonly<Record<string, number[]>> = (() => {
  const map: Record<string, number[]> = {};
  for (let cellId = 0; cellId < BOARD_LAYOUT.length; cellId++) {
    const cardId = BOARD_LAYOUT[cellId];
    const key = toMapKey(cardId);
    if (!map[key]) map[key] = [];
    map[key].push(cellId);
  }
  return map;
})();

/**
 * 데드 카드 판정 (변형 규칙 고정)
 *
 * - 잭 카드: 항상 false (보드에 해당 칸이 없음)
 * - 일반/코너 카드: 해당 카드에 대응하는 모든 보드 칸이 점유된 경우 true
 * - 데드 카드는 손에 유지, 사용 불가(교체 없음)
 *
 * @param cardId  플레이어 손패의 카드 ID
 * @param chipsByCell  현재 보드 칩 점유 맵
 */
export function isDeadCard(cardId: CardId, chipsByCell: ChipsByCell): boolean {
  if (isJackCard(cardId)) return false;

  const cells = BASE_CARD_TO_CELLS[toMapKey(cardId)];
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
 * 잭 카드는 별도 처리 필요 — 여기서는 일반/코너 카드 전용
 */
export function getPlayableCells(cardId: CardId, chipsByCell: ChipsByCell): number[] {
  if (isJackCard(cardId)) return [];

  const cells = BASE_CARD_TO_CELLS[toMapKey(cardId)] ?? [];
  return cells.filter((cellId) => chipsByCell[String(cellId)] === undefined);
}
