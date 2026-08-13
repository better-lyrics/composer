import { isBoundaryFlush } from "@/domain/word/boundary";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";

const w = (text: string, begin: number, end: number): WordTiming => ({ text, begin, end });

const conjoined: WordTiming[] = [w("Hel", 0, 0.4), w("lo ", 0.4, 0.9), w("world", 0.9, 1.6)];
const gapped: WordTiming[] = [w("Hel", 0, 0.4), w("lo ", 0.6, 0.9), w("world", 1.2, 1.6)];

describe("isBoundaryFlush", () => {
  it("is flush when the previous word ends exactly where this word begins", () => {
    expect(isBoundaryFlush(conjoined, 1, "begin")).toBe(true);
  });

  it("is flush when the next word begins exactly where this word ends", () => {
    expect(isBoundaryFlush(conjoined, 1, "end")).toBe(true);
  });

  it("is not flush when a gap precedes the word", () => {
    expect(isBoundaryFlush(gapped, 1, "begin")).toBe(false);
  });

  it("is not flush when a gap follows the word", () => {
    expect(isBoundaryFlush(gapped, 1, "end")).toBe(false);
  });

  describe("edge cases", () => {
    it("is false at the start of the array for the begin edge", () => {
      expect(isBoundaryFlush(conjoined, 0, "begin")).toBe(false);
    });

    it("is false at the end of the array for the end edge", () => {
      expect(isBoundaryFlush(conjoined, conjoined.length - 1, "end")).toBe(false);
    });

    it("is false for an empty array", () => {
      expect(isBoundaryFlush([], 0, "begin")).toBe(false);
      expect(isBoundaryFlush([], 0, "end")).toBe(false);
    });

    it("is false for both edges of a single-word array", () => {
      const single = [w("solo", 1, 2)];
      expect(isBoundaryFlush(single, 0, "begin")).toBe(false);
      expect(isBoundaryFlush(single, 0, "end")).toBe(false);
    });

    it("is false for an index past the end of the array", () => {
      expect(isBoundaryFlush(conjoined, 99, "begin")).toBe(false);
      expect(isBoundaryFlush(conjoined, 99, "end")).toBe(false);
    });

    it("is false for a negative index", () => {
      expect(isBoundaryFlush(conjoined, -1, "begin")).toBe(false);
      expect(isBoundaryFlush(conjoined, -1, "end")).toBe(false);
    });

    it("treats an overlap as flush", () => {
      const overlapping = [w("Hel", 0, 0.6), w("lo ", 0.4, 0.9), w("world", 0.7, 1.6)];
      expect(isBoundaryFlush(overlapping, 1, "begin")).toBe(true);
      expect(isBoundaryFlush(overlapping, 1, "end")).toBe(true);
    });

    it("treats a zero-length word touching its neighbour as flush", () => {
      const zeroLength = [w("Hel", 0, 0.4), w("lo ", 0.4, 0.4), w("world", 0.4, 1.6)];
      expect(isBoundaryFlush(zeroLength, 1, "begin")).toBe(true);
      expect(isBoundaryFlush(zeroLength, 1, "end")).toBe(true);
    });
  });

  describe("invariants", () => {
    it("does not modify its input", () => {
      const words = [w("Hel", 0, 0.4), w("lo ", 0.4, 0.9)];
      const snapshot = structuredClone(words);
      isBoundaryFlush(words, 1, "begin");
      isBoundaryFlush(words, 0, "end");
      expect(words).toEqual(snapshot);
    });

    it("agrees on both sides of the same boundary", () => {
      const mixed = [w("a ", 0, 0.4), w("b ", 0.4, 0.9), w("c ", 1.1, 1.5), w("d", 1.5, 2)];
      for (let i = 0; i < mixed.length - 1; i++) {
        expect(isBoundaryFlush(mixed, i, "end")).toBe(isBoundaryFlush(mixed, i + 1, "begin"));
      }
    });
  });
});
