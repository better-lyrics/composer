import { lookupWord, parseDictionary } from "@/audio/alignment/hubertfa/lexicon";
import { describe, expect, it } from "vitest";

const dictionary = parseDictionary(
  [
    "don't\td ow n t",
    "loving\tl ah v ih ng",
    "oh\tow",
    "that's\tdh ae t s",
    "'cause\tk ax z",
    "hello\thh ax l ow",
  ].join("\n"),
);

function phones(word: string) {
  const result = lookupWord(word, dictionary);
  return result.kind === "phones" ? result.phones.join(" ") : result.kind;
}

describe("lookupWord", () => {
  it("ignores case, punctuation and curly apostrophes", () => {
    expect(phones("(Hello,")).toBe("hh ax l ow");
    expect(phones("Don’t")).toBe("d ow n t");
  });

  it("sings a dropped g as n", () => {
    expect(phones("lovin'")).toBe("l ah v ih n");
    expect(phones("lovin")).toBe("l ah v ih n");
  });

  it("restores a missing contraction apostrophe", () => {
    expect(phones("thats")).toBe("dh ae t s");
  });

  it("keeps leading-apostrophe elisions", () => {
    expect(phones("'cause")).toBe("k ax z");
  });

  it("joins the pieces of hyphenated words", () => {
    expect(phones("oh-oh")).toBe("ow ow");
  });

  it("treats punctuation-only tokens as silent", () => {
    expect(phones("—")).toBe("silent");
    expect(phones("...")).toBe("silent");
  });

  it("treats symbols as silent", () => {
    expect(phones("♪")).toBe("silent");
  });

  it("reports words in other scripts as unknown rather than silent", () => {
    expect(lookupWord("こんにちは", dictionary)).toEqual({ kind: "unknown", key: "こんにちは" });
    expect(lookupWord("привет", dictionary).kind).toBe("unknown");
  });

  it("folds accents before looking a word up", () => {
    expect(phones("Hélló")).toBe("hh ax l ow");
  });

  it("reports words it can't pronounce by their normalised spelling", () => {
    expect(lookupWord("Peyote!", dictionary)).toEqual({ kind: "unknown", key: "peyote" });
  });
});
