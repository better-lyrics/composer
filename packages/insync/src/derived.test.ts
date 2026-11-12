import { describe, expect, it } from "vitest";
import { trackText, trackWords } from "./derived";
import { syllablesFromWords } from "./from-words";

const TRACK = syllablesFromWords([
  { text: "Pa", begin: 12.4, end: 12.62 },
  { text: "per ", begin: 12.62, end: 12.95 },
  { text: "lan", begin: 13.1, end: 13.38 },
  { text: "terns ", begin: 13.38, end: 13.9 },
  { text: "drifting", begin: 14.05, end: 15.2 },
]);

describe("derived reads", () => {
  it("joins text and separators into the track text", () => {
    expect(trackText(TRACK)).toBe("Paper lanterns drifting");
  });

  it("groups syllables into words while joinsNext holds", () => {
    expect(trackWords(TRACK).map((word) => word.map((syllable) => syllable.text))).toEqual([
      ["Pa", "per"],
      ["lan", "terns"],
      ["drifting"],
    ]);
  });
});
