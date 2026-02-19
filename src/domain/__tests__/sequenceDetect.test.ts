import { describe, it, expect } from "vitest";
import { detectNewSequences, countSequencesByTeam } from "../rules/sequenceDetect";
import type { ChipsByCell, CompletedSequence } from "../types";

/** 10x10 보드의 cellId 계산 헬퍼 */
function cell(row: number, col: number): number {
  return row * 10 + col;
}

/** 지정 row 전체에 팀 칩 배치 */
function fillRow(row: number, cols: number[], teamId: "A" | "B"): ChipsByCell {
  const chips: ChipsByCell = {};
  for (const col of cols) {
    chips[String(cell(row, col))] = teamId;
  }
  return chips;
}

describe("detectNewSequences — 가로(horizontal)", () => {
  it("row 0에 팀 A 칩 5개 연속 → 시퀀스 탐지", () => {
    const chips = fillRow(0, [0, 1, 2, 3, 4], "A");
    const result = detectNewSequences(chips, []);
    expect(result).toHaveLength(1);
    expect(result[0].teamId).toBe("A");
    expect(result[0].cells.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });

  it("row 2, col 3~7에 팀 B 칩 5개 연속 → 시퀀스 탐지", () => {
    const chips = fillRow(2, [3, 4, 5, 6, 7], "B");
    const result = detectNewSequences(chips, []);
    expect(result).toHaveLength(1);
    expect(result[0].teamId).toBe("B");
    expect(result[0].cells.sort((a, b) => a - b)).toEqual([23, 24, 25, 26, 27]);
  });

  it("4개 연속은 시퀀스가 아니다", () => {
    const chips = fillRow(0, [0, 1, 2, 3], "A");
    const result = detectNewSequences(chips, []);
    expect(result).toHaveLength(0);
  });
});

describe("detectNewSequences — 세로(vertical)", () => {
  it("col 5에 팀 A 칩 5개 연속 → 시퀀스 탐지", () => {
    const chips: ChipsByCell = {};
    for (let row = 0; row < 5; row++) {
      chips[String(cell(row, 5))] = "A";
    }
    const result = detectNewSequences(chips, []);
    expect(result).toHaveLength(1);
    expect(result[0].cells.sort((a, b) => a - b)).toEqual([5, 15, 25, 35, 45]);
  });
});

describe("detectNewSequences — 대각선(diagonal)", () => {
  it("↘ 방향 5개 연속 → 시퀀스 탐지", () => {
    const chips: ChipsByCell = {};
    // (0,0), (1,1), (2,2), (3,3), (4,4)
    for (let i = 0; i < 5; i++) {
      chips[String(cell(i, i))] = "A";
    }
    const result = detectNewSequences(chips, []);
    expect(result).toHaveLength(1);
    expect(result[0].cells.sort((a, b) => a - b)).toEqual([0, 11, 22, 33, 44]);
  });

  it("↙ 방향 5개 연속 → 시퀀스 탐지", () => {
    const chips: ChipsByCell = {};
    // (0,4), (1,3), (2,2), (3,1), (4,0)
    for (let i = 0; i < 5; i++) {
      chips[String(cell(i, 4 - i))] = "B";
    }
    const result = detectNewSequences(chips, []);
    expect(result).toHaveLength(1);
    expect(result[0].teamId).toBe("B");
    expect(result[0].cells.sort((a, b) => a - b)).toEqual([4, 13, 22, 31, 40]);
  });
});

describe("detectNewSequences — 중복/기존 시퀀스 처리", () => {
  it("이미 completedSequences에 있는 시퀀스는 재탐지하지 않는다", () => {
    const chips = fillRow(0, [0, 1, 2, 3, 4], "A");
    const completed: CompletedSequence[] = [
      { teamId: "A", cells: [0, 1, 2, 3, 4], createdTurn: 1 },
    ];
    const result = detectNewSequences(chips, completed);
    expect(result).toHaveLength(0);
  });

  it("기존 시퀀스와 1칸 공유 시 새 시퀀스 허용(2시퀀스 중복 규칙)", () => {
    // 기존 시퀀스: row 0, cols 0~4 (cell 0,1,2,3,4)
    // 새 시퀀스:  col 2, rows 0~4 (cell 2,12,22,32,42) → cell 2 공유(1칸)
    const chips: ChipsByCell = {};
    // row 0, cols 0~4
    for (let col = 0; col <= 4; col++) chips[String(col)] = "A";
    // col 2, rows 0~4
    for (let row = 0; row <= 4; row++) chips[String(cell(row, 2))] = "A";

    const completed: CompletedSequence[] = [
      { teamId: "A", cells: [0, 1, 2, 3, 4], createdTurn: 1 },
    ];
    const result = detectNewSequences(chips, completed);
    const vertSeq = result.find((s) => s.cells.includes(cell(1, 2)));
    expect(vertSeq).toBeDefined();
    expect(vertSeq?.cells.sort((a, b) => a - b)).toEqual([2, 12, 22, 32, 42]);
  });

  it("기존 시퀀스와 2칸 이상 겹치면 새 시퀀스 거부", () => {
    // 기존: cells [0,1,2,3,4], 신규 후보: [1,2,3,4,5] → 4칸 겹침
    const chips = fillRow(0, [0, 1, 2, 3, 4, 5], "A");
    const completed: CompletedSequence[] = [
      { teamId: "A", cells: [0, 1, 2, 3, 4], createdTurn: 1 },
    ];
    const result = detectNewSequences(chips, completed);
    // [1,2,3,4,5]는 기존과 4칸 겹침 → 거부
    const rejected = result.find((s) =>
      s.cells.sort((a, b) => a - b).join(",") === "1,2,3,4,5",
    );
    expect(rejected).toBeUndefined();
  });
});

describe("detectNewSequences — 코너 칸 포함 시퀀스", () => {
  it("코너(cell 0)를 포함한 가로 시퀀스 탐지", () => {
    // row 0의 첫 5칸: cells 0,1,2,3,4 (cell 0은 코너)
    const chips = fillRow(0, [0, 1, 2, 3, 4], "A");
    const result = detectNewSequences(chips, []);
    expect(result).toHaveLength(1);
    expect(result[0].cells).toContain(0);
  });

  it("팀이 섞인 5칸 연속은 시퀀스가 아니다", () => {
    const chips: ChipsByCell = {
      "0": "A",
      "1": "A",
      "2": "B", // 다른 팀
      "3": "A",
      "4": "A",
    };
    const result = detectNewSequences(chips, []);
    expect(result).toHaveLength(0);
  });
});

describe("countSequencesByTeam", () => {
  it("팀별 시퀀스 수를 정확히 집계한다", () => {
    const completed: CompletedSequence[] = [
      { teamId: "A", cells: [0, 1, 2, 3, 4], createdTurn: 1 },
      { teamId: "B", cells: [5, 15, 25, 35, 45], createdTurn: 2 },
      { teamId: "A", cells: [10, 11, 12, 13, 14], createdTurn: 3 },
    ];
    expect(countSequencesByTeam(completed, "A")).toBe(2);
    expect(countSequencesByTeam(completed, "B")).toBe(1);
  });
});
