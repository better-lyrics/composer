import { describe, expect, it } from "vitest";
import { lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { withSplitMarksFromWords, wordContentSpans } from "@/domain/line/reconstruct-text";
import { lineText, syllablesText } from "@/domain/line/text";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { withRoleWords } from "@/domain/line/track-writes";
import { wordKey } from "@/domain/word/alignment";
import { wordFromSpaced } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";

// -- Helpers ------------------------------------------------------------------

// A piece with no space after it is a syllable joined to the next.
function w(text: string): WordTiming {
  return wordFromSpaced({ text, begin: 0, end: 1, joinsNext: text === text.trimEnd() });
}

// -- syllablesText ------------------------------------------------------------

describe("syllablesText", () => {
  it("returns an empty string for no words", () => {
    expect(syllablesText([], "|")).toBe("");
  });

  it("returns a single word's text unchanged", () => {
    expect(syllablesText([w("world")], "|")).toBe("world");
  });

  it("joins space-separated words via their embedded trailing spaces", () => {
    expect(syllablesText([w("hello "), w("world")], "|")).toBe("hello world");
  });

  it("inserts the split character at a space-free joint (same-token syllables)", () => {
    expect(syllablesText([w("hel"), w("lo")], "|")).toBe("hel|lo");
  });

  it("mixes syllable joints and word spaces", () => {
    expect(syllablesText([w("hel"), w("lo "), w("world")], "|")).toBe("hel|lo world");
  });

  it("uses the provided split character", () => {
    expect(syllablesText([w("a"), w("b")], "/")).toBe("a/b");
  });

  it("never appends a split character after the final word", () => {
    expect(syllablesText([w("foo"), w("bar")], "|")).toBe("foo|bar");
  });
});

// -- Round-trip contract ------------------------------------------------------
//
// The whole point of reinserting the split character: reconstructed text must
// tokenize 1:1 back to the same word count it was built from.

describe("syllablesText round-trips through splitIntoWordsWithMeta", () => {
  for (const text of ["hello world", "hel|lo world", "one two three", "a|b|c", "single", "two|part"]) {
    it(`round-trips "${text}"`, () => {
      const { parts, trailingSpace } = splitIntoWordsWithMeta(text);
      const words = parts.map((part, i) => w(trailingSpace[i] ? `${part} ` : part));
      const reconstructed = syllablesText(words, "|");
      expect(reconstructed).toBe(text);
      expect(splitIntoWordsWithMeta(reconstructed).parts).toEqual(parts);
    });
  }
});

// -- wordContentSpans ---------------------------------------------------------

describe("wordContentSpans", () => {
  it("returns an empty array for no words", () => {
    expect(wordContentSpans([], "|")).toEqual([]);
  });

  it("maps plain space-separated words to their content ranges", () => {
    expect(wordContentSpans([w("Hello "), w("world")], "|")).toEqual([
      { start: 0, end: 5 },
      { start: 6, end: 11 },
    ]);
  });

  it("excludes a trailing space from the span end", () => {
    const spans = wordContentSpans([w("Hello "), w("world")], "|");
    expect(spans[0]).toEqual({ start: 0, end: 5 });
  });

  it("skips a leading space in the span start", () => {
    const words = [w("hello "), w(" world")];
    const reconstructed = syllablesText(words, "|");
    const spans = wordContentSpans(words, "|");
    expect(reconstructed).toBe("hello  world");
    expect(spans[1]).toEqual({ start: 7, end: 12 });
    expect(reconstructed.slice(spans[1].start, spans[1].end)).toBe("world");
  });

  it("shifts subsequent offsets by the split character at a space-free joint", () => {
    const words = [w("hel"), w("lo world")];
    const reconstructed = syllablesText(words, "|");
    const spans = wordContentSpans(words, "|");
    expect(reconstructed).toBe("hel|lo world");
    expect(spans).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 12 },
    ]);
    for (let i = 0; i < words.length; i++) {
      expect(reconstructed.slice(spans[i].start, spans[i].end)).toBe(words[i].text.trim());
    }
  });

  it("accounts for a multi-character split string", () => {
    const words = [w("hel"), w("lo")];
    const reconstructed = syllablesText(words, "::");
    const spans = wordContentSpans(words, "::");
    expect(reconstructed).toBe("hel::lo");
    expect(spans).toEqual([
      { start: 0, end: 3 },
      { start: 5, end: 7 },
    ]);
  });

  it("cross-checks every span against reconstructLineText output", () => {
    const splitChar = "|";
    const words = [w("hel"), w("lo "), w("brave "), w("new"), w(" world")];
    const reconstructed = syllablesText(words, splitChar);
    const spans = wordContentSpans(words, splitChar);
    expect(spans).toHaveLength(words.length);
    for (let i = 0; i < words.length; i++) {
      expect(reconstructed.slice(spans[i].start, spans[i].end)).toBe(words[i].text.trim());
    }
  });
});

// -- Untimed rest of a partly synced line --------------------------------------

describe("timed words written on a partly synced line", () => {
  const partly = (text: string, words: string[]): LyricLine =>
    lineFromFields({ id: "l1", agentId: "v1", text, words: words.map(w) });
  // Words the writer kept are the same words: they keep their ids, as every writer keeps them.
  const keptIds = (previous: LyricLine, words: WordTiming[]): WordTiming[] => {
    const before = [...timedSyllables(mainTrack(previous))];
    return words.map((word) => {
      const at = before.findIndex((old) => wordKey(old.text) === wordKey(word.text));
      if (at === -1) return word;
      const [kept] = before.splice(0, at + 1).slice(-1);
      return { ...word, id: kept.id };
    });
  };
  const derivedText = (previous: LyricLine, words: string[], text = lineText(previous)) => {
    expect(text).toBe(lineText(previous));
    return lineText(withRoleWords(previous, "main", keptIds(previous, words.map(w))));
  };

  it("keeps the untimed words when the timed words only change in place", () => {
    const previous = partly("la la la", ["la "]);
    expect(derivedText(previous, ["la "])).toBe("la la la");
  });

  it("regression: deleting a timed word keeps an untimed repeat of the word after it", () => {
    const previous = partly("a b b", ["a ", "b "]);
    expect(derivedText(previous, ["b "])).toBe("b b");
  });

  it("regression: timing a placeholder as a repeated word drops only that word from the untimed rest", () => {
    const previous = partly("a ... a b", ["a ", "... "]);
    expect(derivedText(previous, ["a ", "a "])).toBe("a a b");
  });

  it("regression: keeps the spacing of the untimed rest as the user typed it", () => {
    const previous = partly("a b  c", ["a "]);
    expect(derivedText(previous, ["a "])).toBe("a b  c");
  });

  it("does not repeat untimed words that new timed words now cover", () => {
    const previous = partly("every night in my dreams", ["every ", "night ", "in "]);
    expect(derivedText(previous, ["every ", "night ", "in ", "my ", "dreams"], "every night in my dreams")).toBe(
      "every night in my dreams",
    );
    const placeholder = partly("every night in ... my dreams", ["every ", "night ", "in ", "... "]);
    expect(derivedText(placeholder, ["every ", "night ", "in ", "my "])).toBe("every night in my dreams");
  });
});

// -- withSplitMarksFromWords --------------------------------------------------

describe("withSplitMarksFromWords", () => {
  const words = [w("Lanterns "), w("o"), w("ver "), w("water")];

  it("puts back the marks of split words the text lost", () => {
    expect(withSplitMarksFromWords("Lanterns over water", words, "|")).toBe("Lanterns o|ver water");
  });

  it("is idempotent", () => {
    expect(withSplitMarksFromWords("Lanterns o|ver water", words, "|")).toBe("Lanterns o|ver water");
  });

  it("leaves any other difference alone", () => {
    expect(withSplitMarksFromWords("Lanterns over water tonight", words, "|")).toBe("Lanterns over water tonight");
    expect(withSplitMarksFromWords("Lanterns  over water", words, "|")).toBe("Lanterns  over water");
    expect(withSplitMarksFromWords("Lanterns o/ver water", words, "|")).toBe("Lanterns o/ver water");
  });

  it("uses the split character it is given", () => {
    expect(withSplitMarksFromWords("Lanterns over water", words, "/")).toBe("Lanterns o/ver water");
  });
});
