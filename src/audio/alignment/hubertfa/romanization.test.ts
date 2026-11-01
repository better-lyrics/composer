import japaneseText from "@/audio/alignment/hubertfa/dictionary-ja.txt?raw";
import { parseDictionary } from "@/audio/alignment/hubertfa/lexicon";
import { pinyinSyllables, romajiLine, romajiToMorae } from "@/audio/alignment/hubertfa/romanization";
import { describe, expect, it } from "vitest";

const japanese = parseDictionary(japaneseText);
const isMora = (key: string) => key !== "cl" && japanese.has(key);

describe("romajiToMorae", () => {
  it("reads Hepburn romaji as the dictionary's morae", () => {
    expect(romajiToMorae("sadame", isMora)).toEqual(["sa", "da", "me"]);
    expect(romajiToMorae("kyou", isMora)).toEqual(["kyo", "u"]);
    expect(romajiToMorae("tsuki", isMora)).toEqual(["tsu", "ki"]);
  });

  it("handles small tsu, n and long vowels", () => {
    expect(romajiToMorae("kitte", isMora)).toEqual(["ki", "cl", "te"]);
    expect(romajiToMorae("matcha", isMora)).toEqual(["ma", "cl", "cha"]);
    expect(romajiToMorae("konnichiwa", isMora)).toEqual(["ko", "n", "ni", "chi", "wa"]);
    expect(romajiToMorae("shimbun", isMora)).toEqual(["shi", "n", "bu", "n"]);
    expect(romajiToMorae("kan'i", isMora)).toEqual(["ka", "n", "i"]);
  });

  it("accepts Kunrei spellings that Hepburn doesn't use", () => {
    expect(romajiToMorae("tukisi", isMora)).toEqual(["tsu", "ki", "shi"]);
  });

  it("returns null for words that aren't romaji", () => {
    expect(romajiToMorae("style", isMora)).toBeNull();
  });
});

describe("romajiLine", () => {
  it("splits on spaces and punctuation and expands long-vowel marks", () => {
    expect(romajiLine("Tōkyō  no  sora", isMora).map((w) => w.morae)).toEqual([
      ["to", "o", "kyo", "o"],
      ["no"],
      ["so", "ra"],
    ]);
  });
});

describe("pinyinSyllables", () => {
  it("strips tone marks and numbers and writes ü as v", () => {
    expect(pinyinSyllables("Wǒ  ài  nǐ")).toEqual(["wo", "ai", "ni"]);
    expect(pinyinSyllables("nü3 lü4")).toEqual(["nv", "lv"]);
  });
});
