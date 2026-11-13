import { insertSlot, remapWordTextsPreservingTiming } from "@/domain/word/remap-text";
import { computeSyllableGroups } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";

const flush: WordTiming[] = [
  { id: "w1", text: "I", sep: " ", begin: 1, end: 2, joinsNext: false },
  { id: "w2", text: "can't", sep: " ", begin: 2, end: 3, joinsNext: false },
  { id: "w3", text: "wait", sep: "", begin: 3, end: 4, joinsNext: false },
];

const gapped: WordTiming[] = [
  { id: "w4", text: "I", sep: " ", begin: 1, end: 2, joinsNext: false },
  { id: "w5", text: "can't", sep: " ", begin: 3, end: 4, joinsNext: false },
  { id: "w6", text: "wait", sep: "", begin: 5, end: 6, joinsNext: false },
];

function timings(words: WordTiming[]) {
  return words.map((w) => [w.text + w.sep, w.begin, w.end]);
}

describe("insertSlot", () => {
  it("fills the gap between the neighbours", () => {
    expect(insertSlot(2, 3)).toEqual({ begin: 2, end: 3 });
  });

  it("gives a zero-length slot at the previous end when there is no gap", () => {
    expect(insertSlot(2, 2)).toEqual({ begin: 2, end: 2 });
  });

  it("treats a negative gap as no gap", () => {
    expect(insertSlot(2, 1.5)).toEqual({ begin: 2, end: 2 });
  });
});

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

  it("gives an inserted word with no gap a zero-length slot and leaves the left neighbour intact", () => {
    const result = remapWordTextsPreservingTiming(flush, "I really can't wait");
    expect(timings(result)).toEqual([
      ["I ", 1, 2],
      ["really ", 2, 2],
      ["can't ", 2, 3],
      ["wait", 3, 4],
    ]);
  });

  it("gives a word appended at the end a zero-length slot after the last word", () => {
    const result = remapWordTextsPreservingTiming(flush, "I can't wait now");
    expect(timings(result)).toEqual([
      ["I ", 1, 2],
      ["can't ", 2, 3],
      ["wait ", 3, 4],
      ["now", 4, 4],
    ]);
  });

  it("gives a word prepended with no gap before it a zero-length slot at the first word's begin", () => {
    const result = remapWordTextsPreservingTiming(flush, "Oh I can't wait");
    expect(timings(result)).toEqual([
      ["Oh ", 1, 1],
      ["I ", 1, 2],
      ["can't ", 2, 3],
      ["wait", 3, 4],
    ]);
  });

  it("spreads fully rewritten text across the old line span", () => {
    const result = remapWordTextsPreservingTiming(flush, "totally new words here");
    expect(result.map((w) => w.text + w.sep)).toEqual(["totally ", "new ", "words ", "here"]);
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
        { id: "w7", text: "for", sep: "", begin: 0, end: 1, joinsNext: true },
        { id: "w8", text: "ever", sep: "", begin: 1, end: 2, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "for|ev|er");
      expect(result.map((w) => w.text)).toEqual(["for", "ev", "er"]);
      expect(result[0]).toEqual({ text: "for", sep: "", begin: 0, end: 1, joinsNext: true });
      expect(result[1].begin).toBe(1);
      expect(result[2].end).toBe(2);
      expect(result.map((w) => w.joinsNext)).toEqual([true, true, false]);
    });

    it("handles unicode words", () => {
      const words: WordTiming[] = [
        { id: "w9", text: "愛", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w10", text: "してる", sep: "", begin: 1, end: 2, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "愛 してる よ");
      expect(timings(result)).toEqual([
        ["愛 ", 0, 1],
        ["してる ", 1, 2],
        ["よ", 2, 2],
      ]);
    });
  });

  describe("regressions", () => {
    it("regression: words inserted on both sides of one word do not overlap it", () => {
      const result = remapWordTextsPreservingTiming(
        [{ id: "w11", text: "hello", sep: "", begin: 0, end: 1, joinsNext: false }],
        "oh hello there",
      );
      expect(timings(result)).toEqual([
        ["oh ", 0, 0],
        ["hello ", 0, 1],
        ["there", 1, 1],
      ]);
    });

    it("regression: an insert after a prepended run leaves every original word's timing intact", () => {
      const words: WordTiming[] = [
        { id: "w12", text: "a", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w13", text: "b", sep: "", begin: 1, end: 2, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "x a y b");
      expect(timings(result)).toEqual([
        ["x ", 0, 0],
        ["a ", 0, 1],
        ["y ", 1, 1],
        ["b", 1, 2],
      ]);
    });

    it("regression: a new word after a space does not join the previous word's syllable group", () => {
      const words: WordTiming[] = [
        { id: "w14", text: "bo", sep: "", begin: 0, end: 0.5, joinsNext: true },
        { id: "w15", text: "dy", sep: "", begin: 0.5, end: 1, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "bo|dy c");
      expect(result.map((w) => [w.text + w.sep, w.joinsNext])).toEqual([
        ["bo", true],
        ["dy ", false],
        ["c", false],
      ]);
    });

    it("regression: a new word followed by a space does not join the next word's syllable group", () => {
      const words: WordTiming[] = [
        { id: "w16", text: "a", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w17", text: "bo", sep: "", begin: 2, end: 2.5, joinsNext: true },
        { id: "w18", text: "dy", sep: "", begin: 2.5, end: 3, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "a c bo|dy");
      expect(result.map((w) => [w.text + w.sep, w.joinsNext])).toEqual([
        ["a ", false],
        ["c ", false],
        ["bo", true],
        ["dy", false],
      ]);
    });

    it("regression: a multi-syllable insert after a space does not join the previous word's group", () => {
      const words: WordTiming[] = [
        { id: "w19", text: "bo", sep: "", begin: 0, end: 0.5, joinsNext: true },
        { id: "w20", text: "dy", sep: " ", begin: 0.5, end: 1, joinsNext: false },
        { id: "w21", text: "end", sep: "", begin: 2, end: 3, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "bo|dy x|y end");
      expect(result.map((w) => [w.text + w.sep, w.joinsNext])).toEqual([
        ["bo", true],
        ["dy ", false],
        ["x", true],
        ["y ", false],
        ["end", false],
      ]);
    });

    it("regression: an insert separated from the next word by spaced words does not join its group", () => {
      const words: WordTiming[] = [
        { id: "w22", text: "a", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w23", text: "bo", sep: "", begin: 2, end: 2.5, joinsNext: true },
        { id: "w24", text: "dy", sep: "", begin: 2.5, end: 3, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "a x|y z bo|dy");
      expect(result.map((w) => [w.text + w.sep, w.joinsNext])).toEqual([
        ["a ", false],
        ["x", true],
        ["y ", false],
        ["z ", false],
        ["bo", true],
        ["dy", false],
      ]);
    });

    it("keeps every inserted syllable of a glued chain in the surrounding group", () => {
      const words: WordTiming[] = [
        { id: "w25", text: "for", sep: "", begin: 0, end: 1, joinsNext: true },
        { id: "w26", text: "er", sep: "", begin: 1, end: 2, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "for|ev|ev|er");
      expect(computeSyllableGroups(result)).toMatchObject([{ startIndex: 0, endIndex: 3 }]);
    });

    it("keeps an inserted syllable glued to the next syllable in that syllable's group", () => {
      const words: WordTiming[] = [
        { id: "w27", text: "a", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w28", text: "dy", sep: "", begin: 2, end: 3, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "a bo|dy");
      expect(result.map((w) => [w.text + w.sep, w.joinsNext])).toEqual([
        ["a ", false],
        ["bo", true],
        ["dy", false],
      ]);
    });
  });

  describe("invariants", () => {
    for (const [position, withInsert] of [
      ["start", "Oh I can't wait"],
      ["middle", "I really can't wait"],
      ["end", "I can't wait now"],
    ]) {
      it(`restores every word's timing exactly after inserting then deleting a word at the ${position}`, () => {
        const inserted = remapWordTextsPreservingTiming(flush, withInsert);
        expect(remapWordTextsPreservingTiming(inserted, "I can't wait")).toEqual(flush);
      });
    }

    it("never assigns overlapping timings when inserting around a single word", () => {
      const result = remapWordTextsPreservingTiming(
        [{ id: "w29", text: "hello", sep: "", begin: 0, end: 1, joinsNext: false }],
        "oh hello there now",
      );
      for (let i = 1; i < result.length; i++) expect(result[i].begin).toBeGreaterThanOrEqual(result[i - 1].end);
    });

    it("keeps a word end without a space when the edit leaves that boundary alone", () => {
      const words: WordTiming[] = [
        { id: "w32", text: "夜", sep: "", begin: 0, end: 1, joinsNext: false },
        { id: "w33", text: "空", sep: "", begin: 1, end: 2, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "夜|空 星");
      expect(result.map((w) => [w.text, w.joinsNext])).toEqual([
        ["夜", false],
        ["空", false],
        ["星", false],
      ]);
    });

    it("keeps explicit and joins on words that survive the edit", () => {
      const words: WordTiming[] = [
        { id: "w30", text: "damn", sep: " ", begin: 0, end: 1, explicit: true, joinsNext: false },
        { id: "w31", text: "it", sep: "", begin: 1, end: 2, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "damn it all");
      expect(result[0]).toEqual({ text: "damn", sep: " ", begin: 0, end: 1, explicit: true, joinsNext: false });
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
