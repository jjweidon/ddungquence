import type { TeamId, ChipsByCell, CompletedSequence, DetectedSequence } from "../types";

const BOARD_SIZE = 10;
const SEQUENCE_LEN = 5;

/** [dRow, dCol] 방향: →, ↓, ↘, ↙ */
const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function cellId(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

function sortedKey(cells: number[]): string {
  return [...cells].sort((a, b) => a - b).join(",");
}

function isSameSequence(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return sortedKey(a) === sortedKey(b);
}

function overlapCount(a: number[], b: number[]): number {
  const setA = new Set(a);
  return b.filter((c) => setA.has(c)).length;
}

function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/**
 * 현재 보드 상태에서 모든 팀의 시퀀스 후보를 탐색한다.
 * 방향 4개(→ ↓ ↘ ↙)를 검사하며, 코너 칸도 일반 칸과 동일하게 취급한다.
 *
 * 6목 정책: 5칸 후보의 시작 직전 또는 끝 직후 칸에 동일 팀 칩이 있으면
 * 해당 후보는 6개 이상 연속의 일부이므로 제외한다.
 */
function findAllCandidates(chipsByCell: ChipsByCell): DetectedSequence[] {
  const candidates: DetectedSequence[] = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      for (const [dr, dc] of DIRECTIONS) {
        const cells: number[] = [];
        let teamId: TeamId | undefined;
        let valid = true;

        for (let k = 0; k < SEQUENCE_LEN; k++) {
          const r = row + dr * k;
          const c = col + dc * k;

          if (!isInBounds(r, c)) {
            valid = false;
            break;
          }

          const cid = cellId(r, c);
          const chip = chipsByCell[String(cid)] as TeamId | undefined;

          if (!chip) {
            valid = false;
            break;
          }

          if (teamId === undefined) {
            teamId = chip;
          } else if (chip !== teamId) {
            valid = false;
            break;
          }

          cells.push(cid);
        }

        if (valid && cells.length === SEQUENCE_LEN && teamId !== undefined) {
          // 6목 체크: 시작 직전 칸에 같은 팀 칩이 있으면 6개 이상 연속 → 제외
          const prevRow = row - dr;
          const prevCol = col - dc;
          const hasPrev =
            isInBounds(prevRow, prevCol) &&
            (chipsByCell[String(cellId(prevRow, prevCol))] as TeamId | undefined) === teamId;

          // 6목 체크: 끝 직후 칸에 같은 팀 칩이 있으면 6개 이상 연속 → 제외
          const nextRow = row + dr * SEQUENCE_LEN;
          const nextCol = col + dc * SEQUENCE_LEN;
          const hasNext =
            isInBounds(nextRow, nextCol) &&
            (chipsByCell[String(cellId(nextRow, nextCol))] as TeamId | undefined) === teamId;

          if (!hasPrev && !hasNext) {
            candidates.push({ teamId, cells: [...cells].sort((a, b) => a - b) });
          }
        }
      }
    }
  }

  return candidates;
}

/**
 * 새로운 시퀀스를 탐지한다.
 *
 * 변형 규칙 고정:
 * - 코너(0, 9, 90, 99)도 칩이 놓인 경우 시퀀스 구성 칸으로 포함
 * - 이미 completedSequences에 존재하는 라인은 무시
 * - 새 시퀀스와 기존 completedSequence가 2칸 이상 겹치면 거부
 *   (2시퀀스 모드: 1칸 공유 허용)
 *
 * @param chipsByCell   현재 보드 칩 점유 맵
 * @param completedSequences  이미 완성된 시퀀스 목록
 * @returns 새로 완성된 시퀀스 목록 (createdTurn은 호출자가 부여)
 */
export function detectNewSequences(
  chipsByCell: ChipsByCell,
  completedSequences: CompletedSequence[],
): DetectedSequence[] {
  const candidates = findAllCandidates(chipsByCell);

  // 중복 제거 (같은 5-cell 조합이 다른 방향에서 탐지될 경우 방지)
  const seen = new Set<string>();
  const unique: DetectedSequence[] = [];
  for (const candidate of candidates) {
    const key = sortedKey(candidate.cells);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(candidate);
    }
  }

  return unique.filter((candidate) => {
    // 이미 completedSequences에 있는 라인 제외
    const alreadyCompleted = completedSequences.some((seq) =>
      isSameSequence(seq.cells, candidate.cells),
    );
    if (alreadyCompleted) return false;

    // 기존 시퀀스와 2칸 이상 겹치면 거부
    const tooMuchOverlap = completedSequences.some(
      (seq) => overlapCount(seq.cells, candidate.cells) >= 2,
    );
    return !tooMuchOverlap;
  });
}

/**
 * 특정 팀의 현재 완성된 시퀀스 수 반환
 */
export function countSequencesByTeam(
  completedSequences: CompletedSequence[],
  teamId: TeamId,
): number {
  return completedSequences.filter((s) => s.teamId === teamId).length;
}
