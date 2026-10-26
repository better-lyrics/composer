// @vitest-environment node
import { newSyllableGroups, retimeInnerBoundaries } from "@/domain/alignment/syllable-retime";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";

const word = (text: string, begin: number, end: number, syllableGroupId?: string): WordTiming => ({
  text,
  begin,
  end,
  ...(syllableGroupId ? { syllableGroupId } : {}),
});

describe("newSyllableGroups", () => {
  it("finds the groups a split made, not the ones already there", () => {
    const before = [word("hel", 0, 0.5, "a"), word("lo ", 0.5, 1, "a"), word("yellow", 1, 2)];
    const after = [
      word("hel", 0, 0.5, "a"),
      word("lo ", 0.5, 1, "a"),
      word("yel", 1, 1.5, "b"),
      word("low", 1.5, 2, "b"),
    ];
    expect(newSyllableGroups(before, after)).toEqual([[2, 3]]);
  });

  it("counts a group that gained a syllable as new", () => {
    const before = [word("ba", 0, 0.5, "a"), word("nana", 0.5, 1.5, "a")];
    const after = [word("ba", 0, 0.5, "a"), word("na", 0.5, 1, "a"), word("na", 1, 1.5, "a")];
    expect(newSyllableGroups(before, after)).toEqual([[0, 2]]);
  });
});

describe("retimeInnerBoundaries", () => {
  it("moves only the boundaries inside a group, scaled from the model's span into the user's", () => {
    const words = [word("hel", 10, 11, "a"), word("lo ", 11, 12, "a"), word("there", 12, 13)];
    // The model heard the word at 20-22 with "lo" starting a quarter of the way in.
    const model = [
      { begin: 20, end: 20.5 },
      { begin: 20.5, end: 22 },
      { begin: 22, end: 23 },
    ];
    expect(retimeInnerBoundaries(words, [[0, 1]], model)).toEqual([
      word("hel", 10, 10.5, "a"),
      word("lo ", 10.5, 12, "a"),
      word("there", 12, 13),
    ]);
  });
});
