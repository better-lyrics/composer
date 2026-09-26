import { shouldRollNeighbour } from "@/domain/word/boundary";
import type { SyllablePosition } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";

const w = (text: string, begin: number, end: number): WordTiming => ({ text, begin, end });

describe("shouldRollNeighbour", () => {
  const flush: WordTiming[] = [w("a ", 0, 1), w("b ", 1, 2), w("c", 2, 3)];
  const gapped: WordTiming[] = [w("a ", 0, 0.9), w("b ", 1, 1.9), w("c", 2, 3)];
  const PLAIN: SyllablePosition[] = ["none", "none", "none"];
  const SYLLABLES: SyllablePosition[] = ["first", "middle", "last"];

  function roll(overrides: Partial<Parameters<typeof shouldRollNeighbour>[0]> = {}): boolean {
    return shouldRollNeighbour({
      words: flush,
      wordIndex: 1,
      edge: "begin",
      rollingEdit: false,
      syllablePositions: PLAIN,
      ...overrides,
    });
  }

  it("leaves separate words alone when rolling edit is off", () => {
    expect(roll()).toBe(false);
    expect(roll({ edge: "end" })).toBe(false);
  });

  it("rolls separate words when rolling edit is on", () => {
    expect(roll({ rollingEdit: true })).toBe(true);
    expect(roll({ edge: "end", rollingEdit: true })).toBe(true);
  });

  it("rolls a boundary inside a syllable group even when rolling edit is off", () => {
    expect(roll({ syllablePositions: SYLLABLES })).toBe(true);
    expect(roll({ edge: "end", syllablePositions: SYLLABLES })).toBe(true);
  });

  it("rolls a boundary inside a syllable group when rolling edit is on", () => {
    expect(roll({ syllablePositions: SYLLABLES, rollingEdit: true })).toBe(true);
    expect(roll({ edge: "end", syllablePositions: SYLLABLES, rollingEdit: true })).toBe(true);
  });

  it("treats the outer edges of a syllable group as separate words", () => {
    const pair: SyllablePosition[] = ["first", "last", "none"];
    expect(roll({ wordIndex: 0, edge: "begin", syllablePositions: pair })).toBe(false);
    expect(roll({ wordIndex: 1, edge: "end", syllablePositions: pair })).toBe(false);
    expect(roll({ wordIndex: 1, edge: "end", syllablePositions: pair, rollingEdit: true })).toBe(true);
  });

  describe("alt inversion", () => {
    it("rolls separate words that would not roll", () => {
      expect(roll({ altHeld: true })).toBe(true);
      expect(roll({ edge: "end", altHeld: true })).toBe(true);
    });

    it("frees separate words that rolling edit would have rolled", () => {
      expect(roll({ rollingEdit: true, altHeld: true })).toBe(false);
      expect(roll({ edge: "end", rollingEdit: true, altHeld: true })).toBe(false);
    });

    it("frees a syllable boundary that would have rolled", () => {
      expect(roll({ syllablePositions: SYLLABLES, altHeld: true })).toBe(false);
      expect(roll({ edge: "end", syllablePositions: SYLLABLES, altHeld: true })).toBe(false);
    });

    it("frees a syllable boundary under rolling edit", () => {
      expect(roll({ syllablePositions: SYLLABLES, rollingEdit: true, altHeld: true })).toBe(false);
    });

    it("rejoins a gapped syllable boundary", () => {
      expect(roll({ words: gapped, syllablePositions: SYLLABLES, altHeld: true })).toBe(true);
      expect(roll({ words: gapped, edge: "end", syllablePositions: SYLLABLES, altHeld: true })).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("never rolls across a gap", () => {
      for (const rollingEdit of [false, true]) {
        for (const syllablePositions of [PLAIN, SYLLABLES]) {
          expect(roll({ words: gapped, rollingEdit, syllablePositions })).toBe(false);
          expect(roll({ words: gapped, edge: "end", rollingEdit, syllablePositions })).toBe(false);
        }
      }
    });

    it("never rolls off the start of the array", () => {
      for (const altHeld of [false, true]) {
        for (const rollingEdit of [false, true]) {
          expect(roll({ wordIndex: 0, edge: "begin", rollingEdit, altHeld })).toBe(false);
          expect(roll({ wordIndex: 0, edge: "begin", rollingEdit, altHeld, syllablePositions: SYLLABLES })).toBe(false);
        }
      }
    });

    it("never rolls off the end of the array", () => {
      for (const altHeld of [false, true]) {
        for (const rollingEdit of [false, true]) {
          expect(roll({ wordIndex: 2, edge: "end", rollingEdit, altHeld })).toBe(false);
          expect(roll({ wordIndex: 2, edge: "end", rollingEdit, altHeld, syllablePositions: SYLLABLES })).toBe(false);
        }
      }
    });

    it("is false for an out-of-range index, a negative index, and an empty array", () => {
      expect(roll({ wordIndex: 99, rollingEdit: true, altHeld: true })).toBe(false);
      expect(roll({ wordIndex: -1, edge: "end", rollingEdit: true, altHeld: true })).toBe(false);
      expect(roll({ words: [], wordIndex: 0, rollingEdit: true, altHeld: true })).toBe(false);
    });

    it("is false for a single-word array on both edges", () => {
      const single = [w("solo", 1, 2)];
      expect(roll({ words: single, wordIndex: 0, edge: "begin", rollingEdit: true })).toBe(false);
      expect(roll({ words: single, wordIndex: 0, edge: "end", rollingEdit: true })).toBe(false);
    });

    it("treats a missing syllable position as a separate word", () => {
      expect(roll({ syllablePositions: [] })).toBe(false);
      expect(roll({ syllablePositions: [], rollingEdit: true })).toBe(true);
    });

    it("rolls an overlapping pair, which counts as flush", () => {
      const overlapping = [w("a ", 0, 1.2), w("b", 1, 2)];
      expect(roll({ words: overlapping, wordIndex: 1, rollingEdit: true })).toBe(true);
      expect(roll({ words: overlapping, wordIndex: 0, edge: "end", rollingEdit: true })).toBe(true);
    });
  });

  describe("invariants", () => {
    it("does not modify its inputs", () => {
      const words = [w("a ", 0, 1), w("b", 1, 2)];
      const positions: SyllablePosition[] = ["first", "last"];
      const wordsSnapshot = structuredClone(words);
      const positionsSnapshot = structuredClone(positions);
      shouldRollNeighbour({
        words,
        wordIndex: 1,
        edge: "begin",
        rollingEdit: true,
        syllablePositions: positions,
        altHeld: true,
      });
      expect(words).toEqual(wordsSnapshot);
      expect(positions).toEqual(positionsSnapshot);
    });

    it("agrees on both sides of the same boundary", () => {
      for (const rollingEdit of [false, true]) {
        for (const altHeld of [false, true]) {
          for (let i = 0; i < flush.length - 1; i++) {
            const fromEnd = roll({ wordIndex: i, edge: "end", syllablePositions: SYLLABLES, rollingEdit, altHeld });
            const fromBegin = roll({
              wordIndex: i + 1,
              edge: "begin",
              syllablePositions: SYLLABLES,
              rollingEdit,
              altHeld,
            });
            expect(fromEnd).toBe(fromBegin);
          }
        }
      }
    });
  });
});
