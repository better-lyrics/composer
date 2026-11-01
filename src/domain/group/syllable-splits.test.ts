/**
 * @vitest-environment node
 */
import { withEvenSyllableSplits } from "@/domain/group/syllable-splits";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";

function line(id: string, text: string, words?: Partial<WordTiming>[], extra: Partial<LyricLine> = {}): LyricLine {
  return reconcileLine({
    id,
    text,
    agentId: "v1",
    ...(words ? { words: words.map((word) => ({ text: "", begin: 0, end: 0, ...word })) } : {}),
    ...extra,
  });
}

function even(a: LyricLine, b: LyricLine): LyricLine[] | null {
  return withEvenSyllableSplits([a, b], [0, 1], 1, "|");
}

const texts = (words: readonly WordTiming[] | undefined) => words?.map((word) => word.text);
const spans = (words: readonly WordTiming[] | undefined) => words?.map((word) => [word.begin, word.end]);

describe("withEvenSyllableSplits", () => {
  it("leaves copies that already match untouched", () => {
    const a = line("a", "fal|ling too");
    const b = line("b", "fal|ling too");
    const result = even(a, b);
    expect(result?.[0]).toBe(a);
    expect(result?.[1]).toBe(b);
  });

  it("splits a timed word inside its own time span, in proportion to its letters", () => {
    const timed = line("a", "falling too", [
      { text: "falling ", begin: 10, end: 10.7 },
      { text: "too", begin: 10.7, end: 11 },
    ]);
    const result = even(timed, line("b", "fal|ling too"));
    expect(result?.[0].text).toBe("fal|ling too");
    expect(texts(result?.[0].words)).toEqual(["fal", "ling ", "too"]);
    expect(result?.[0].words?.[0]).toMatchObject({ begin: 10 });
    expect(result?.[0].words?.[0]?.end).toBeCloseTo(10.3, 6);
    expect(result?.[0].words?.[2]).toMatchObject({ begin: 10.7, end: 11 });
  });

  describe("regressions", () => {
    it("regression: keeps the timing of a repeated syllable on the word it belongs to", () => {
      const timed = line("a", "la lala", [
        { text: "la ", begin: 0, end: 1 },
        { text: "lala", begin: 1, end: 2 },
      ]);
      const result = even(timed, line("b", "la la|la"));
      expect(texts(result?.[0].words)).toEqual(["la ", "la", "la"]);
      expect(spans(result?.[0].words)).toEqual([
        [0, 1],
        [1, 1.5],
        [1.5, 2],
      ]);
    });

    it("regression: keeps a copy's own syllable timing when another copy splits further", () => {
      const timed = line("b", "fal|ling too", [
        { text: "fal", begin: 0, end: 0.2 },
        { text: "ling ", begin: 0.2, end: 1 },
        { text: "too", begin: 1, end: 2 },
      ]);
      const result = even(line("a", "fal|ling t|oo"), timed);
      expect(texts(result?.[1].words)).toEqual(["fal", "ling ", "t", "oo"]);
      expect(spans(result?.[1].words)?.slice(0, 2)).toEqual([
        [0, 0.2],
        [0.2, 1],
      ]);
      expect(result?.[1].words?.[2]?.begin).toBe(1);
      expect(result?.[1].words?.[3]?.end).toBe(2);
    });

    it("regression: combines splits that sit in different words of the line", () => {
      const result = even(line("a", "un|der a thousand"), line("b", "under a thou|sand"));
      expect(result?.map((copy) => copy.text)).toEqual(["un|der a thou|sand", "un|der a thou|sand"]);
    });

    it("regression: refuses copies that split the same word in different places", () => {
      const timed = line("b", "fal|ling too", [
        { text: "fal", begin: 0, end: 0.5 },
        { text: "ling ", begin: 0.5, end: 1 },
        { text: "too", begin: 1, end: 2 },
      ]);
      expect(even(line("a", "fa|lling too"), timed)).toBeNull();
    });

    it("regression: keeps each word's own syllable timing when splits in other words are combined", () => {
      const timed = line("b", "falling t|oo", [
        { text: "falling ", begin: 0, end: 1 },
        { text: "t", begin: 1, end: 1.5 },
        { text: "oo", begin: 1.5, end: 2 },
      ]);
      const result = even(line("a", "fa|lling too"), timed);
      expect(result?.[1].text).toBe("fa|lling t|oo");
      expect(texts(result?.[1].words)).toEqual(["fa", "lling ", "t", "oo"]);
      expect(result?.[1].words?.[1]?.end).toBe(1);
      expect(spans(result?.[1].words)?.slice(2)).toEqual([
        [1, 1.5],
        [1.5, 2],
      ]);
    });

    it("regression: a split character that splits nothing never wins over a real split", () => {
      const timed = line("b", "fal|ling too", [
        { text: "fal", begin: 0, end: 0.2 },
        { text: "ling ", begin: 0.2, end: 1 },
        { text: "too", begin: 1, end: 2 },
      ]);
      const result = even(line("a", "falling| too"), timed);
      expect(result?.[0].text).toBe("fal|ling| too");
      expect(result?.[1]).toBe(timed);
    });

    it("regression: an empty background on one copy is not a change", () => {
      const a = line("a", "go now", undefined, { backgroundText: "" });
      const b = line("b", "go now");
      const result = even(a, b);
      expect(result?.[0]).toBe(a);
      expect(result?.[1]).toBe(b);
    });
  });

  describe("whitespace and split characters", () => {
    it("regression: keeps a word's whole trailing whitespace when splitting it", () => {
      const timed = line("a", "好きだよ\u3000君", [
        { text: "好きだよ\u3000", begin: 0, end: 1 },
        { text: "君", begin: 1, end: 2 },
      ]);
      const result = even(timed, line("b", "好|きだよ\u3000君"));
      expect(texts(result?.[0].words)).toEqual(["好", "きだよ\u3000", "君"]);
    });

    it("regression: keeps a split character that splits nothing when the copies already agree", () => {
      const a = line("a", "falling| too");
      const b = line("b", "falling| too");
      const result = even(a, b);
      expect(result?.[0]).toBe(a);
      expect(result?.[1]).toBe(b);
    });

    it("regression: only adds split characters, never removes one", () => {
      const result = even(line("a", "|over and ov|er"), line("b", "over and over"));
      expect(result?.map((copy) => copy.text)).toEqual(["|over and ov|er", "over and ov|er"]);
    });

    it("regression: writes a split into the text when only the timed words had it", () => {
      const timed = line("a", "lala la", [
        { text: "la", begin: 10, end: 10.3 },
        { text: "la ", begin: 10.3, end: 10.6 },
        { text: "la", begin: 10.6, end: 11 },
      ]);
      const result = even(timed, line("b", "la|la la"));
      expect(result?.map((copy) => copy.text)).toEqual(["la|la la", "la|la la"]);
      expect(result?.[0].words).toBe(timed.words);
    });

    it("regression: the last syllable ends exactly where the old word ended", () => {
      const timed = line("a", "falling", [{ text: "falling", begin: 10, end: 10.6 }]);
      const result = even(timed, line("b", "fal|li|ng"));
      expect(result?.[0].words?.at(-1)?.end).toBe(10.6);
    });
  });

  describe("partly synced copies", () => {
    it("keeps untimed words untimed", () => {
      const partial = line("a", "falling too", [{ text: "falling ", begin: 10, end: 10.7 }]);
      const result = even(partial, line("b", "fal|ling t|oo"));
      expect(result?.[0].text).toBe("fal|ling t|oo");
      expect(texts(result?.[0].words)).toEqual(["fal", "ling "]);
      expect(result?.[0].words?.[1]?.end).toBe(10.7);
    });
  });

  describe("invariants", () => {
    it("never changes the text outside the split character", () => {
      expect(even(line("a", "falling too,"), line("b", "fal|ling too"))).toBeNull();
    });

    it("keeps the trailing space of a line's last word", () => {
      const timed = line("a", "the outside ", [
        { text: "the ", begin: 0, end: 1 },
        { text: "outside ", begin: 1, end: 2 },
      ]);
      const result = even(timed, line("b", "the out|side "));
      expect(texts(result?.[0].words)).toEqual(["the ", "out", "side "]);
    });

    it("drops a transliteration piece the new syllables cannot spell", () => {
      const timed = line("a", "falling too", [
        { text: "falling ", begin: 0, end: 1, transliteration: "FALLING" },
        { text: "too", begin: 1, end: 2, transliteration: "TOO" },
      ]);
      const result = even(timed, line("b", "fal|ling too"));
      expect(result?.[0].words?.slice(0, 2).every((word) => word.transliteration === undefined)).toBe(true);
      expect(result?.[0].words?.[2]?.transliteration).toBe("TOO");
    });

    it("refuses timed words that do not line up with the text's words", () => {
      const pseudo = line("a", "I love", [
        { text: "I", begin: 0, end: 1 },
        { text: " love", begin: 1, end: 2 },
      ]);
      expect(even(pseudo, line("b", "I love", [{ text: "I love", begin: 10, end: 11 }]))).toBeNull();
    });
  });
});
