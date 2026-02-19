import { describe, it, expect } from "vitest";
import { createDeck, shuffle, createShuffledDeck } from "../cards/deck";

describe("createDeck", () => {
  it("108장을 생성한다 (104 표준 + 코너 4장)", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(108);
  });

  it("중복 카드가 없다", () => {
    const deck = createDeck();
    const uniqueCards = new Set(deck);
    expect(uniqueCards.size).toBe(108);
  });

  it("코너 카드(o_o_1..4) 4장이 포함된다", () => {
    const deck = createDeck();
    expect(deck).toContain("o_o_1");
    expect(deck).toContain("o_o_2");
    expect(deck).toContain("o_o_3");
    expect(deck).toContain("o_o_4");
  });

  it("4개 수트 × 13 랭크 × 2 변형이 모두 포함된다", () => {
    const deck = createDeck();
    const suits = ["spade", "heart", "diamond", "clover"];
    const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "j", "q", "k", "a"];

    for (const suit of suits) {
      for (const rank of ranks) {
        expect(deck).toContain(`${suit}_${rank}_1`);
        expect(deck).toContain(`${suit}_${rank}_2`);
      }
    }
  });

  it("잭 8장이 포함된다 (four suits × 2 variants)", () => {
    const deck = createDeck();
    const jacks = deck.filter((c) => c.includes("_j_"));
    expect(jacks).toHaveLength(8);
  });
});

describe("shuffle", () => {
  it("셔플 결과도 108장이다", () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    expect(shuffled).toHaveLength(108);
  });

  it("셔플 후 원본과 동일한 카드 집합을 유지한다", () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    expect(new Set(shuffled)).toEqual(new Set(deck));
  });

  it("원본 배열을 변경하지 않는다 (immutable)", () => {
    const deck = createDeck();
    const original = [...deck];
    shuffle(deck);
    expect(deck).toEqual(original);
  });
});

describe("createShuffledDeck", () => {
  it("셔플된 덱도 108장이다", () => {
    const deck = createShuffledDeck();
    expect(deck).toHaveLength(108);
  });
});
