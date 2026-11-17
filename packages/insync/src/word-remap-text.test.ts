import { insertSlot, remapWordTextsPreservingTiming, remapWordTextsWithinLimit } from "./word-remap-text";
import { computeSyllableGroups } from "./word-syllable-groups";
import type { WordTiming } from "./word-timing";
import { describe, expect, it } from "vitest";
import { DEFAULT_SPLIT_CHARACTER } from "./split-character-text";

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
    const result = remapWordTextsPreservingTiming(flush, "I cant wait", DEFAULT_SPLIT_CHARACTER);
    expect(timings(result)).toEqual([
      ["I ", 1, 2],
      ["cant ", 2, 3],
      ["wait", 3, 4],
    ]);
  });

  it("keeps every untouched word's timing when a word is deleted", () => {
    const result = remapWordTextsPreservingTiming(flush, "I wait", DEFAULT_SPLIT_CHARACTER);
    expect(timings(result)).toEqual([
      ["I ", 1, 2],
      ["wait", 3, 4],
    ]);
  });

  it("splits the replaced word's slot when one word becomes two", () => {
    const result = remapWordTextsPreservingTiming(flush, "I can not wait", DEFAULT_SPLIT_CHARACTER);
    expect(timings(result)).toEqual([
      ["I ", 1, 2],
      ["can ", 2, 2.5],
      ["not ", 2.5, 3],
      ["wait", 3, 4],
    ]);
  });

  it("places an inserted word inside the gap between its neighbours", () => {
    const result = remapWordTextsPreservingTiming(gapped, "I really can't wait", DEFAULT_SPLIT_CHARACTER);
    expect(timings(result)).toEqual([
      ["I ", 1, 2],
      ["really ", 2, 3],
      ["can't ", 3, 4],
      ["wait", 5, 6],
    ]);
  });

  // A typed word is never zero length: with no gap it shares the next word's slot by letters.
  it("regression: an inserted word with no gap shares the next word's slot and leaves the left neighbour intact", () => {
    const result = remapWordTextsPreservingTiming(flush, "I really can't wait", DEFAULT_SPLIT_CHARACTER);
    expect(timings(result)).toEqual([
      ["I ", 1, 2],
      ["really ", 2, 2.545],
      ["can't ", 2.545, 3],
      ["wait", 3, 4],
    ]);
  });

  it("gives a word appended at the end a zero-length slot after the last word", () => {
    const result = remapWordTextsPreservingTiming(flush, "I can't wait now", DEFAULT_SPLIT_CHARACTER);
    expect(timings(result)).toEqual([
      ["I ", 1, 2],
      ["can't ", 2, 3],
      ["wait ", 3, 4],
      ["now", 4, 4],
    ]);
  });

  // A typed word is never zero length: a prepended word shares the first word's slot by letters.
  it("regression: a word prepended with no gap before it shares the first word's slot", () => {
    const result = remapWordTextsPreservingTiming(flush, "Oh I can't wait", DEFAULT_SPLIT_CHARACTER);
    expect(timings(result)).toEqual([
      ["Oh ", 1, 1.666],
      ["I ", 1.666, 2],
      ["can't ", 2, 3],
      ["wait", 3, 4],
    ]);
  });

  it("spreads fully rewritten text across the old line span", () => {
    const result = remapWordTextsPreservingTiming(flush, "totally new words here", DEFAULT_SPLIT_CHARACTER);
    expect(result.map((w) => w.text + w.sep)).toEqual(["totally ", "new ", "words ", "here"]);
    expect(result[0].begin).toBe(1);
    expect(result[3].end).toBe(4);
    for (let i = 1; i < result.length; i++) expect(result[i].begin).toBe(result[i - 1].end);
  });

  describe("edge cases", () => {
    it("returns an empty array for empty text", () => {
      expect(remapWordTextsPreservingTiming(flush, "", DEFAULT_SPLIT_CHARACTER)).toEqual([]);
    });

    it("returns an empty array for whitespace-only text", () => {
      expect(remapWordTextsPreservingTiming(flush, "   ", DEFAULT_SPLIT_CHARACTER)).toEqual([]);
    });

    it("treats split characters as syllable boundaries when diffing", () => {
      const words: WordTiming[] = [
        { id: "w7", text: "for", sep: "", begin: 0, end: 1, joinsNext: true },
        { id: "w8", text: "ever", sep: "", begin: 1, end: 2, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "for|ev|er", DEFAULT_SPLIT_CHARACTER);
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
      const result = remapWordTextsPreservingTiming(words, "愛 してる よ", DEFAULT_SPLIT_CHARACTER);
      expect(timings(result)).toEqual([
        ["愛 ", 0, 1],
        ["してる ", 1, 2],
        ["よ", 2, 2],
      ]);
    });
  });

  describe("regressions", () => {
    it("regression: a shared slot never leaves the next word under a millisecond once exported", () => {
      const words: WordTiming[] = [{ id: "w42", text: "I", sep: "", begin: 1, end: 1.002, joinsNext: false }];
      const exportedMs = (word: WordTiming) => Math.round(word.end * 1000) - Math.round(word.begin * 1000);
      const shared = remapWordTextsPreservingTiming(words, "hello I", DEFAULT_SPLIT_CHARACTER);
      expect(shared.map(exportedMs)).toEqual([1, 1]);
      const tooShort = remapWordTextsPreservingTiming(
        [{ ...words[0], end: 1.001 }],
        "hello I",
        DEFAULT_SPLIT_CHARACTER,
      );
      // No word is ever written under a millisecond: with no time around it, "I" moves a millisecond later.
      expect(tooShort.map((word) => [word.text, word.begin, word.end])).toEqual([
        ["hello", 1, 1.001],
        ["I", 1.001, 1.002],
      ]);
    });

    it("regression: a word inserted into a gap shorter than a millisecond shares the next word's slot", () => {
      const words: WordTiming[] = [
        { id: "w40", text: "o", sep: " ", begin: 3.283, end: 3.333, joinsNext: false },
        { id: "w41", text: "ta", sep: "", begin: 3.33325, end: 3.45075, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "o ka ta", DEFAULT_SPLIT_CHARACTER);
      expect(result[1].end - result[1].begin).toBeGreaterThan(0.001);
      expect(result[1].end).toBe(result[2].begin);
      expect(result[2].end).toBe(3.45075);
    });

    it("regression: words typed between two short words with no room share the time of the words around them", () => {
      const words: WordTiming[] = [
        { id: "w50", text: "(sway", sep: " ", begin: 6.5, end: 6.59, joinsNext: false },
        { id: "w51", text: "mor", sep: "", begin: 6.59, end: 6.592, joinsNext: true },
        { id: "w52", text: "row", sep: " ", begin: 6.592, end: 6.594, joinsNext: false },
        { id: "w53", text: "lan", sep: "", begin: 6.594, end: 6.595, joinsNext: true },
        { id: "w54", text: "tern)", sep: "", begin: 6.595, end: 6.596, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(
        words,
        "(sway mor|row morrow glimmer river lan|tern)",
        DEFAULT_SPLIT_CHARACTER,
      );
      const exportedMs = (word: WordTiming) => Math.round(word.end * 1000) - Math.round(word.begin * 1000);
      expect(result.map((word) => word.text)).toEqual([
        "(sway",
        "mor",
        "row",
        "morrow",
        "glimmer",
        "river",
        "lan",
        "tern)",
      ]);
      expect(result.every((word) => exportedMs(word) >= 1)).toBe(true);
      expect(result.every((word, index) => index === 0 || word.begin === result[index - 1].end)).toBe(true);
      expect([result[0].begin, result.at(-1)?.end]).toEqual([6.5, 6.596]);
    });

    it("regression: a split mark typed in a word that ran into the next with no space keeps the split", () => {
      const words: WordTiming[] = [
        { id: "w60", text: "am", sep: "", begin: 1, end: 1.2, joinsNext: true },
        { id: "w61", text: "ber", sep: "", begin: 1.2, end: 1.4, joinsNext: false },
        { id: "w62", text: "rain", sep: "", begin: 1.4, end: 1.8, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "am|berra|in", DEFAULT_SPLIT_CHARACTER);
      expect(result.map((word) => [word.text, word.joinsNext])).toEqual([
        ["am", true],
        ["berra", true],
        ["in", false],
      ]);
    });

    it("regression: words moved for room never end past the limit, zero-length tail words included", () => {
      const packed: WordTiming[] = [
        { id: "w80", text: "a", sep: " ", begin: 1, end: 1.001, joinsNext: false },
        { id: "w81", text: "b", sep: " ", begin: 1.001, end: 1.002, joinsNext: false },
        { id: "w82", text: "c", sep: "", begin: 1.002, end: 1.003, joinsNext: false },
      ];
      for (const limit of [1.003, 1.004, 1.005, 1.006]) {
        const { words, untimedFrom } = remapWordTextsWithinLimit(packed, "a x b z c tail", DEFAULT_SPLIT_CHARACTER, limit);
        const ms = (seconds: number) => Math.round(seconds * 1000);
        const timed = words.slice(0, untimedFrom).filter((word) => word.end > word.begin);
        expect(words.slice(0, untimedFrom).every((word) => ms(word.end) <= ms(limit))).toBe(true);
        expect(timed.every((word, index) => index === 0 || ms(word.begin) >= ms(timed[index - 1].end))).toBe(true);
      }
    });

    it("regression: two runs sharing the time of one kept word never overlap", () => {
      const packed: WordTiming[] = [
        { id: "w90", text: "a", sep: " ", begin: 0, end: 0.1, joinsNext: false },
        { id: "w91", text: "b", sep: " ", begin: 0.1, end: 0.2, joinsNext: false },
        { id: "w92", text: "c", sep: "", begin: 0.2, end: 0.201, joinsNext: false },
      ];
      const ms = (seconds: number) => Math.round(seconds * 1000);
      const words = remapWordTextsPreservingTiming(packed, "a x b y c", DEFAULT_SPLIT_CHARACTER);
      expect(words.every((word) => ms(word.end) - ms(word.begin) >= 1)).toBe(true);
      expect(words.every((word, index) => index === 0 || ms(word.begin) >= ms(words[index - 1].end))).toBe(true);
    });

    it("regression: words inserted on both sides of one word do not overlap it", () => {
      const result = remapWordTextsPreservingTiming(
        [{ id: "w11", text: "hello", sep: "", begin: 0, end: 1, joinsNext: false }],
        "oh hello there",
        DEFAULT_SPLIT_CHARACTER,
      );
      // The prepended word shares the next word's slot; the appended one stays for the untimed tail.
      expect(timings(result)).toEqual([
        ["oh ", 0, 0.286],
        ["hello ", 0.286, 1],
        ["there", 1, 1],
      ]);
    });

    it("regression: an insert after a prepended run keeps every original word's end", () => {
      const words: WordTiming[] = [
        { id: "w12", text: "a", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w13", text: "b", sep: "", begin: 1, end: 2, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "x a y b", DEFAULT_SPLIT_CHARACTER);
      // Each inserted word shares the slot of the word after it, the original words keep their ends.
      expect(timings(result)).toEqual([
        ["x ", 0, 0.5],
        ["a ", 0.5, 1],
        ["y ", 1, 1.5],
        ["b", 1.5, 2],
      ]);
    });

    it("regression: a new word after a space does not join the previous word's syllable group", () => {
      const words: WordTiming[] = [
        { id: "w14", text: "bo", sep: "", begin: 0, end: 0.5, joinsNext: true },
        { id: "w15", text: "dy", sep: "", begin: 0.5, end: 1, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "bo|dy c", DEFAULT_SPLIT_CHARACTER);
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
      const result = remapWordTextsPreservingTiming(words, "a c bo|dy", DEFAULT_SPLIT_CHARACTER);
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
      const result = remapWordTextsPreservingTiming(words, "bo|dy x|y end", DEFAULT_SPLIT_CHARACTER);
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
      const result = remapWordTextsPreservingTiming(words, "a x|y z bo|dy", DEFAULT_SPLIT_CHARACTER);
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
      const result = remapWordTextsPreservingTiming(words, "for|ev|ev|er", DEFAULT_SPLIT_CHARACTER);
      expect(computeSyllableGroups(result)).toMatchObject([{ startIndex: 0, endIndex: 3 }]);
    });

    it("keeps an inserted syllable glued to the next syllable in that syllable's group", () => {
      const words: WordTiming[] = [
        { id: "w27", text: "a", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w28", text: "dy", sep: "", begin: 2, end: 3, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "a bo|dy", DEFAULT_SPLIT_CHARACTER);
      expect(result.map((w) => [w.text + w.sep, w.joinsNext])).toEqual([
        ["a ", false],
        ["bo", true],
        ["dy", false],
      ]);
    });
  });

  describe("invariants", () => {
    // A word inserted with no gap takes a share of the next word's slot, so only an appended word leaves no trace.
    for (const [position, withInsert] of [["end", "I can't wait now"]]) {
      it(`restores every word's timing exactly after inserting then deleting a word at the ${position}`, () => {
        const inserted = remapWordTextsPreservingTiming(flush, withInsert, DEFAULT_SPLIT_CHARACTER);
        expect(remapWordTextsPreservingTiming(inserted, "I can't wait", DEFAULT_SPLIT_CHARACTER)).toEqual(flush);
      });
    }

    it("never assigns overlapping timings when inserting around a single word", () => {
      const result = remapWordTextsPreservingTiming(
        [{ id: "w29", text: "hello", sep: "", begin: 0, end: 1, joinsNext: false }],
        "oh hello there now",
        DEFAULT_SPLIT_CHARACTER,
      );
      for (let i = 1; i < result.length; i++) expect(result[i].begin).toBeGreaterThanOrEqual(result[i - 1].end);
    });

    it("keeps a word end without a space when the edit leaves that boundary alone", () => {
      const words: WordTiming[] = [
        { id: "w32", text: "夜", sep: "", begin: 0, end: 1, joinsNext: false },
        { id: "w33", text: "空", sep: "", begin: 1, end: 2, joinsNext: false },
      ];
      const result = remapWordTextsPreservingTiming(words, "夜|空 星", DEFAULT_SPLIT_CHARACTER);
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
      const result = remapWordTextsPreservingTiming(words, "damn it all", DEFAULT_SPLIT_CHARACTER);
      expect(result[0]).toEqual({ text: "damn", sep: " ", begin: 0, end: 1, explicit: true, joinsNext: false });
    });

    it("does not mutate the input words", () => {
      const snapshot = structuredClone(flush);
      remapWordTextsPreservingTiming(flush, "I really can't wait now", DEFAULT_SPLIT_CHARACTER);
      expect(flush).toEqual(snapshot);
    });

    it("produces monotonically ordered, non-overlapping timings", () => {
      const result = remapWordTextsPreservingTiming(gapped, "Oh I really truly can wait now", DEFAULT_SPLIT_CHARACTER);
      for (let i = 0; i < result.length; i++) {
        expect(result[i].end).toBeGreaterThanOrEqual(result[i].begin);
        if (i > 0) expect(result[i].begin).toBeGreaterThanOrEqual(result[i - 1].end);
      }
    });

    it("returns one word per token of the new text", () => {
      const result = remapWordTextsPreservingTiming(flush, "a b c d e f", DEFAULT_SPLIT_CHARACTER);
      expect(result).toHaveLength(6);
    });
  });
});
