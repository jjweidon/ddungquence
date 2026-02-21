/**
 * 봇 의사결정 알고리즘 (Pure Function)
 *
 * docs/20-bots.md §2 우선순위 구현:
 *  1. 승리(2nd 시퀀스 완성) — 일반카드 or Two-eyed Jack
 *  2. 위기 방어(상대 1시퀀스 + 4개라인 차단) — 일반카드 우선, 불가시 One-eyed Jack (§5-A)
 *  3. 첫 시퀀스 완성 — 일반카드
 *  4. 첫 시퀀스 완성 — Two-eyed Jack
 *  5. 상대 0시퀀스 4개라인 선제 차단 — 일반카드 우선, 불가시 One-eyed Jack (§5-A)
 *  6. 6목 자가 복구 → 시퀀스 완성 — One-eyed Jack(자팀 칩 제거)
 *  7. 복합 수: One-eyed Jack 제거 후 자팀 4개이상 라인 형성 가능 (§5-B)
 *  8. 4개짜리 라인 형성 — 일반카드
 *  9. 3개짜리 라인 형성 — 일반카드
 * 10. 2개짜리 라인 형성 — 일반카드
 * 11. 폴백: 보드 중앙 근처
 *
 * 사전 유효성 검사(§4):
 *  - §4-1: 6목 생성 금지 — 모든 배치 후보에 wouldCreateOvershoot 필터 적용
 *  - §4-2: 직전 플레이어 제한 위반 금지 — locked cell 체크
 */

import type { TeamId, ChipsByCell, CompletedSequence } from "../types";
import { detectNewSequences } from "../rules/sequenceDetect";
import { isDeadCard, getPlayableCells } from "../rules/deadCard";
import { isTwoEyedJack, isOneEyedJack } from "../rules/jacks";

const BOARD_SIZE = 10;
const BOARD_CENTER_ROW = 4.5;
const BOARD_CENTER_COL = 4.5;

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

function distanceToCenter(cellId: number): number {
  const row = cellRow(cellId);
  const col = cellCol(cellId);
  const dr = row - BOARD_CENTER_ROW;
  const dc = col - BOARD_CENTER_COL;
  return dr * dr + dc * dc;
}

// ─────────────────────────────────────────────────────────────
// §4-1: 6목 생성 금지
// ─────────────────────────────────────────────────────────────

/**
 * cellId에 teamId 칩을 놓으면 어떤 방향에서든 6개 이상 연속이 되는지 확인.
 * true이면 해당 배치는 금지(docs/20-bots.md §4-1).
 */
function wouldCreateOvershoot(
  cellId: number,
  teamId: TeamId,
  chipsByCell: ChipsByCell,
): boolean {
  const row = cellRow(cellId);
  const col = cellCol(cellId);

  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;

    for (let k = 1; k < BOARD_SIZE; k++) {
      const r = row + dr * k;
      const c = col + dc * k;
      if (!isInBounds(r, c)) break;
      if (chipsByCell[String(toCell(r, c))] !== teamId) break;
      count++;
    }

    for (let k = 1; k < BOARD_SIZE; k++) {
      const r = row - dr * k;
      const c = col - dc * k;
      if (!isInBounds(r, c)) break;
      if (chipsByCell[String(toCell(r, c))] !== teamId) break;
      count++;
    }

    if (count >= 6) return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────
// 라인 점수 계산
// ─────────────────────────────────────────────────────────────

/**
 * cellId에 teamId 칩을 놓았을 때의 최대 라인 길이(5칸 윈도우 기준).
 * 6목 윈도우는 제외한다(docs/20-bots.md §3).
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
    for (let k = 0; k < 5; k++) {
      const startRow = row - dr * k;
      const startCol = col - dc * k;
      if (!isInBounds(startRow, startCol)) continue;
      if (!isInBounds(startRow + dr * 4, startCol + dc * 4)) continue;

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
 * cellId에 있는 칩을 기준으로 enemyTeamId의 최대 라인 길이.
 * 1-eye Jack 제거 효과 평가에 사용.
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

// ─────────────────────────────────────────────────────────────
// §5-A/§5-B: One-eyed Jack 갈등 해소
// ─────────────────────────────────────────────────────────────

/**
 * 상대 팀 N개짜리 라인의 빈칸(완성 방해 가능 셀) 목록 반환.
 * 일반 카드로 이 셀을 채우면 해당 라인의 완성을 직접 차단할 수 있다(§5-A 일반카드 우선 원칙).
 */
function getEnemyThreatEmptyCells(
  enemyTeamId: TeamId,
  chipsByCell: ChipsByCell,
  minEnemyCount: number,
): Set<number> {
  const threatCells = new Set<number>();

  for (const [dr, dc] of DIRECTIONS) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        let enemyCount = 0;
        const emptyCells: number[] = [];
        let valid = true;

        for (let k = 0; k < 5; k++) {
          const r = row + dr * k;
          const c = col + dc * k;
          if (!isInBounds(r, c)) {
            valid = false;
            break;
          }
          const chip = chipsByCell[String(toCell(r, c))];
          if (chip === enemyTeamId) {
            enemyCount++;
          } else if (chip === undefined) {
            emptyCells.push(toCell(r, c));
          } else {
            valid = false;
            break;
          }
        }

        if (valid && enemyCount >= minEnemyCount) {
          for (const ec of emptyCells) threatCells.add(ec);
        }
      }
    }
  }

  return threatCells;
}

/**
 * §5-B: 적 칩을 제거한 후 그 자리에 손패 일반 카드를 놓을 수 있을 때의 자팀 이득 점수.
 * 5개짜리 완성 → +30, 4개짜리 → +10, 3개짜리 → +3, 이득 없음 → 0
 */
function selfGainScoreAfterRemoval(
  cellId: number,
  botTeamId: TeamId,
  chipsByCell: ChipsByCell,
  hand: string[],
): number {
  const chipsAfterRemoval: ChipsByCell = { ...chipsByCell };
  delete chipsAfterRemoval[String(cellId)];

  const canPlace = hand.some((cardId) => {
    if (isTwoEyedJack(cardId) || isOneEyedJack(cardId)) return false;
    return getPlayableCells(cardId, chipsAfterRemoval).includes(cellId);
  });

  if (!canPlace) return 0;
  if (wouldCreateOvershoot(cellId, botTeamId, chipsAfterRemoval)) return 0;

  const lineLen = scoreLineAfterPlace(cellId, botTeamId, chipsAfterRemoval);
  if (lineLen >= 5) return 30;
  if (lineLen >= 4) return 10;
  if (lineLen >= 3) return 3;
  return 0;
}

/**
 * §5-A: 1-eye Jack으로 적 셀을 제거할 때의 종합 점수.
 * 위협 제거(위협도 × 5) + 자팀 이득(§5-B)의 합산.
 */
function scoreRemoval(
  cellId: number,
  enemyTeamId: TeamId,
  botTeamId: TeamId,
  chipsByCell: ChipsByCell,
  hand: string[],
): number {
  const threatScore = maxEnemyLineAt(cellId, enemyTeamId, chipsByCell);
  const gainScore = selfGainScoreAfterRemoval(cellId, botTeamId, chipsByCell, hand);
  return threatScore * 5 + gainScore;
}

// ─────────────────────────────────────────────────────────────
// 우선순위 6: 6목 자가 복구
// ─────────────────────────────────────────────────────────────

/**
 * 자팀 6목 구간의 끝 칩을 1-eye Jack으로 제거하면 유효 시퀀스가 완성되는 셀 반환.
 * 존재하지 않으면 null(docs/20-bots.md §2 우선순위 6, §5-C).
 */
function findSixOvershootRepairCell(
  botTeamId: TeamId,
  chipsByCell: ChipsByCell,
  completedSequences: CompletedSequence[],
  twoEyeLockedCell: number | null | undefined,
): number | null {
  const seqCells = new Set(completedSequences.flatMap((s) => s.cells));

  for (const [dr, dc] of DIRECTIONS) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const prevRow = row - dr;
        const prevCol = col - dc;
        if (
          isInBounds(prevRow, prevCol) &&
          chipsByCell[String(toCell(prevRow, prevCol))] === botTeamId
        ) {
          continue;
        }

        if (chipsByCell[String(toCell(row, col))] !== botTeamId) continue;

        let runLen = 0;
        while (true) {
          const r = row + dr * runLen;
          const c = col + dc * runLen;
          if (!isInBounds(r, c)) break;
          if (chipsByCell[String(toCell(r, c))] !== botTeamId) break;
          runLen++;
        }

        if (runLen < 6) continue;

        const endCells = [
          toCell(row, col),
          toCell(row + dr * (runLen - 1), col + dc * (runLen - 1)),
        ];
        for (const endCell of endCells) {
          if (seqCells.has(endCell)) continue;
          if (twoEyeLockedCell != null && twoEyeLockedCell === endCell) continue;

          const chipsAfterRemoval: ChipsByCell = { ...chipsByCell };
          delete chipsAfterRemoval[String(endCell)];

          const newSeqs = detectNewSequences(chipsAfterRemoval, completedSequences);
          if (newSeqs.some((s) => s.teamId === botTeamId)) {
            return endCell;
          }
        }
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// 후보 목록 생성 헬퍼
// ─────────────────────────────────────────────────────────────

/** 1-eye jack으로 제거 가능한 적 셀 목록(완성 시퀀스 및 locked cell 제외) */
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

/** 2-eye jack으로 배치 가능한 빈 셀 목록(locked cell 제외) */
function getWildCells(
  chipsByCell: ChipsByCell,
  oneEyeLockedCell: number | null | undefined,
): number[] {
  const cells: number[] = [];
  for (let cellId = 0; cellId < 100; cellId++) {
    if (chipsByCell[String(cellId)]) continue;
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

// ─────────────────────────────────────────────────────────────
// 공개 인터페이스
// ─────────────────────────────────────────────────────────────

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

  // §4-1: 6목 생성 금지 사전 필터 — normalOptions/wildCells에 적용
  const normalOptions = getNormalPlayOptions(hand, chipsByCell).filter(
    ({ cellId }) => !wouldCreateOvershoot(cellId, botTeamId, chipsByCell),
  );

  const twoEyeCards = hand.filter((c) => isTwoEyedJack(c));
  const oneEyeCards = hand.filter((c) => isOneEyedJack(c));

  const wildCells = getWildCells(chipsByCell, oneEyeLockedCell).filter(
    (cellId) => !wouldCreateOvershoot(cellId, botTeamId, chipsByCell),
  );

  const removableCells = getRemovableCells(
    enemyTeamId,
    chipsByCell,
    completedSequences,
    twoEyeLockedCell,
  );

  // ── 우선순위 1: 승리(2번째 시퀀스 완성) — 일반카드 or 2-eye ──────────────
  if (mySeqCount === 1) {
    for (const { cardId, cellId } of normalOptions) {
      const newChips: ChipsByCell = { ...chipsByCell, [String(cellId)]: botTeamId };
      const newSeqs = detectNewSequences(newChips, completedSequences);
      if (newSeqs.some((s) => s.teamId === botTeamId)) {
        return { type: "TURN_PLAY_NORMAL", expectedVersion, cardId, targetCellId: cellId };
      }
    }
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

  // ── 우선순위 2: 위기 방어(상대 1시퀀스 + 4개라인) ─────────────────────────
  // §5-A: 일반 카드로 차단 가능하면 잭 절약, 불가시 1-eye jack으로 최선 칩 제거
  if (enemySeqCount === 1) {
    const threatCells = getEnemyThreatEmptyCells(enemyTeamId, chipsByCell, 4);

    const blockWithNormal = normalOptions.find(({ cellId }) => threatCells.has(cellId));
    if (blockWithNormal) {
      return {
        type: "TURN_PLAY_NORMAL",
        expectedVersion,
        cardId: blockWithNormal.cardId,
        targetCellId: blockWithNormal.cellId,
      };
    }

    if (oneEyeCards.length > 0) {
      let bestRemoveCell: number | null = null;
      let bestScore = 0;
      for (const cellId of removableCells) {
        const lineScore = maxEnemyLineAt(cellId, enemyTeamId, chipsByCell);
        if (lineScore < 4) continue;
        const score = scoreRemoval(cellId, enemyTeamId, botTeamId, chipsByCell, hand);
        if (score > bestScore) {
          bestScore = score;
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
  }

  // ── 우선순위 3: 첫 시퀀스 완성 — 일반카드 ──────────────────────────────
  if (mySeqCount === 0) {
    for (const { cardId, cellId } of normalOptions) {
      const newChips: ChipsByCell = { ...chipsByCell, [String(cellId)]: botTeamId };
      const newSeqs = detectNewSequences(newChips, completedSequences);
      if (newSeqs.some((s) => s.teamId === botTeamId)) {
        return { type: "TURN_PLAY_NORMAL", expectedVersion, cardId, targetCellId: cellId };
      }
    }
  }

  // ── 우선순위 4: 첫 시퀀스 완성 — 2-eye jack ────────────────────────────
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

  // ── 우선순위 5: 상대 0시퀀스 4개라인 선제 차단 ──────────────────────────
  // §5-A: 일반 카드 우선, 불가시 1-eye jack
  if (enemySeqCount === 0) {
    const threatCells = getEnemyThreatEmptyCells(enemyTeamId, chipsByCell, 4);

    const blockWithNormal = normalOptions.find(({ cellId }) => threatCells.has(cellId));
    if (blockWithNormal) {
      return {
        type: "TURN_PLAY_NORMAL",
        expectedVersion,
        cardId: blockWithNormal.cardId,
        targetCellId: blockWithNormal.cellId,
      };
    }

    if (oneEyeCards.length > 0) {
      let bestRemoveCell: number | null = null;
      let bestScore = 0;
      for (const cellId of removableCells) {
        const lineScore = maxEnemyLineAt(cellId, enemyTeamId, chipsByCell);
        if (lineScore < 4) continue;
        const score = scoreRemoval(cellId, enemyTeamId, botTeamId, chipsByCell, hand);
        if (score > bestScore) {
          bestScore = score;
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
  }

  // ── 우선순위 6: 6목 자가 복구 → 시퀀스 완성(1-eye Jack으로 자팀 칩 제거) ─
  if (oneEyeCards.length > 0) {
    const repairCell = findSixOvershootRepairCell(
      botTeamId,
      chipsByCell,
      completedSequences,
      twoEyeLockedCell,
    );
    if (repairCell !== null) {
      return {
        type: "TURN_PLAY_JACK_REMOVE",
        expectedVersion,
        cardId: oneEyeCards[0],
        removeCellId: repairCell,
      };
    }
  }

  // ── 우선순위 7: 복합 수 — 1-eye 제거 후 자팀 4개이상 라인 가능(§5-B) ─────
  if (oneEyeCards.length > 0) {
    let bestComboCell: number | null = null;
    let bestComboScore = 9; // 4개짜리 이득(+10) 이상이어야 발동

    for (const cellId of removableCells) {
      const gainScore = selfGainScoreAfterRemoval(cellId, botTeamId, chipsByCell, hand);
      if (gainScore < 10) continue;
      const totalScore = scoreRemoval(cellId, enemyTeamId, botTeamId, chipsByCell, hand);
      if (totalScore > bestComboScore) {
        bestComboScore = totalScore;
        bestComboCell = cellId;
      }
    }
    if (bestComboCell !== null) {
      return {
        type: "TURN_PLAY_JACK_REMOVE",
        expectedVersion,
        cardId: oneEyeCards[0],
        removeCellId: bestComboCell,
      };
    }
  }

  // ── 우선순위 8~10: N개짜리 라인 형성(일반카드, N=4→3→2 순) ──────────────
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

  // ── 우선순위 11: 폴백 — 보드 중앙에 가까운 일반카드 위치 ─────────────────
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
