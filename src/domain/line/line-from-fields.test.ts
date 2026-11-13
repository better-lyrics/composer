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

  it("regression: keeps the untimed rest of unspaced CJK text", () => {
    const timed = createWords(
      ["我", "们", "今", "天"].map((text, index) => ({ text, sep: "", begin: index, end: index + 1, joinsNext: true })),
    );
    const line = lineFromFields({ id: "l1", agentId: "v1", text: "我们今天好", words: timed }, "|");
    expect(syllableTexts(line)).toEqual(["我", "们", "今", "天", "好"]);
  });

  it("keeps the text words after the ones the timed words cover when the words do not spell them", () => {
    const line = lineFromFields({ id: "l1", agentId: "v1", text: "goodbye moon tonight", words: helLo() }, "|");
    expect(syllableTexts(line)).toEqual(["hel", "lo", "moon", "tonight"]);
  });

  describe("a fully synced line adds nothing", () => {
    const words = (...texts: string[]) =>
      createWords(
        texts.map((text, index) => ({ text, sep: index < texts.length - 1 ? " " : "", begin: index, end: index + 1 })),
      );
    const loaded = (text: string, timed: ReturnType<typeof words>) =>
      syllableTexts(lineFromFields({ id: "l1", agentId: "v1", text, words: timed }, "|"));

    it("regression: words that differ from the text only in case", () => {
      expect(loaded("Hello world", words("Hello", "World"))).toEqual(["Hello", "World"]);
    });

    it("regression: words and text in different Unicode normal forms", () => {
      expect(loaded("cafe\u0301 noir", words("caf\u00e9", "noir"))).toEqual(["caf\u00e9", "noir"]);
    });

    it("regression: text with punctuation the words do not carry", () => {
      expect(loaded("hello world!", words("hello", "world"))).toEqual(["hello", "world"]);
    });
  });
});

describe("syllable ids", () => {
  it("regression: untimed syllables never take the id of a timed syllable rebuilt with them", () => {
    const loaded = lineFromFields({ id: "l1", agentId: "v1", text: "a b" });
    const [first] = mainTrack(loaded).syllables;
    const words = [{ ...first, begin: 1, end: 2 }];
    const rebuilt = lineFromFields({ id: "l1", agentId: "v1", text: "a b c d", words });
    const ids = mainTrack(rebuilt).syllables.map((syllable) => syllable.id);
    expect(mainTrack(rebuilt).syllables.map((syllable) => syllable.text)).toEqual(["a", "b", "c", "d"]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
