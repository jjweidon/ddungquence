import { describe, it, expect } from "vitest";
import { isDeadCard, findDeadCards, getPlayableCells } from "../rules/deadCard";
import type { ChipsByCell } from "../types";

/*
 * 보드 레이아웃 기준 (board-layout.v1.json):
 *   clover_6_1 → cell 10
 *   clover_6_2 → cell 32
 *   clover_7_1 → cell 20
 *   clover_7_2 → cell 42
 *   spade_2_1  → cell 1
 *   spade_2_2  → cell 86
 */

describe("isDeadCard", () => {
  it("두 칸 모두 비어 있으면 데드 카드가 아니다", () => {
    const chips: ChipsByCell = {};
    expect(isDeadCard("clover_7_1", chips)).toBe(false);
  });

  it("한 칸만 점유되어 있으면 데드 카드가 아니다", () => {
    // clover_7_1(cell 20)은 비어 있고, clover_7_2(cell 42)는 점유됨
    const chips: ChipsByCell = { "42": "A" };
    expect(isDeadCard("clover_7_1", chips)).toBe(false);
  });

  it("두 칸 모두 점유되어 있으면 데드 카드다", () => {
    // clover_7: cell 20, cell 42 모두 점유
    const chips: ChipsByCell = { "20": "A", "42": "B" };
    expect(isDeadCard("clover_7_1", chips)).toBe(true);
  });

  it("variant 2 카드도 동일한 두 칸을 참조한다", () => {
    const chips: ChipsByCell = { "20": "A", "42": "B" };
    expect(isDeadCard("clover_7_2", chips)).toBe(true);
  });

  it("잭 카드는 항상 데드 카드가 아니다", () => {
    const chips: ChipsByCell = {};
    expect(isDeadCard("heart_j_1", chips)).toBe(false);
    expect(isDeadCard("clover_j_2", chips)).toBe(false);
  });

  it("코너 카드(o_o_*)는 항상 데드 카드가 아니다", () => {
    const chips: ChipsByCell = { "0": "A", "9": "B", "90": "A", "99": "B" };
    expect(isDeadCard("o_o_1", chips)).toBe(false);
  });

  it("spade_2 두 칸(1, 86) 모두 점유 시 데드", () => {
    const chips: ChipsByCell = { "1": "A", "86": "B" };
    expect(isDeadCard("spade_2_1", chips)).toBe(true);
  });
});

describe("findDeadCards", () => {
  it("손패에서 데드 카드만 골라낸다", () => {
    // clover_6: cell 10, 32 — 둘 다 점유
    // clover_7: cell 20, 42 — cell 42만 점유 (데드 아님)
    const chips: ChipsByCell = { "10": "A", "32": "A", "42": "B" };
    const hand = ["clover_6_1", "clover_7_1", "heart_j_1"];
    const dead = findDeadCards(hand, chips);
    expect(dead).toContain("clover_6_1");
    expect(dead).not.toContain("clover_7_1");
    expect(dead).not.toContain("heart_j_1");
  });
});

describe("getPlayableCells", () => {
  it("두 칸 모두 비어 있으면 둘 다 반환한다", () => {
    const chips: ChipsByCell = {};
    const cells = getPlayableCells("clover_7_1", chips);
    expect(cells).toContain(20);
    expect(cells).toContain(42);
    expect(cells).toHaveLength(2);
  });

  it("한 칸이 점유되면 나머지 한 칸만 반환한다", () => {
    const chips: ChipsByCell = { "20": "A" };
    const cells = getPlayableCells("clover_7_1", chips);
    expect(cells).toEqual([42]);
  });

  it("잭은 getPlayableCells가 빈 배열을 반환한다 (별도 처리 필요)", () => {
    const cells = getPlayableCells("clover_j_1", {});
    expect(cells).toEqual([]);
  });
});
