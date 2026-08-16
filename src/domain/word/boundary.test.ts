import { clampBoundaryTime, isBoundaryFlush } from "@/domain/word/boundary";
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

describe("clampBoundaryTime", () => {
  const trio: WordTiming[] = [w("a", 0, 1), w("b", 1, 2), w("c", 2, 3)];

  function clamp(overrides: Partial<Parameters<typeof clampBoundaryTime>[0]>): number {
    return clampBoundaryTime({
      words: trio,
      wordIndex: 1,
      edge: "begin",
      time: 1.5,
      minDuration: 0.05,
      rollNeighbour: false,
      ...overrides,
    });
  }

  it("returns the requested time when nothing constrains it", () => {
    expect(clamp({ time: 1.5 })).toBe(1.5);
    expect(clamp({ edge: "end", time: 1.5 })).toBe(1.5);
  });

  it("stops a begin edge at the previous word's end when not rolling", () => {
    expect(clamp({ time: 0.5 })).toBe(1);
  });

  it("lets a begin edge pass the previous word's end when rolling", () => {
    expect(clamp({ time: 0.5, rollNeighbour: true })).toBe(0.5);
  });

  it("stops an end edge at the next word's begin when not rolling", () => {
    expect(clamp({ edge: "end", time: 2.5 })).toBe(2);
  });

  it("lets an end edge pass the next word's begin when rolling", () => {
    expect(clamp({ edge: "end", time: 2.5, rollNeighbour: true })).toBe(2.5);
  });

  it("keeps the target word at least minDuration long", () => {
    expect(clamp({ time: 5 })).toBeCloseTo(1.95, 10);
    expect(clamp({ edge: "end", time: 0 })).toBeCloseTo(1.05, 10);
  });

  it("keeps the rolled neighbour at least minDuration long", () => {
    expect(clamp({ time: -5, rollNeighbour: true })).toBeCloseTo(0.05, 10);
    expect(clamp({ edge: "end", time: 99, rollNeighbour: true })).toBeCloseTo(2.95, 10);
  });

  it("caps an end edge at the audio duration", () => {
    expect(clamp({ wordIndex: 2, edge: "end", time: 99, duration: 5 })).toBe(5);
  });

  it("prefers the next word's begin over a later audio duration", () => {
    expect(clamp({ edge: "end", time: 99, duration: 5 })).toBe(2);
  });

  it("leaves an end edge unbounded when no duration is supplied", () => {
    expect(clamp({ wordIndex: 2, edge: "end", time: 99 })).toBe(99);
  });

  describe("edge cases", () => {
    it("floors the first word's begin at zero", () => {
      expect(clamp({ wordIndex: 0, time: -5 })).toBe(0);
      expect(clamp({ wordIndex: 0, time: -5, rollNeighbour: true })).toBe(0);
    });

    it("returns the requested time when the word does not exist", () => {
      expect(clamp({ words: [], wordIndex: 0, time: 7 })).toBe(7);
      expect(clamp({ wordIndex: 99, time: 7 })).toBe(7);
    });

    it("treats a zero minDuration as no floor of its own", () => {
      expect(clamp({ time: 99, minDuration: 0 })).toBe(2);
      expect(clamp({ edge: "end", time: -99, minDuration: 0 })).toBe(1);
    });
  });

  describe("regressions", () => {
    it("regression: never inverts a word when a flush pair is shorter than twice minDuration", () => {
      const tight: WordTiming[] = [w("a", 0.99, 1), w("b", 1, 1.02)];
      const rolledBack = clamp({ words: tight, wordIndex: 1, time: 0.95, minDuration: 0.5, rollNeighbour: true });
      expect(rolledBack).toBeLessThanOrEqual(tight[1].end);
      expect(rolledBack).toBeGreaterThanOrEqual(tight[0].begin);
      const rolledOn = clamp({
        words: tight,
        wordIndex: 0,
        edge: "end",
        time: 0.95,
        minDuration: 0.5,
        rollNeighbour: true,
      });
      expect(rolledOn).toBeGreaterThanOrEqual(tight[0].begin);
      expect(rolledOn).toBeLessThanOrEqual(tight[1].end);
    });

    it("regression: never inverts the last word when the audio ends before it begins", () => {
      const late: WordTiming[] = [w("a", 0, 1), w("b", 1, 2)];
      expect(clamp({ words: late, wordIndex: 1, edge: "end", time: 1.7, duration: 0.5 })).toBe(1);
    });

    it("regression: never inverts a word whose predecessor ends after it does", () => {
      const overlapping: WordTiming[] = [w("a", 1, 3), w("b", 2, 2.5)];
      expect(clamp({ words: overlapping, wordIndex: 1, time: 2.3 })).toBe(2.5);
    });
  });

  describe("invariants", () => {
    it("never returns a begin past the word's own end, nor an end before its own begin", () => {
      const awkward: WordTiming[] = [w("a", 1, 3), w("b", 2, 2.2), w("c", 2.1, 2.15)];
      for (const time of [-9, 0, 2.1, 5, 99]) {
        for (const rollNeighbour of [false, true]) {
          for (const minDuration of [0, 0.05, 0.5]) {
            for (let i = 0; i < awkward.length; i++) {
              const begin = clamp({ words: awkward, wordIndex: i, edge: "begin", time, minDuration, rollNeighbour });
              expect(begin).toBeLessThanOrEqual(awkward[i].end);
              const end = clamp({ words: awkward, wordIndex: i, edge: "end", time, minDuration, rollNeighbour });
              expect(end).toBeGreaterThanOrEqual(awkward[i].begin);
            }
          }
        }
      }
    });

    it("does not modify its input", () => {
      const words = [w("a", 0, 1), w("b", 1, 2)];
      const snapshot = structuredClone(words);
      clamp({ words, wordIndex: 1, time: 99, rollNeighbour: true });
      expect(words).toEqual(snapshot);
    });
  });
});
