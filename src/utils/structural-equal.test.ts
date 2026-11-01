import { isStructurallyEqual } from "@/utils/structural-equal";
import { describe, expect, it } from "vitest";

describe("isStructurallyEqual", () => {
  it("compares nested objects and arrays by value", () => {
    expect(isStructurallyEqual({ a: [1, { b: "x" }] }, { a: [1, { b: "x" }] })).toBe(true);
    expect(isStructurallyEqual({ a: [1, { b: "x" }] }, { a: [1, { b: "y" }] })).toBe(false);
  });

  it("ignores key order", () => {
    expect(isStructurallyEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  describe("edge cases", () => {
    it("treats a key set to undefined like a missing key", () => {
      expect(isStructurallyEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    });

    it("tells arrays of different lengths apart", () => {
      expect(isStructurallyEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it("tells an array from an object with the same keys apart", () => {
      expect(isStructurallyEqual(["x"], { 0: "x" })).toBe(false);
    });

    it("compares primitives, null and NaN", () => {
      expect(isStructurallyEqual(null, null)).toBe(true);
      expect(isStructurallyEqual(null, {})).toBe(false);
      expect(isStructurallyEqual(0, "0")).toBe(false);
      expect(isStructurallyEqual(Number.NaN, Number.NaN)).toBe(true);
      expect(isStructurallyEqual("", undefined)).toBe(false);
    });

    it("compares empty containers", () => {
      expect(isStructurallyEqual([], [])).toBe(true);
      expect(isStructurallyEqual({}, {})).toBe(true);
      expect(isStructurallyEqual([], {})).toBe(false);
    });
  });

  describe("invariants", () => {
    it("is symmetric", () => {
      const pairs: [unknown, unknown][] = [
        [{ a: 1 }, { a: 1, b: 2 }],
        [{ a: undefined }, {}],
        [[1], [1]],
      ];
      for (const [left, right] of pairs) {
        expect(isStructurallyEqual(left, right)).toBe(isStructurallyEqual(right, left));
      }
    });
  });
});
