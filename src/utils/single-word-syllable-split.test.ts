import { splitWordIntoSyllables } from "@/utils/single-word-syllable-split";
import { describe, expect, it } from "vitest";

describe("splitWordIntoSyllables", () => {
  it("splits paired transliteration text into the same canonical timing slots", () => {
    const result = splitWordIntoSyllables({
      word: { text: "今日", transliteration: "kyouhi", begin: 0, end: 1 },
      splitPoints: [1],
      transliterationSplitPoints: [4],
    });
    expect(result.map((word) => word.text)).toEqual(["今", "日"]);
    expect(result.map((word) => word.transliteration)).toEqual(["kyou", "hi"]);
    expect(result[0].transliterationJoinerAfter).toBe("");
    expect(result[0].end).toBe(result[1].begin);
  });
  it("removes untimed spaces at selected transliteration boundaries", () => {
    const result = splitWordIntoSyllables({
      word: { text: "걸음은", transliteration: "geol eum eun", begin: 0, end: 1 },
      splitPoints: [1, 2],
      transliterationSplitPoints: [5, 9],
    });
    expect(result.map((word) => word.transliteration)).toEqual(["geol", "eum", "eun"]);
    expect(result.map((word) => word.transliterationJoinerAfter)).toEqual([" ", " ", undefined]);
  });

  it("preserves dash separators for a later merge", () => {
    const result = splitWordIntoSyllables({
      word: { text: "to-do", transliteration: "to-do", begin: 0, end: 1 },
      splitPoints: [3],
      transliterationSplitPoints: [3],
    });

    expect(result.map((word) => word.transliteration)).toEqual(["to", "do"]);
    expect(result[0].transliterationJoinerAfter).toBe("-");
  });

  it("moves an outer transliteration separator to the last fragment of a nested split", () => {
    const firstSplit = splitWordIntoSyllables({
      word: { text: "abcd", transliteration: "ab cd", begin: 0, end: 1 },
      splitPoints: [2],
      transliterationSplitPoints: [3],
    });
    const nested = splitWordIntoSyllables({
      word: firstSplit[0],
      splitPoints: [1],
      transliterationSplitPoints: [1],
      reuseGroupId: true,
    });

    expect(nested.map((word) => word.transliterationJoinerAfter)).toEqual(["", " "]);
  });
  it("trims trailing space before computing per-character durations", () => {
    const result = splitWordIntoSyllables({
      word: { text: "running ", begin: 0, end: 8 },
      splitPoints: [3],
    });
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("run");
    expect(result[0].end).toBeCloseTo(3.428, 2);
    expect(result[1].text).toBe("ning ");
    expect(result[1].begin).toBeCloseTo(3.428, 2);
    expect(result[1].end).toBe(8);
  });

  it("generates a fresh syllableGroupId when reuseGroupId is false (default)", () => {
    const result = splitWordIntoSyllables({
      word: { text: "abc", begin: 0, end: 1, syllableGroupId: "existing-id" },
      splitPoints: [1],
    });
    expect(result[0].syllableGroupId).not.toBe("existing-id");
    expect(result[0].syllableGroupId).toBe(result[1].syllableGroupId);
  });

  it("reuses syllableGroupId when reuseGroupId is true and word has one", () => {
    const result = splitWordIntoSyllables({
      word: { text: "abc", begin: 0, end: 1, syllableGroupId: "existing-id" },
      splitPoints: [1],
      reuseGroupId: true,
    });
    expect(result[0].syllableGroupId).toBe("existing-id");
    expect(result[1].syllableGroupId).toBe("existing-id");
  });

  it("generates a fresh syllableGroupId when reuseGroupId is true but word has none", () => {
    const result = splitWordIntoSyllables({
      word: { text: "abc", begin: 0, end: 1 },
      splitPoints: [1],
      reuseGroupId: true,
    });
    expect(result[0].syllableGroupId).toBeTruthy();
    expect(result[0].syllableGroupId).toBe(result[1].syllableGroupId);
  });

  it("does not append a trailing space when the source had none", () => {
    const result = splitWordIntoSyllables({
      word: { text: "abc", begin: 0, end: 1 },
      splitPoints: [1],
    });
    expect(result[1].text).toBe("bc");
  });
});
