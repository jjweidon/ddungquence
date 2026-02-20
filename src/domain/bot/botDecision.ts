/**
 * 봇 의사결정 알고리즘 (Pure Function)
 *
 * docs/20-bots.md §2 우선순위 구현:
 * 1. 승리(2nd 시퀀스 완성) — 일반카드 or Two-eyed Jack
 * 2. 위기 방어(상대 1시퀀스 + 4개라인 차단) — One-eyed Jack
 * 3. 첫 시퀀스 완성(일반카드)
 * 4. 첫 시퀀스 완성(Two-eyed Jack)
 * 5. 상대 4개라인 선제 차단(0시퀀스) — One-eyed Jack
 * 6. 4개짜리 라인 형성 — 일반카드
 * 7. 3개짜리 라인 형성 — 일반카드
 * 8. 2개짜리 라인 형성 — 일반카드
 * 9. 폴백: 보드 중앙 근처
 */

import type { TeamId, ChipsByCell, CompletedSequence } from "../types";
import { detectNewSequences } from "../rules/sequenceDetect";
import { isDeadCard, getPlayableCells } from "../rules/deadCard";
import { isTwoEyedJack, isOneEyedJack } from "../rules/jacks";
const BOARD_SIZE = 10;
const BOARD_CENTER_ROW = 4.5;
const BOARD_CENTER_COL = 4.5;

/** docs/20-bots.md §3 라인 정의: 5칸 윈도우 내 같은 팀 칩 수 */
const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function cellRow(cellId: number): number {
  return Math.floor(cellId / BOARD_SIZE);
}

function cellCol(cellId: number): number {
  return cellId % BOARD_SIZE;
}

function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function toCell(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

/**
 * 특정 셀에 botTeamId 칩을 놓았을 때의 최대 라인 길이(5칸 윈도우 기준).
 * 6목(6개 이상 연속) 윈도우는 제외한다.
 * docs/20-bots.md §3 "6목(6개 이상 연속)은 라인으로 인정하지 않는다" 적용.
 */
function scoreLineAfterPlace(
  cellId: number,
  teamId: TeamId,
  chipsByCell: ChipsByCell,
): number {
  const newChips: ChipsByCell = { ...chipsByCell, [String(cellId)]: teamId };
  const row = cellRow(cellId);
  const col = cellCol(cellId);
  let maxLine = 1;

  for (const [dr, dc] of DIRECTIONS) {
    // 이 방향에서 cellId를 포함하는 5칸 윈도우 시작점 범위
    for (let k = 0; k < 5; k++) {
      const startRow = row - dr * k;
      const startCol = col - dc * k;
      if (!isInBounds(startRow, startCol)) continue;
      if (!isInBounds(startRow + dr * 4, startCol + dc * 4)) continue;

      // 5칸 윈도우의 칩 수 계산
      let count = 0;
      let allSameTeam = true;
      for (let i = 0; i < 5; i++) {
        const chip = newChips[String(toCell(startRow + dr * i, startCol + dc * i))];
        if (chip === teamId) {
          count++;
        } else if (chip !== undefined) {
          allSameTeam = false;
          break;
        }
      }
      if (!allSameTeam) continue;

      // 6목 체크: 윈도우 앞뒤에 같은 팀 칩이 있으면 제외
      const prevRow = startRow - dr;
      const prevCol = startCol - dc;
      const hasPrev =
        isInBounds(prevRow, prevCol) &&
        newChips[String(toCell(prevRow, prevCol))] === teamId;

      const nextRow = startRow + dr * 5;
      const nextCol = startCol + dc * 5;
      const hasNext =
        isInBounds(nextRow, nextCol) &&
        newChips[String(toCell(nextRow, nextCol))] === teamId;

      if (!hasPrev && !hasNext) {
        maxLine = Math.max(maxLine, count);
      }
    }
  }

  return maxLine;
}

/**
 * 특정 셀의 칩을 제거했을 때 해당 팀의 최대 라인 길이.
 * 1-eye Jack으로 상대 칩을 제거할 때 효과 평가용.
 */
function maxEnemyLineAt(
  cellId: number,
  enemyTeamId: TeamId,
  chipsByCell: ChipsByCell,
): number {
  const row = cellRow(cellId);
  const col = cellCol(cellId);
  let maxLine = 0;

  for (const [dr, dc] of DIRECTIONS) {
    for (let k = 0; k < 5; k++) {
      const startRow = row - dr * k;
      const startCol = col - dc * k;
      if (!isInBounds(startRow, startCol)) continue;
      if (!isInBounds(startRow + dr * 4, startCol + dc * 4)) continue;

      let count = 0;
      let valid = true;
      for (let i = 0; i < 5; i++) {
        const c = toCell(startRow + dr * i, startCol + dc * i);
        const chip = chipsByCell[String(c)];
        if (chip === enemyTeamId) {
          count++;
        } else if (chip !== undefined) {
          valid = false;
          break;
        }
      }
      if (valid) maxLine = Math.max(maxLine, count);
    }
  }

  return maxLine;
}

/** 보드 중앙까지의 거리(작을수록 중앙에 가깝다) */
function distanceToCenter(cellId: number): number {
  const row = cellRow(cellId);
  const col = cellCol(cellId);
  const dr = row - BOARD_CENTER_ROW;
  const dc = col - BOARD_CENTER_COL;
  return dr * dr + dc * dc;
}

/** 1-eye jack으로 제거 가능한 적 셀 목록 */
function getRemovableCells(
  enemyTeamId: TeamId,
  chipsByCell: ChipsByCell,
  completedSequences: CompletedSequence[],
  twoEyeLockedCell: number | null | undefined,
): number[] {
  const sequenceCells = new Set(completedSequences.flatMap((s) => s.cells));
  const removable: number[] = [];
  for (let cellId = 0; cellId < 100; cellId++) {
    const chip = chipsByCell[String(cellId)];
    if (chip !== enemyTeamId) continue;
    if (sequenceCells.has(cellId)) continue;
    if (twoEyeLockedCell != null && twoEyeLockedCell === cellId) continue;
    removable.push(cellId);
  }
  return removable;
}

/** 2-eye jack으로 배치 가능한 빈 셀 목록 */
function getWildCells(
  chipsByCell: ChipsByCell,
  oneEyeLockedCell: number | null | undefined,
): number[] {
  const cells: number[] = [];
  for (let cellId = 0; cellId < 100; cellId++) {
    if (chipsByCell[String(cellId)]) continue;
    // 잭은 코너에도 놓을 수 있음 (보드에 잭 카드 위치는 없지만 2-eye는 어디든 배치 가능)
    if (oneEyeLockedCell != null && oneEyeLockedCell === cellId) continue;
    cells.push(cellId);
  }
  return cells;
}

/** 일반 카드로 놓을 수 있는 (cardId, cellId) 쌍 목록 */
function getNormalPlayOptions(
  hand: string[],
  chipsByCell: ChipsByCell,
): Array<{ cardId: string; cellId: number }> {
  const options: Array<{ cardId: string; cellId: number }> = [];
  for (const cardId of hand) {
    if (isTwoEyedJack(cardId) || isOneEyedJack(cardId)) continue;
    if (isDeadCard(cardId, chipsByCell)) continue;
    const cells = getPlayableCells(cardId, chipsByCell);
    for (const cellId of cells) {
      options.push({ cardId, cellId });
    }
  }
  return options;
}

export interface BotDecisionInput {
  chipsByCell: ChipsByCell;
  completedSequences: CompletedSequence[];
  botTeamId: TeamId;
  hand: string[];
  oneEyeLockedCell?: number | null;
  twoEyeLockedCell?: number | null;
  scoreByTeam: Record<string, number>;
  expectedVersion: number;
}

export type BotGameAction =
  | { type: "TURN_PLAY_NORMAL"; expectedVersion: number; cardId: string; targetCellId: number }
  | { type: "TURN_PLAY_JACK_WILD"; expectedVersion: number; cardId: string; targetCellId: number }
  | { type: "TURN_PLAY_JACK_REMOVE"; expectedVersion: number; cardId: string; removeCellId: number }
  | { type: "TURN_PASS"; expectedVersion: number };

/**
 * 봇의 최적 액션을 결정한다.
 * docs/20-bots.md §2 우선순위 순서대로 평가하여 첫 번째 만족 항목을 반환한다.
 */
export function decideBotAction(input: BotDecisionInput): BotGameAction {
  const {
    chipsByCell,
    completedSequences,
    botTeamId,
    hand,
    oneEyeLockedCell,
    twoEyeLockedCell,
    scoreByTeam,
    expectedVersion,
  } = input;

  const enemyTeamId: TeamId = botTeamId === "A" ? "B" : "A";
  const mySeqCount = scoreByTeam[botTeamId] ?? 0;
  const enemySeqCount = scoreByTeam[enemyTeamId] ?? 0;

  const normalOptions = getNormalPlayOptions(hand, chipsByCell);
  const twoEyeCards = hand.filter((c) => isTwoEyedJack(c));
  const oneEyeCards = hand.filter((c) => isOneEyedJack(c));
  const wildCells = getWildCells(chipsByCell, oneEyeLockedCell);
  const removableCells = getRemovableCells(
    enemyTeamId,
    chipsByCell,
    completedSequences,
    twoEyeLockedCell,
  );

  // ── 우선순위 1: 승리(2번째 시퀀스 완성) — 일반카드 or 2-eye ──────────────
  if (mySeqCount === 1) {
    // 일반카드로 시퀀스 완성
    for (const { cardId, cellId } of normalOptions) {
      const newChips: ChipsByCell = { ...chipsByCell, [String(cellId)]: botTeamId };
      const newSeqs = detectNewSequences(newChips, completedSequences);
      if (newSeqs.some((s) => s.teamId === botTeamId)) {
        return { type: "TURN_PLAY_NORMAL", expectedVersion, cardId, targetCellId: cellId };
      }
    }
    // 2-eye jack으로 시퀀스 완성
    if (twoEyeCards.length > 0) {
      for (const cellId of wildCells) {
        const newChips: ChipsByCell = { ...chipsByCell, [String(cellId)]: botTeamId };
        const newSeqs = detectNewSequences(newChips, completedSequences);
        if (newSeqs.some((s) => s.teamId === botTeamId)) {
          return {
            type: "TURN_PLAY_JACK_WILD",
            expectedVersion,
            cardId: twoEyeCards[0],
            targetCellId: cellId,
          };
        }
      }
    }
  }

  // ── 우선순위 2: 위기 방어(상대 1시퀀스 + 4개라인 있을 때 1-eye로 차단) ────
  if (enemySeqCount === 1 && oneEyeCards.length > 0) {
    // 상대가 4개라인을 가진 셀을 1-eye로 제거
    let bestRemoveCell: number | null = null;
    let bestLineScore = 0;
    for (const cellId of removableCells) {
      const lineScore = maxEnemyLineAt(cellId, enemyTeamId, chipsByCell);
      if (lineScore >= 4 && lineScore > bestLineScore) {
        bestLineScore = lineScore;
        bestRemoveCell = cellId;
      }
    }
    if (bestRemoveCell !== null) {
      return {
        type: "TURN_PLAY_JACK_REMOVE",
        expectedVersion,
        cardId: oneEyeCards[0],
        removeCellId: bestRemoveCell,
      };
    }
  }

  // ── 우선순위 3: 첫 시퀀스 완성 — 일반카드 ─────────────────────────────
  if (mySeqCount === 0) {
    for (const { cardId, cellId } of normalOptions) {
      const newChips: ChipsByCell = { ...chipsByCell, [String(cellId)]: botTeamId };
      const newSeqs = detectNewSequences(newChips, completedSequences);
      if (newSeqs.some((s) => s.teamId === botTeamId)) {
        return { type: "TURN_PLAY_NORMAL", expectedVersion, cardId, targetCellId: cellId };
      }
    }
  }

  // ── 우선순위 4: 첫 시퀀스 완성 — 2-eye jack ───────────────────────────
  if (mySeqCount === 0 && twoEyeCards.length > 0) {
    for (const cellId of wildCells) {
      const newChips: ChipsByCell = { ...chipsByCell, [String(cellId)]: botTeamId };
      const newSeqs = detectNewSequences(newChips, completedSequences);
      if (newSeqs.some((s) => s.teamId === botTeamId)) {
        return {
          type: "TURN_PLAY_JACK_WILD",
          expectedVersion,
          cardId: twoEyeCards[0],
          targetCellId: cellId,
        };
      }
    }
  }

  // ── 우선순위 5: 상대 0시퀀스인데 4개라인 선제 차단 — 1-eye jack ────────
  if (enemySeqCount === 0 && oneEyeCards.length > 0) {
    let bestRemoveCell: number | null = null;
    let bestLineScore = 0;
    for (const cellId of removableCells) {
      const lineScore = maxEnemyLineAt(cellId, enemyTeamId, chipsByCell);
      if (lineScore >= 4 && lineScore > bestLineScore) {
        bestLineScore = lineScore;
        bestRemoveCell = cellId;
      }
    }
    if (bestRemoveCell !== null) {
      return {
        type: "TURN_PLAY_JACK_REMOVE",
        expectedVersion,
        cardId: oneEyeCards[0],
        removeCellId: bestRemoveCell,
      };
    }
  }

  // ── 우선순위 6~8: N개짜리 라인 형성(일반카드, N=4→3→2 순) ───────────────
  for (const targetLineLen of [4, 3, 2]) {
    let bestOption: { cardId: string; cellId: number } | null = null;
    let bestDist = Infinity;

    for (const { cardId, cellId } of normalOptions) {
      const lineScore = scoreLineAfterPlace(cellId, botTeamId, chipsByCell);
      if (lineScore >= targetLineLen) {
        const dist = distanceToCenter(cellId);
        if (dist < bestDist) {
          bestDist = dist;
          bestOption = { cardId, cellId };
        }
      }
    }
    if (bestOption !== null) {
      return {
        type: "TURN_PLAY_NORMAL",
        expectedVersion,
        cardId: bestOption.cardId,
        targetCellId: bestOption.cellId,
      };
    }
  }

  // ── 우선순위 9: 폴백 — 보드 중앙에 가까운 일반카드 위치 ────────────────
  if (normalOptions.length > 0) {
    const sorted = [...normalOptions].sort(
      (a, b) => distanceToCenter(a.cellId) - distanceToCenter(b.cellId),
    );
    const best = sorted[0];
    return {
      type: "TURN_PLAY_NORMAL",
      expectedVersion,
      cardId: best.cardId,
      targetCellId: best.cellId,
    };
  }

  // 모든 카드가 데드카드이고 잭도 없는 경우
  return { type: "TURN_PASS", expectedVersion };
}

/** 봇 이름 생성: 방 내 기존 봇 목록을 받아 다음 이름 결정 */
export function nextBotName(existingBotNicknames: string[]): string {
  for (let i = 1; i <= 10; i++) {
    const name = `뚱${i}`;
    if (!existingBotNicknames.includes(name)) return name;
  }
  return `뚱${existingBotNicknames.length + 1}`;
}

/** 봇 uid 생성 */
export function makeBotUid(nickname: string): string {
  return `bot_${nickname}`;
}

