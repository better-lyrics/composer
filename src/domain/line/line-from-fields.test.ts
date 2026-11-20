import { describe, expect, it } from "vitest";
import { withTrailingJoinFromText } from "@/domain/line/line-from-fields";
import { lineText } from "@/domain/line/text";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { createLine, createWords } from "@/test/factories";

describe("tracksFromFields", () => {
  it("timed syllables are today's words and the text reads back", () => {
    const line = createLine({
      text: "Paper lan|terns drifting slow",
      words: [
        { text: "Paper", sep: " ", begin: 1, end: 1.4 },
        { text: "lan", sep: "", begin: 1.4, end: 1.6, syllableGroupId: "g1" },
        { text: "terns", sep: " ", begin: 1.6, end: 2, syllableGroupId: "g1" },
      ],
    });
    expect(timedSyllables(mainTrack(line))).toBe(line.words);
    expect(
      mainTrack(line)
        .syllables.slice(3)
        .map((syllable) => syllable.text),
    ).toEqual(["drifting", "slow"]);
    expect(lineText(line)).toBe("Paper lan|terns drifting slow");
  });
});

describe("withTrailingJoinFromText", () => {
  it("reads the join after the last text part a timed word covers, not the word's index", () => {
    const words = createWords([{ text: "oh yeah", sep: "", begin: 1, end: 2, joinsNext: false }]);
    expect(withTrailingJoinFromText("oh yeah|ba by", words).map((word) => word.joinsNext)).toEqual([true]);
  });
});
