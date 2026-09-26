import { describe, expect, it } from "vitest";
import { computeSyllableGroups, getSyllablePositions } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { splitWordIntoWords } from "@/utils/word-split";

describe("splitWordIntoWords", () => {
  const source: WordTiming = { text: "everyday", begin: 1, end: 2 };

  it("splits into independent words with a trailing space on the non-final word", () => {
    const out = splitWordIntoWords(source, [5]);
    expect(out.map((w) => w.text)).toEqual(["every ", "day"]);
    expect(out[0].syllableGroupId).toBeUndefined();
    expect(out[1].syllableGroupId).toBeUndefined();
  });

  it("preserves the source trailing space on the final word", () => {
    const out = splitWordIntoWords({ ...source, text: "everyday " }, [5]);
    expect(out.map((w) => w.text)).toEqual(["every ", "day "]);
  });

  it("distributes timing across the source span", () => {
    const out = splitWordIntoWords(source, [5]);
    expect(out[0].begin).toBe(1);
    expect(out[out.length - 1].end).toBe(2);
  });

  it("output is NOT a syllable group when the line has no syllableGroupId", () => {
    const out = splitWordIntoWords(source, [5]);
    expect(getSyllablePositions(out)).toEqual(["none", "none"]);
    expect(computeSyllableGroups(out)).toEqual([]);
  });

  it("output is NOT a syllable group when the line also has a syllableGroupId word", () => {
    const out = splitWordIntoWords(source, [5]);
    const line = [...out, { text: "x", begin: 2, end: 3, syllableGroupId: "g1" }];
    expect(getSyllablePositions(line).slice(0, 2)).toEqual(["none", "none"]);
  });
});

describe("splitWordIntoWords · text containing spaces", () => {
  const line = { text: "It hurts for me", begin: 10, end: 12 };

  it("regression: splitting right before a space does not leave a leading space on the next word", () => {
    const out = splitWordIntoWords(line, [2, 8]);
    expect(out.map((w) => w.text)).toEqual(["It ", "hurts ", "for me"]);
  });

  it("regression: splitting right after a space does not leave a trailing double space", () => {
    const out = splitWordIntoWords(line, [3, 9]);
    expect(out.map((w) => w.text)).toEqual(["It ", "hurts ", "for me"]);
  });

  describe("edge cases", () => {
    it("drops a whitespace-only part and gives its time to the previous word", () => {
      const out = splitWordIntoWords(line, [2, 3]);
      expect(out.map((w) => w.text)).toEqual(["It ", "hurts for me"]);
      expect(out[0].begin).toBe(10);
      expect(out[0].end).toBe(out[1].begin);
      expect(out[1].end).toBe(12);
    });

    it("keeps the source trailing space on the final word", () => {
      const out = splitWordIntoWords({ ...line, text: "It hurts " }, [2]);
      expect(out.map((w) => w.text)).toEqual(["It ", "hurts "]);
    });
  });

  describe("invariants", () => {
    it("covers the source span contiguously", () => {
      const out = splitWordIntoWords(line, [2, 3, 8, 12]);
      expect(out[0].begin).toBe(10);
      expect(out[out.length - 1].end).toBe(12);
      for (let i = 1; i < out.length; i++) expect(out[i].begin).toBe(out[i - 1].end);
    });

    it("never emits a word with leading or doubled whitespace", () => {
      const out = splitWordIntoWords(line, [1, 2, 3, 4, 8, 9, 12, 13]);
      for (const w of out) {
        expect(w.text).not.toMatch(/^\s/);
        expect(w.text).not.toMatch(/\s\s/);
        expect(w.text.trim()).not.toBe("");
      }
    });
  });
});
