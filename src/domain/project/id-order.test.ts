import { compareIds } from "@/domain/project/id-order";
import { describe, expect, it } from "vitest";

describe("compareIds", () => {
  it("orders ids the same way string comparison does", () => {
    expect(compareIds("a", "b")).toBeLessThan(0);
    expect(compareIds("b", "a")).toBeGreaterThan(0);
    expect(compareIds("a", "a")).toBe(0);
  });

  describe("edge cases", () => {
    it("compares empty strings and mixed lengths", () => {
      expect(compareIds("", "a")).toBeLessThan(0);
      expect(compareIds("a", "")).toBeGreaterThan(0);
      expect(compareIds("", "")).toBe(0);
    });
  });

  describe("invariants", () => {
    it("is antisymmetric", () => {
      expect(Math.sign(compareIds("apple", "banana"))).toBe(-Math.sign(compareIds("banana", "apple")));
    });
  });
});
