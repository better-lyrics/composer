import { describe, expect, it } from "vitest";
import { lineFromFields } from "@/domain/line/line-from-fields";
import { lineText, trackText } from "@/domain/line/text";
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

describe("text joints", () => {
  it("regression: an ideographic space between untimed words gets no split mark", () => {
    const line = lineFromFields({ id: "cjk", agentId: "v1", text: "你好\u3000世界" });
    expect(lineText(line)).toBe("你好\u3000世界");
  });
});

describe("a load never drops the untimed rest", () => {
  const syllableTexts = (line: ReturnType<typeof lineFromFields>) =>
    mainTrack(line).syllables.map((syllable) => syllable.text);
  const helLo = () =>
    createWords([
      { text: "hel", sep: "", begin: 1, end: 1.2, joinsNext: true },
      { text: "lo", sep: " ", begin: 1.2, end: 1.5 },
    ]);

  it("regression: keeps the rest of text saved with another split character", () => {
    const line = lineFromFields({ id: "l1", agentId: "v1", text: "hel|lo world", words: helLo() }, "/");
    expect(syllableTexts(line)).toEqual(["hel", "lo", "world"]);
    expect(trackText(mainTrack(line), "/")).toBe("hel/lo world");
  });

  it("regression: keeps the rest when the text never marked the split", () => {
    const line = lineFromFields({ id: "l1", agentId: "v1", text: "hello world", words: helLo() }, "|");
    expect(syllableTexts(line)).toEqual(["hel", "lo", "world"]);
  });

  it("keeps the whole text after the timed words when the words do not spell it", () => {
    const line = lineFromFields({ id: "l1", agentId: "v1", text: "goodbye moon", words: helLo() }, "|");
    expect(syllableTexts(line)).toEqual(["hel", "lo", "goodbye", "moon"]);
  });
});
