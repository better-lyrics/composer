import { describe, expect, it } from "vitest";
import type { WordTiming } from "@/domain/word/timing";
import { wordsOverlap } from "@/domain/word/overlap";

const w = (begin: number, end: number, text = "x"): WordTiming => ({ text, begin, end });

describe("wordsOverlap", () => {
  describe("happy paths", () => {
    it("returns true for fully overlapping ranges", () => {
      expect(wordsOverlap(w(0, 1), w(0.3, 0.7))).toBe(true);
    });
    it("returns true for partial overlap from the left", () => {
      expect(wordsOverlap(w(0, 1), w(0.5, 1.5))).toBe(true);
    });
    it("returns true for partial overlap from the right", () => {
      expect(wordsOverlap(w(0.5, 1.5), w(0, 1))).toBe(true);
    });
    it("returns false for disjoint ranges with a gap", () => {
      expect(wordsOverlap(w(0, 1), w(2, 3))).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("returns false for ranges touching exactly at the boundary (end equals begin)", () => {
      expect(wordsOverlap(w(0, 1), w(1, 2))).toBe(false);
      expect(wordsOverlap(w(1, 2), w(0, 1))).toBe(false);
    });
    it("returns false for a zero-length word at a boundary", () => {
      expect(wordsOverlap(w(0, 1), w(1, 1))).toBe(false);
    });
    it("returns false for two identical zero-length points at the same time", () => {
      expect(wordsOverlap(w(1, 1), w(1, 1))).toBe(false);
    });
    it("returns true for identical ranges", () => {
      expect(wordsOverlap(w(0, 1), w(0, 1))).toBe(true);
    });
    it("returns true when one range fully nests inside another", () => {
      expect(wordsOverlap(w(0, 10), w(3, 4))).toBe(true);
      expect(wordsOverlap(w(3, 4), w(0, 10))).toBe(true);
    });
  });

  describe("invariants", () => {
    it("is symmetric: wordsOverlap(a, b) === wordsOverlap(b, a)", () => {
      const a = w(0.2, 0.8);
      const b = w(0.5, 1.0);
      expect(wordsOverlap(a, b)).toBe(wordsOverlap(b, a));
    });
    it("ignores text field", () => {
      expect(wordsOverlap(w(0, 1, "hello"), w(0.5, 1.5, "world"))).toBe(true);
    });
  });
});
