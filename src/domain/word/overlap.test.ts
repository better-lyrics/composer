import { describe, expect, it } from "vitest";
import type { Bounds } from "@/domain/word/bounds";
import { boundsOverlap } from "@/domain/word/overlap";

const b = (begin: number, end: number): Bounds => ({ begin, end });

describe("boundsOverlap", () => {
  describe("happy paths", () => {
    it("returns true for fully overlapping ranges", () => {
      expect(boundsOverlap(b(0, 1), b(0.3, 0.7))).toBe(true);
    });
    it("returns true for partial overlap from the left", () => {
      expect(boundsOverlap(b(0, 1), b(0.5, 1.5))).toBe(true);
    });
    it("returns true for partial overlap from the right", () => {
      expect(boundsOverlap(b(0.5, 1.5), b(0, 1))).toBe(true);
    });
    it("returns false for disjoint ranges with a gap", () => {
      expect(boundsOverlap(b(0, 1), b(2, 3))).toBe(false);
    });
    it("returns false for disjoint ranges with a gap (reverse order)", () => {
      expect(boundsOverlap(b(2, 3), b(0, 1))).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("returns false for ranges touching exactly at the boundary (end equals begin)", () => {
      expect(boundsOverlap(b(0, 1), b(1, 2))).toBe(false);
      expect(boundsOverlap(b(1, 2), b(0, 1))).toBe(false);
    });
    it("returns false for a zero-length word at a boundary", () => {
      expect(boundsOverlap(b(0, 1), b(1, 1))).toBe(false);
    });
    it("returns false for two identical zero-length points at the same time", () => {
      expect(boundsOverlap(b(1, 1), b(1, 1))).toBe(false);
    });
    it("returns true for identical ranges", () => {
      expect(boundsOverlap(b(0, 1), b(0, 1))).toBe(true);
    });
    it("returns true when one range fully nests inside another", () => {
      expect(boundsOverlap(b(0, 10), b(3, 4))).toBe(true);
      expect(boundsOverlap(b(3, 4), b(0, 10))).toBe(true);
    });
  });

  describe("invariants", () => {
    it("is symmetric: boundsOverlap(a, b) === boundsOverlap(b, a)", () => {
      const a = b(0.2, 0.8);
      const c = b(0.5, 1.0);
      expect(boundsOverlap(a, c)).toBe(boundsOverlap(c, a));
    });
  });
});
