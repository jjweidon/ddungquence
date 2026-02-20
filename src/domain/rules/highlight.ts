import type { TeamId, ChipsByCell } from "../types";
import type { CompletedSequence } from "../types";
import { isTwoEyedJack, isOneEyedJack } from "./jacks";
import { getPlayableCells } from "./deadCard";

export interface CellHighlight {
  /** 칩을 놓을 수 있는 빈 칸 */
  playable: Set<number>;
  /** One-eyed Jack으로 제거 가능한 칩 칸 (상대·자기 팀 모두, 단 완성 시퀀스 제외) */
  removable: Set<number>;
}

/**
 * 선택한 카드 + 현재 보드 상태 기준으로 활성화할 셀을 계산한다.
 *
 * - 일반 카드: 해당 카드에 대응하는 빈 칸
 * - Two-eyed Jack: 모든 빈 칸 (단, oneEyeLockedCell 제외)
 * - One-eyed Jack: 칩이 있는 칸(상대·자기 팀 모두) 중 완성된 시퀀스 제외, twoEyeLockedCell 제외
 * - 데드 카드 / 잭이 아닌 카드 중 놓을 곳 없음: 빈 셋 반환
 */
export function getHighlightForCard(
  cardId: string,
  myTeamId: TeamId,
  chipsByCell: ChipsByCell,
  completedSequences: CompletedSequence[],
  oneEyeLockedCell?: number | null,
  twoEyeLockedCell?: number | null,
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
    for (const [cellStr] of Object.entries(chipsByCell)) {
      const cellId = Number(cellStr);
      if (sequenceCells.has(cellId)) continue;
      // 변형 규칙: Two-eyed로 배치된 칸은 바로 다음 플레이어만 One-eyed로 제거 불가
      if (twoEyeLockedCell !== undefined && twoEyeLockedCell !== null && twoEyeLockedCell === cellId) continue;
      removable.add(cellId);
    }
    return { playable: new Set(), removable };
  }

  // 일반 카드
  const playable = new Set(getPlayableCells(cardId, chipsByCell));
  return { playable, removable: new Set() };
}
