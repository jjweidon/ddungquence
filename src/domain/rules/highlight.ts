import type { TeamId, ChipsByCell } from "../types";
import type { CompletedSequence } from "../types";
import { isTwoEyedJack, isOneEyedJack } from "./jacks";
import { getPlayableCells } from "./deadCard";

export interface CellHighlight {
  /** 칩을 놓을 수 있는 빈 칸 */
  playable: Set<number>;
  /** One-eyed Jack으로 제거 가능한 상대 칩 칸 */
  removable: Set<number>;
}

/**
 * 선택한 카드 + 현재 보드 상태 기준으로 활성화할 셀을 계산한다.
 *
 * - 일반 카드: 해당 카드에 대응하는 빈 칸
 * - Two-eyed Jack: 모든 빈 칸 (단, oneEyeLockedCell 제외)
 * - One-eyed Jack: 상대 팀 칩이 있는 칸 중 완성된 시퀀스에 포함되지 않은 칸
 * - 데드 카드 / 잭이 아닌 카드 중 놓을 곳 없음: 빈 셋 반환
 */
export function getHighlightForCard(
  cardId: string,
  myTeamId: TeamId,
  chipsByCell: ChipsByCell,
  completedSequences: CompletedSequence[],
  oneEyeLockedCell?: number | null,
): CellHighlight {
  if (isTwoEyedJack(cardId)) {
    const playable = new Set<number>();
    for (let i = 0; i < 100; i++) {
      if (!chipsByCell[String(i)]) {
        playable.add(i);
      }
    }
    if (oneEyeLockedCell !== undefined && oneEyeLockedCell !== null) {
      playable.delete(oneEyeLockedCell);
    }
    return { playable, removable: new Set() };
  }

  if (isOneEyedJack(cardId)) {
    const sequenceCells = new Set<number>(completedSequences.flatMap((s) => s.cells));
    const removable = new Set<number>();
    for (const [cellStr, teamId] of Object.entries(chipsByCell)) {
      const cellId = Number(cellStr);
      if (teamId !== myTeamId && !sequenceCells.has(cellId)) {
        removable.add(cellId);
      }
    }
    return { playable: new Set(), removable };
  }

  // 일반 카드
  const playable = new Set(getPlayableCells(cardId, chipsByCell));
  return { playable, removable: new Set() };
}
