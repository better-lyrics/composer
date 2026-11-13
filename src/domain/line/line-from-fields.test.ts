import { describe, expect, it } from "vitest";
import { lineText } from "@/domain/line/text";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { createLine } from "@/test/factories";

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
    expect(timedSyllables(mainTrack(line))).toEqual(timedSyllables(mainTrack(line)));
    expect(
      mainTrack(line)
        .syllables.slice(3)
        .map((syllable) => syllable.text),
    ).toEqual(["drifting", "slow"]);
    expect(lineText(line)).toBe(lineText(line));
  });
});
