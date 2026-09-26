import { describe, expect, it } from "vitest";
import { remapWordTextsPreservingTiming } from "@/domain/word/remap-text";
import type { WordTiming } from "@/domain/word/timing";

const flush: WordTiming[] = [
  { text: "I ", begin: 1, end: 2 },
  { text: "can't ", begin: 2, end: 3 },
  { text: "wait", begin: 3, end: 4 },
];

const gapped: WordTiming[] = [
  { text: "I ", begin: 1, end: 2 },
  { text: "can't ", begin: 3, end: 4 },
  { text: "wait", begin: 5, end: 6 },
];

function timings(words: WordTiming[]) {
  return words.map((w) => [w.text, w.begin, w.end]);
}

describe("remapWordTextsPreservingTiming", () => {
  it("remaps texts positionally when the word count is unchanged", () => {
    const result = remapWordTextsPreservingTiming(flush, "I cant wait");
    expect(timings(result)).toEqual([
      ["I ", 1, 2],
      ["cant ", 2, 3],
      ["wait", 3, 4],
    ]);
  });

  it("keeps every untouched word's timing when a word is deleted", () => {
    const result = remapWordTextsPreservingTiming(flush, "I wait");
    expect(timings(result)).toEqual([
      ["I ", 1, 2],
      ["wait", 3, 4],
    ]);
  });

  it("splits the replaced word's slot when one word becomes two", () => {
    const result = remapWordTextsPreservingTiming(flush, "I can not wait");
    expect(timings(result)).toEqual([
      ["I ", 1, 2],
      ["can ", 2, 2.5],
      ["not ", 2.5, 3],
      ["wait", 3, 4],
    ]);
  });

  it("places an inserted word inside the gap between its neighbours", () => {
    const result = remapWordTextsPreservingTiming(gapped, "I really can't wait");
    expect(timings(result)).toEqual([
      ["I ", 1, 2],
      ["really ", 2, 3],
      ["can't ", 3, 4],
      ["wait", 5, 6],
    ]);
  });

  it("shares the left neighbour's slot when an inserted word has no gap to fill", () => {
    const result = remapWordTextsPreservingTiming(flush, "I really can't wait");
    expect(timings(result)).toEqual([
      ["I ", 1, 1.5],
      ["really ", 1.5, 2],
      ["can't ", 2, 3],
      ["wait", 3, 4],
    ]);
  });

  it("shares the last word's slot when a word is appended at the end", () => {
    const result = remapWordTextsPreservingTiming(flush, "I can't wait now");
    expect(timings(result)).toEqual([
      ["I ", 1, 2],
      ["can't ", 2, 3],
      ["wait ", 3, 3.5],
      ["now", 3.5, 4],
    ]);
  });

  it("shares the first word's slot when a word is prepended with no gap before it", () => {
    const result = remapWordTextsPreservingTiming(flush, "Oh I can't wait");
    expect(timings(result)).toEqual([
      ["Oh ", 1, 1.5],
      ["I ", 1.5, 2],
      ["can't ", 2, 3],
      ["wait", 3, 4],
    ]);
  });

  it("spreads fully rewritten text across the old line span", () => {
    const result = remapWordTextsPreservingTiming(flush, "totally new words here");
    expect(result.map((w) => w.text)).toEqual(["totally ", "new ", "words ", "here"]);
    expect(result[0].begin).toBe(1);
    expect(result[3].end).toBe(4);
    for (let i = 1; i < result.length; i++) expect(result[i].begin).toBe(result[i - 1].end);
  });

  describe("edge cases", () => {
    it("returns an empty array for empty text", () => {
      expect(remapWordTextsPreservingTiming(flush, "")).toEqual([]);
    });

    it("returns an empty array for whitespace-only text", () => {
      expect(remapWordTextsPreservingTiming(flush, "   ")).toEqual([]);
    });

    it("treats split characters as syllable boundaries when diffing", () => {
      const words: WordTiming[] = [
        { text: "for", begin: 0, end: 1, syllableGroupId: "g1" },
        { text: "ever", begin: 1, end: 2, syllableGroupId: "g1" },
      ];
      const result = remapWordTextsPreservingTiming(words, "for|ev|er");
      expect(result.map((w) => w.text)).toEqual(["for", "ev", "er"]);
      expect(result[0]).toEqual({ text: "for", begin: 0, end: 1, syllableGroupId: "g1" });
      expect(result[1].begin).toBe(1);
      expect(result[2].end).toBe(2);
      expect(result.every((w) => w.syllableGroupId === "g1")).toBe(true);
    });

    it("handles unicode words", () => {
      const words: WordTiming[] = [
        { text: "愛 ", begin: 0, end: 1 },
        { text: "してる", begin: 1, end: 2 },
      ];
      const result = remapWordTextsPreservingTiming(words, "愛 してる よ");
      expect(timings(result)).toEqual([
        ["愛 ", 0, 1],
        ["してる ", 1, 1.5],
        ["よ", 1.5, 2],
      ]);
    });
  });

  describe("regressions", () => {
    it("regression: words inserted on both sides of one word do not overlap it", () => {
      const result = remapWordTextsPreservingTiming([{ text: "hello", begin: 0, end: 1 }], "oh hello there");
      expect(timings(result)).toEqual([
        ["oh ", 0, 0.5],
        ["hello ", 0.5, 0.75],
        ["there", 0.75, 1],
      ]);
    });

    it("regression: an insert after a prepended run shares the shrunk slot, not the original one", () => {
      const words: WordTiming[] = [
        { text: "a ", begin: 0, end: 1 },
        { text: "b", begin: 1, end: 2 },
      ];
      const result = remapWordTextsPreservingTiming(words, "x a y b");
      expect(timings(result)).toEqual([
        ["x ", 0, 0.5],
        ["a ", 0.5, 0.75],
        ["y ", 0.75, 1],
        ["b", 1, 2],
      ]);
    });

    it("regression: a new word after a space does not join the previous word's syllable group", () => {
      const words: WordTiming[] = [
        { text: "bo", begin: 0, end: 0.5, syllableGroupId: "g" },
        { text: "dy", begin: 0.5, end: 1, syllableGroupId: "g" },
      ];
      const result = remapWordTextsPreservingTiming(words, "bo|dy c");
      expect(result.map((w) => [w.text, w.syllableGroupId])).toEqual([
        ["bo", "g"],
        ["dy ", "g"],
        ["c", undefined],
      ]);
    });

    it("regression: a new word followed by a space does not join the next word's syllable group", () => {
      const words: WordTiming[] = [
        { text: "a ", begin: 0, end: 1 },
        { text: "bo", begin: 2, end: 2.5, syllableGroupId: "g" },
        { text: "dy", begin: 2.5, end: 3, syllableGroupId: "g" },
      ];
      const result = remapWordTextsPreservingTiming(words, "a c bo|dy");
      expect(result.map((w) => [w.text, w.syllableGroupId])).toEqual([
        ["a ", undefined],
        ["c ", undefined],
        ["bo", "g"],
        ["dy", "g"],
      ]);
    });

    it("regression: a multi-syllable insert after a space does not join the previous word's group", () => {
      const words: WordTiming[] = [
        { text: "bo", begin: 0, end: 0.5, syllableGroupId: "g" },
        { text: "dy ", begin: 0.5, end: 1, syllableGroupId: "g" },
        { text: "end", begin: 2, end: 3 },
      ];
      const result = remapWordTextsPreservingTiming(words, "bo|dy x|y end");
      expect(result.map((w) => [w.text, w.syllableGroupId])).toEqual([
        ["bo", "g"],
        ["dy ", "g"],
        ["x", undefined],
        ["y ", undefined],
        ["end", undefined],
      ]);
    });

    it("regression: an insert separated from the next word by spaced words does not join its group", () => {
      const words: WordTiming[] = [
        { text: "a ", begin: 0, end: 1 },
        { text: "bo", begin: 2, end: 2.5, syllableGroupId: "g" },
        { text: "dy", begin: 2.5, end: 3, syllableGroupId: "g" },
      ];
      const result = remapWordTextsPreservingTiming(words, "a x|y z bo|dy");
      expect(result.map((w) => [w.text, w.syllableGroupId])).toEqual([
        ["a ", undefined],
        ["x", undefined],
        ["y ", undefined],
        ["z ", undefined],
        ["bo", "g"],
        ["dy", "g"],
      ]);
    });

    it("keeps every inserted syllable of a glued chain in the surrounding group", () => {
      const words: WordTiming[] = [
        { text: "for", begin: 0, end: 1, syllableGroupId: "g" },
        { text: "er", begin: 1, end: 2, syllableGroupId: "g" },
      ];
      const result = remapWordTextsPreservingTiming(words, "for|ev|ev|er");
      expect(result.every((w) => w.syllableGroupId === "g")).toBe(true);
    });

    it("keeps an inserted syllable glued to the next syllable in that syllable's group", () => {
      const words: WordTiming[] = [
        { text: "a ", begin: 0, end: 1 },
        { text: "dy", begin: 2, end: 3, syllableGroupId: "g" },
      ];
      const result = remapWordTextsPreservingTiming(words, "a bo|dy");
      expect(result.map((w) => [w.text, w.syllableGroupId])).toEqual([
        ["a ", undefined],
        ["bo", "g"],
        ["dy", "g"],
      ]);
    });
  });

  describe("invariants", () => {
    it("never assigns overlapping timings when inserting around a single word", () => {
      const result = remapWordTextsPreservingTiming([{ text: "hello", begin: 0, end: 1 }], "oh hello there now");
      for (let i = 1; i < result.length; i++) expect(result[i].begin).toBeGreaterThanOrEqual(result[i - 1].end);
    });

    it("keeps explicit and syllableGroupId on words that survive the edit", () => {
      const words: WordTiming[] = [
        { text: "damn ", begin: 0, end: 1, explicit: true },
        { text: "it", begin: 1, end: 2 },
      ];
      const result = remapWordTextsPreservingTiming(words, "damn it all");
      expect(result[0]).toEqual({ text: "damn ", begin: 0, end: 1, explicit: true });
    });

    it("does not mutate the input words", () => {
      const snapshot = structuredClone(flush);
      remapWordTextsPreservingTiming(flush, "I really can't wait now");
      expect(flush).toEqual(snapshot);
    });

    it("produces monotonically ordered, non-overlapping timings", () => {
      const result = remapWordTextsPreservingTiming(gapped, "Oh I really truly can wait now");
      for (let i = 0; i < result.length; i++) {
        expect(result[i].end).toBeGreaterThanOrEqual(result[i].begin);
        if (i > 0) expect(result[i].begin).toBeGreaterThanOrEqual(result[i - 1].end);
      }
    });

    it("returns one word per token of the new text", () => {
      const result = remapWordTextsPreservingTiming(flush, "a b c d e f");
      expect(result).toHaveLength(6);
    });
  });
});
