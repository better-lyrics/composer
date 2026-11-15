import { describe, expect, it } from "vitest";
import { groupIdsForJoins, joinsFromWords, syllablesFromWords } from "./from-words";

describe("syllablesFromWords", () => {
  it("moves trailing whitespace into sep and joins pieces without it", () => {
    const track = syllablesFromWords([
      { text: "Pa", begin: 12.4, end: 12.62 },
      { text: "per ", begin: 12.62, end: 12.95 },
      { text: "lanterns", begin: 13.1, end: 13.9 },
    ]);
    expect(track).toEqual([
      { text: "Pa", sep: "", joinsNext: true, span: [12400, 12620] },
      { text: "per", sep: " ", joinsNext: false, span: [12620, 12950] },
      { text: "lanterns", sep: "", joinsNext: false, span: [13100, 13900] },
    ]);
  });

  it("follows syllable ids when the track has any, like computeSyllableGroups", () => {
    const track = syllablesFromWords([
      { text: "glow", begin: 1, end: 1.2, syllableGroupId: "g1" },
      { text: "ing", begin: 1.2, end: 1.5, syllableGroupId: "g1" },
      { text: "night", begin: 1.6, end: 2 },
    ]);
    expect(track.map((syllable) => syllable.joinsNext)).toEqual([true, false, false]);
    expect(track.map((syllable) => syllable.sep)).toEqual(["", "", ""]);
  });

  it("keeps a block of several words as one syllable", () => {
    const [block] = syllablesFromWords([{ text: "far away", begin: 14.3, end: 15.4 }]);
    expect(block).toEqual({ text: "far away", sep: "", joinsNext: false, span: [14300, 15400] });
  });

  it("keeps whitespace other than one space literally, joining only like computeSyllableGroups", () => {
    const track = syllablesFromWords([
      { text: "夜　", begin: 1, end: 1.5 },
      { text: "空  ", begin: 1.5, end: 2 },
      { text: "星", begin: 2, end: 2.5 },
    ]);
    expect(track.map((syllable) => syllable.sep)).toEqual(["　", "  ", ""]);
    expect(track.map((syllable) => syllable.joinsNext)).toEqual([true, false, false]);
  });
});

describe("joinsFromWords", () => {
  it("is the rule syllablesFromWords applies", () => {
    const words = [
      { text: "Pa", begin: 1, end: 1.2 },
      { text: "per ", begin: 1.2, end: 1.5 },
      { text: "夜　", begin: 1.6, end: 2 },
      { text: "空", begin: 2, end: 2.4 },
    ];
    expect(joinsFromWords(words)).toEqual(syllablesFromWords(words).map((syllable) => syllable.joinsNext));
    expect(joinsFromWords(words)).toEqual([true, false, true, false]);
  });
});

describe("groupIdsForJoins", () => {
  it("writes no ids when the spacing already reads the same joins", () => {
    const words = [
      { text: "Pa", joinsNext: true },
      { text: "per ", joinsNext: false },
      { text: "boats", joinsNext: false },
    ];
    expect(groupIdsForJoins(words)).toEqual([undefined, undefined, undefined]);
  });

  it("puts ids only on joined runs when the spacing would misread a join", () => {
    const words = [
      { text: "far ", joinsNext: true },
      { text: "away", joinsNext: false },
      { text: "夜", joinsNext: false },
      { text: "空", joinsNext: false },
    ];
    const ids = groupIdsForJoins(words);
    expect(ids).toEqual(["w0", "w0", undefined, undefined]);
    const read = joinsFromWords(words.map(({ text }, i) => ({ text, syllableGroupId: ids[i] })));
    expect(read).toEqual([true, false, false, false]);
  });

  it("marks only the first misread word when nothing joins", () => {
    const words = [
      { text: "夜", joinsNext: false },
      { text: "空", joinsNext: false },
    ];
    expect(groupIdsForJoins(words)).toEqual(["w0", undefined]);
  });
});
