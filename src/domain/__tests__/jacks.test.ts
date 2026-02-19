import { describe, it, expect } from "vitest";
import { isJack, isTwoEyedJack, isOneEyedJack, getJackType } from "../rules/jacks";

describe("isJack", () => {
  it("clover_j_1 은 잭이다", () => {
    expect(isJack("clover_j_1")).toBe(true);
  });

  it("spade_j_2 는 잭이다", () => {
    expect(isJack("spade_j_2")).toBe(true);
  });

  it("일반 카드(spade_2_1)는 잭이 아니다", () => {
    expect(isJack("spade_2_1")).toBe(false);
  });

  it("퀸 카드(heart_q_1)는 잭이 아니다", () => {
    expect(isJack("heart_q_1")).toBe(false);
  });
});

describe("isTwoEyedJack", () => {
  it("clover_j_2 는 two-eyed jack이다", () => {
    expect(isTwoEyedJack("clover_j_2")).toBe(true);
  });

  it("diamond_j_2 는 two-eyed jack이다", () => {
    expect(isTwoEyedJack("diamond_j_2")).toBe(true);
  });

  it("heart_j_2 는 two-eyed jack이다", () => {
    expect(isTwoEyedJack("heart_j_2")).toBe(true);
  });

  it("spade_j_2 는 two-eyed jack이다", () => {
    expect(isTwoEyedJack("spade_j_2")).toBe(true);
  });

  it("clover_j_1 은 two-eyed jack이 아니다", () => {
    expect(isTwoEyedJack("clover_j_1")).toBe(false);
  });

  it("heart_j_1 은 two-eyed jack이 아니다", () => {
    expect(isTwoEyedJack("heart_j_1")).toBe(false);
  });
});

describe("isOneEyedJack", () => {
  it("clover_j_1 은 one-eyed jack이다", () => {
    expect(isOneEyedJack("clover_j_1")).toBe(true);
  });

  it("diamond_j_1 은 one-eyed jack이다", () => {
    expect(isOneEyedJack("diamond_j_1")).toBe(true);
  });

  it("heart_j_1 은 one-eyed jack이다", () => {
    expect(isOneEyedJack("heart_j_1")).toBe(true);
  });

  it("spade_j_1 은 one-eyed jack이다", () => {
    expect(isOneEyedJack("spade_j_1")).toBe(true);
  });

  it("clover_j_2 는 one-eyed jack이 아니다", () => {
    expect(isOneEyedJack("clover_j_2")).toBe(false);
  });

  it("heart_j_2 는 one-eyed jack이 아니다", () => {
    expect(isOneEyedJack("heart_j_2")).toBe(false);
  });
});

describe("getJackType", () => {
  it("clover_j_2 → 'two-eye'", () => {
    expect(getJackType("clover_j_2")).toBe("two-eye");
  });

  it("heart_j_2 → 'two-eye'", () => {
    expect(getJackType("heart_j_2")).toBe("two-eye");
  });

  it("clover_j_1 → 'one-eye'", () => {
    expect(getJackType("clover_j_1")).toBe("one-eye");
  });

  it("heart_j_1 → 'one-eye'", () => {
    expect(getJackType("heart_j_1")).toBe("one-eye");
  });

  it("일반 카드는 null을 반환한다", () => {
    expect(getJackType("spade_2_1")).toBeNull();
    expect(getJackType("heart_k_2")).toBeNull();
  });
});
