import { describe, expect, it } from "vitest";
import { lineFromFields } from "@/domain/line/line-from-fields";
import { lineText } from "@/domain/line/text";
import { mainTrack, roleWords, timedSyllables } from "@/domain/line/track";
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
    expect(timedSyllables(mainTrack(line))).toBe(roleWords(line, "main"));
    expect(
      mainTrack(line)
        .syllables.slice(3)
        .map((syllable) => syllable.text),
    ).toEqual(["drifting", "slow"]);
    expect(lineText(line)).toBe("Paper lan|terns drifting slow");
  });
});

describe("lineFromFields on a partly synced line", () => {
  it("reads the join after the last text part a timed word covers, not the word's index", () => {
    const words = createWords([{ text: "oh yeah", sep: "", begin: 1, end: 2, joinsNext: false }]);
    const line = lineFromFields({ id: "l1", agentId: "v1", text: "oh yeah|ba by", words });
    expect(timedSyllables(mainTrack(line)).map((word) => word.joinsNext)).toEqual([true]);
  });
});
