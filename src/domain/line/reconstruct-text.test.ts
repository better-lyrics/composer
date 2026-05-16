import type { WordTiming } from "@/stores/project";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";
import { describe, expect, it } from "vitest";
import { reconstructLineText } from "@/domain/line/reconstruct-text";

// -- Helpers ------------------------------------------------------------------

function w(text: string): WordTiming {
  return { text, begin: 0, end: 1 };
}

// -- reconstructLineText ------------------------------------------------------

describe("reconstructLineText", () => {
  it("returns an empty string for no words", () => {
    expect(reconstructLineText([], "|")).toBe("");
  });

  it("returns a single word's text unchanged", () => {
    expect(reconstructLineText([w("world")], "|")).toBe("world");
  });

  it("joins space-separated words via their embedded trailing spaces", () => {
    expect(reconstructLineText([w("hello "), w("world")], "|")).toBe("hello world");
  });

  it("inserts the split character at a space-free joint (same-token syllables)", () => {
    expect(reconstructLineText([w("hel"), w("lo")], "|")).toBe("hel|lo");
  });

  it("mixes syllable joints and word spaces", () => {
    expect(reconstructLineText([w("hel"), w("lo "), w("world")], "|")).toBe("hel|lo world");
  });

  it("uses the provided split character", () => {
    expect(reconstructLineText([w("a"), w("b")], "/")).toBe("a/b");
  });

  it("never appends a split character after the final word", () => {
    expect(reconstructLineText([w("foo"), w("bar")], "|")).toBe("foo|bar");
  });
});

// -- Round-trip contract ------------------------------------------------------
//
// The whole point of reinserting the split character: reconstructed text must
// tokenize 1:1 back to the same word count it was built from.

describe("reconstructLineText round-trips through splitIntoWordsWithMeta", () => {
  for (const text of ["hello world", "hel|lo world", "one two three", "a|b|c", "single", "two|part"]) {
    it(`round-trips "${text}"`, () => {
      const { parts, trailingSpace } = splitIntoWordsWithMeta(text);
      const words = parts.map((part, i) => w(trailingSpace[i] ? `${part} ` : part));
      const reconstructed = reconstructLineText(words, "|");
      expect(reconstructed).toBe(text);
      expect(splitIntoWordsWithMeta(reconstructed).parts).toEqual(parts);
    });
  }
});
