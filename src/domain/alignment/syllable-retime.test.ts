// @vitest-environment node
import { newSyllableGroups, retimeInnerBoundaries } from "@/domain/alignment/syllable-retime";
import { wordFromSpaced } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";

const word = (text: string, begin: number, end: number, joinsNext = false): WordTiming =>
  wordFromSpaced({ text, begin, end, joinsNext });

describe("newSyllableGroups", () => {
  it("finds the groups a split made, not the ones already there", () => {
    const before = [word("hel", 0, 0.5, true), word("lo ", 0.5, 1), word("yellow", 1, 2)];
    const after = [word("hel", 0, 0.5, true), word("lo ", 0.5, 1), word("yel", 1, 1.5, true), word("low", 1.5, 2)];
    expect(newSyllableGroups(before, after)).toEqual([[2, 3]]);
  });

  it("counts a group that gained a syllable as new", () => {
    const before = [word("ba", 0, 0.5, true), word("nana", 0.5, 1.5)];
    const after = [word("ba", 0, 0.5, true), word("na", 0.5, 1, true), word("na", 1, 1.5)];
    expect(newSyllableGroups(before, after)).toEqual([[0, 2]]);
  });
});

describe("retimeInnerBoundaries", () => {
  it("moves only the boundaries inside a group, scaled from the model's span into the user's", () => {
    const words = [word("hel", 10, 11, true), word("lo ", 11, 12), word("there", 12, 13)];
    // The model heard the word at 20-22 with "lo" starting a quarter of the way in.
    const model = [
      { begin: 20, end: 20.5 },
      { begin: 20.5, end: 22 },
      { begin: 22, end: 23 },
    ];
    expect(retimeInnerBoundaries(words, [[0, 1]], model)).toEqual([
      word("hel", 10, 10.5, true),
      word("lo ", 10.5, 12),
      word("there", 12, 13),
    ]);
  });
});
