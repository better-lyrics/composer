import { describe, expect, it } from "vitest";
import { splitWordIntoWordsKeepingTransliteration } from "@/domain/language/reconcile-syllable-split";
import { computeSyllableGroups, getSyllablePositions } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { type LegacyWord, legacyLine, legacyWords } from "@/test/legacy-languages";
import { splitWordIntoWords } from "@/utils/word-split";

function splitKeepingReadings(word: WordTiming, reading: string, splitPoints: number[]): LegacyWord[] {
  const line = legacyLine({
    id: "line",
    agentId: "v1",
    text: word.text,
    words: [{ ...word, transliteration: reading, transliterationJoinerAfter: "  " }],
    transliteration: { language: "und-Latn", text: reading, segments: [], origin: "manual", sourceFingerprint: "x" },
  });
  const parts = splitWordIntoWords(word, splitPoints);
  const split = splitWordIntoWordsKeepingTransliteration(line, "word", 0, parts, "|");
  return legacyWords(split?.words, split?.languages) ?? [];
}

describe("splitWordIntoWords", () => {
  const source: WordTiming = { id: "w1", text: "everyday", sep: "", begin: 1, end: 2, joinsNext: false };

  it("splits into independent words with a trailing space on the non-final word", () => {
    const out = splitWordIntoWords(source, [5]);
    expect(out.map((w) => w.text + w.sep)).toEqual(["every ", "day"]);
    expect(out.map((w) => w.joinsNext)).toEqual([false, false]);
  });

  it("does not copy the whole word's transliteration onto each piece", () => {
    const out = splitKeepingReadings(source, "evuridei", [5]);
    expect(out).toHaveLength(2);
    expect(out.every((w) => w.transliteration === undefined && w.transliterationJoinerAfter === undefined)).toBe(true);
  });

  it("preserves the source trailing space on the final word", () => {
    const out = splitWordIntoWords({ ...source, text: "everyday", sep: " " }, [5]);
    expect(out.map((w) => w.text + w.sep)).toEqual(["every ", "day "]);
  });

  it("distributes timing across the source span", () => {
    const out = splitWordIntoWords(source, [5]);
    expect(out[0].begin).toBe(1);
    expect(out[out.length - 1].end).toBe(2);
  });

  it("output is NOT a syllable group on its own", () => {
    const out = splitWordIntoWords(source, [5]);
    expect(getSyllablePositions(out)).toEqual(["none", "none"]);
    expect(computeSyllableGroups(out)).toEqual([]);
  });

  it("output is NOT a syllable group when another word follows", () => {
    const out = splitWordIntoWords(source, [5]);
    const line = [...out, { id: "w2", text: "x", sep: "", begin: 2, end: 3, joinsNext: false }];
    expect(getSyllablePositions(line).slice(0, 2)).toEqual(["none", "none"]);
  });
});

describe("splitWordIntoWords · text containing spaces", () => {
  const line = { id: "w3", text: "It hurts for me", sep: "", begin: 10, end: 12, joinsNext: true };

  it("regression: splitting right before a space does not leave a leading space on the next word", () => {
    const out = splitWordIntoWords(line, [2, 8]);
    expect(out.map((w) => w.text + w.sep)).toEqual(["It ", "hurts ", "for me"]);
  });

  it("regression: splitting right after a space does not leave a trailing double space", () => {
    const out = splitWordIntoWords(line, [3, 9]);
    expect(out.map((w) => w.text + w.sep)).toEqual(["It ", "hurts ", "for me"]);
  });

  describe("edge cases", () => {
    it("drops a whitespace-only part and gives its time to the previous word", () => {
      const out = splitWordIntoWords(line, [2, 3]);
      expect(out.map((w) => w.text + w.sep)).toEqual(["It ", "hurts for me"]);
      expect(out[0].begin).toBe(10);
      expect(out[0].end).toBe(out[1].begin);
      expect(out[1].end).toBe(12);
    });

    it("keeps the source trailing space on the final word", () => {
      const out = splitWordIntoWords({ ...line, text: "It hurts", sep: " " }, [2]);
      expect(out.map((w) => w.text + w.sep)).toEqual(["It ", "hurts "]);
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

describe("splitWordIntoWords · transliteration", () => {
  const word: WordTiming = {
    id: "w4",
    text: "приветмир",
    sep: " ",
    begin: 3,
    end: 4,
    joinsNext: false,
  };

  it("regression: parts never copy the parent's transliteration (#283)", () => {
    const out = splitKeepingReadings(word, "privet mir", [6]);
    expect(out.map((w) => w.text + w.sep)).toEqual(["привет ", "мир "]);
    for (const part of out) {
      expect(part).not.toHaveProperty("transliteration");
      expect(part).not.toHaveProperty("transliterationJoinerAfter");
    }
  });

  it("does not mutate the source word", () => {
    const before = structuredClone(word);
    splitWordIntoWords(word, [6]);
    expect(word).toEqual(before);
  });
});
