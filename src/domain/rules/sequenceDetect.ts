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

/** 시퀀스가 속한 "라인" 식별: 같은 방향·같은 직선이면 동일한 key */
function getLineKey(cells: number[]): { dir: number; lineId: number } | null {
  if (cells.length !== SEQUENCE_LEN) return null;
  const rows = cells.map((c) => Math.floor(c / BOARD_SIZE));
  const cols = cells.map((c) => c % BOARD_SIZE);
  const dr = rows[1] - rows[0];
  const dc = cols[1] - cols[0];
  if (dr === 0 && dc === 1) return { dir: 0, lineId: rows[0] }; // →
  if (dr === 1 && dc === 0) return { dir: 1, lineId: cols[0] }; // ↓
  if (dr === 1 && dc === 1) return { dir: 2, lineId: rows[0] - cols[0] }; // ↘
  if (dr === 1 && dc === -1) return { dir: 3, lineId: rows[0] + cols[0] }; // ↙
  return null;
}

function sameLine(a: number[], b: number[]): boolean {
  const ka = getLineKey(a);
  const kb = getLineKey(b);
  return ka !== null && kb !== null && ka.dir === kb.dir && ka.lineId === kb.lineId;
}

/** 해당 방향의 라인에서 인접한 칸 간 차이(stride). 연속 run 분할용 */
function getStride(dir: number): number {
  if (dir === 0) return 1;   // →
  if (dir === 1) return 10;  // ↓
  if (dir === 2) return 11;   // ↘
  if (dir === 3) return 9;    // ↙
  return 1;
}

/** 한 라인(dir, lineId)에 속한 모든 cellId 목록(정렬). */
function getLineCellIds(dir: number, lineId: number): number[] {
  const cells: number[] = [];
  if (dir === 0) {
    for (let col = 0; col < BOARD_SIZE; col++) cells.push(cellId(lineId, col));
  } else if (dir === 1) {
    for (let row = 0; row < BOARD_SIZE; row++) cells.push(cellId(row, lineId));
  } else if (dir === 2) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      const c = r - lineId;
      if (c >= 0 && c < BOARD_SIZE) cells.push(cellId(r, c));
    }
  } else {
    for (let r = 0; r < BOARD_SIZE; r++) {
      const c = lineId - r;
      if (c >= 0 && c < BOARD_SIZE) cells.push(cellId(r, c));
    }
  }
  return cells;
}

/**
 * 라인 상에서 해당 팀이 연속으로 채운 구간(run) 목록을 반환.
 * 각 run은 정렬된 cellId 배열. 6·7·8·9목 구간 판정에 사용.
 */
function getRunsOnLine(
  chipsByCell: ChipsByCell,
  teamId: TeamId,
  dir: number,
  lineId: number,
): number[][] {
  const lineCells = getLineCellIds(dir, lineId);
  const filled = lineCells.filter((cid) => chipsByCell[String(cid)] === teamId);
  if (filled.length === 0) return [];
  const stride = getStride(dir);
  const runs: number[][] = [];
  let run: number[] = [filled[0]];
  for (let i = 1; i < filled.length; i++) {
    if (filled[i] - filled[i - 1] === stride) {
      run.push(filled[i]);
    } else {
      runs.push(run);
      run = [filled[i]];
    }
  }
  runs.push(run);
  return runs;
}

/** 후보의 5칸이 run에 완전히 포함되는지 */
function isContainedInRun(candidateCells: number[], run: number[]): boolean {
  const setRun = new Set(run);
  return candidateCells.every((c) => setRun.has(c));
}

/**
 * 현재 보드 상태에서 모든 팀의 시퀀스 후보를 탐색한다.
 * 방향 4개(→ ↓ ↘ ↙)를 검사하며, 6개 이상 연속인 줄도 5칸 윈도우는 후보에 포함한다.
 * (같은 라인 내 겹침 제거는 detectNewSequences에서 처리)
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
          candidates.push({ teamId, cells: [...cells].sort((a, b) => a - b) });
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
 * - 같은 방향(같은 라인): 기존 시퀀스와 칩을 1칸도 공유하면 안 됨. 같은 라인에서는 겹치지 않는 5칸만 추가 인정(예: 10칸 일렬 → [0-4],[5-9] 2시퀀스)
 * - 다른 방향(교차): 기존 시퀀스와 1칸 공유 허용, 2칸 이상 겹치면 거부
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

  const allowed = unique.filter((candidate) => {
    const alreadyCompleted = completedSequences.some((seq) =>
      isSameSequence(seq.cells, candidate.cells),
    );
    if (alreadyCompleted) return false;

    for (const seq of completedSequences) {
      const overlap = overlapCount(seq.cells, candidate.cells);
      if (sameLine(seq.cells, candidate.cells)) {
        if (overlap >= 1) return false;
      } else {
        if (overlap >= 2) return false;
      }
    }
    return true;
  });

  // 같은 라인 내에서 서로 겹치는 후보 제거 + 6·7·8·9목 구간 제외 후, 라인별로 겹치지 않는 집합만 선택
  const byLine = new Map<string, DetectedSequence[]>();
  for (const c of allowed) {
    const k = getLineKey(c.cells);
    if (!k) continue;
    const key = `${c.teamId},${k.dir},${k.lineId}`;
    if (!byLine.has(key)) byLine.set(key, []);
    byLine.get(key)!.push(c);
  }

  const result: DetectedSequence[] = [];
  for (const [lineKey, list] of byLine) {
    const [teamId, dirStr, lineIdStr] = lineKey.split(",");
    const dir = Number(dirStr);
    const lineId = Number(lineIdStr);
    const runs = getRunsOnLine(chipsByCell, teamId as TeamId, dir, lineId);
    const forbiddenRunLengths = new Set([6, 7, 8, 9]);
    const filtered = list.filter((c) => {
      for (const run of runs) {
        if (forbiddenRunLengths.has(run.length) && isContainedInRun(c.cells, run)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => Math.min(...a.cells) - Math.min(...b.cells));
    const taken: DetectedSequence[] = [];
    for (const c of filtered) {
      const overlapsTaken = taken.some((t) => overlapCount(t.cells, c.cells) >= 1);
      if (!overlapsTaken) taken.push(c);
    }
    result.push(...taken);
  }

  return result;
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

// ─── N목 카운트 및 핵심 셀 판정 (플레이어 통계용) ─────────────────

/**
 * 해당 셀이 포함된 라인들 중, 팀이 minRunLength 이상 연속으로 채운 라인 수를 반환.
 * (dir, lineId)별로 1회씩만 카운트. 시퀀스(5목) 완성 시 4목/3목 중복 카운트 방지용으로
 * newSeqs가 비어 있을 때만 호출하는 것이 권장.
 */
export function countLinesWithNInARowAtCell(
  chipsByCell: ChipsByCell,
  teamId: TeamId,
  cellIdVal: number,
  minRunLength: number,
): number {
  const row = Math.floor(cellIdVal / BOARD_SIZE);
  const col = cellIdVal % BOARD_SIZE;
  let count = 0;
  const lineParams: [number, number][] = [
    [0, row],
    [1, col],
    [2, row - col],
    [3, row + col],
  ];
  for (const [dir, lineId] of lineParams) {
    const runs = getRunsOnLine(chipsByCell, teamId, dir, lineId);
    for (const run of runs) {
      if (run.length >= minRunLength && run.includes(cellIdVal)) {
        count++;
        break;
      }
    }
  }
  return count;
}

/**
 * 해당 셀이 해당 팀의 minRunLength 이상 연속 라인에 포함되는지.
 * 1-eye 핵심 제거(상대 3목·4목), 2-eye 핵심 배치(아군 3목·4목) 판정에 사용.
 */
export function isCellPartOfNInARow(
  chipsByCell: ChipsByCell,
  teamId: TeamId,
  cellIdVal: number,
  minRunLength: number,
): boolean {
  return countLinesWithNInARowAtCell(chipsByCell, teamId, cellIdVal, minRunLength) > 0;
}
