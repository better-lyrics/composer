import { getLanguageDisplayLine } from "@/domain/language/display";
import type { LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";

const line: LyricLine = {
  id: "mixed",
  agentId: "v1",
  text: "걸음은 Like a dance",
  words: [
    { text: "걸음은 ", begin: 0, end: 1 },
    { text: "Like ", begin: 1, end: 2 },
    { text: "a ", begin: 2, end: 3 },
    { text: "dance", begin: 3, end: 4 },
  ],
  transliteration: {
    language: "ko-Latn",
    text: "geol eum eun  Like  a  dance",
    segments: [{ original: "걸음은 Like a dance", transliteration: "geol eum eun  Like  a  dance" }],
    origin: "google",
    sourceFingerprint: "test",
  },
};

describe("language display alignment", () => {
  it("keeps romanized syllables on their canonical source-word timing slot", () => {
    const display = getLanguageDisplayLine(line, "transliteration");
    expect(display.text).toBe("geol eum eun  Like  a  dance");
    expect(display.wordTexts).toEqual(["geol eum eun  ", "Like  ", "a  ", "dance"]);
    expect(display.words?.map((word) => word.text)).toEqual(line.words.map((word) => word.text));
  });

  it("returns canonical content in original mode", () => {
    expect(getLanguageDisplayLine(line, "original")).toMatchObject({ text: line.text, words: line.words });
  });

  it("keeps all labels visible while only the timed prefix has timing", () => {
    const partial = { ...line, words: line.words.slice(0, 1) } satisfies LyricLine;
    const display = getLanguageDisplayLine(partial, "transliteration");
    expect(display.wordTexts).toEqual(["geol eum eun", "Like", "a", "dance"]);
    expect(display.words).toHaveLength(1);
    expect(display.words?.[0].transliteration).toBe("geol eum eun");
  });

  it("uses canonical timed-word transliterations when provider segments cannot be realigned", () => {
    const mismatched: LyricLine = {
      id: "canonical-words",
      agentId: "v1",
      text: "한국 노래",
      words: [
        { text: "한국 ", transliteration: "hanguk", begin: 0, end: 1 },
        { text: "노래", transliteration: "norae", begin: 1, end: 2 },
      ],
      transliteration: {
        language: "ko-Latn",
        text: "hanguknorae",
        segments: [{ original: "한국 노래", transliteration: "hanguknorae" }],
        origin: "import",
        sourceFingerprint: "test",
      },
    };

    const display = getLanguageDisplayLine(mismatched, "transliteration");

    expect(display.wordTexts).toEqual(["hanguk", "norae"]);
    expect(display.words?.map((word) => word.transliteration)).toEqual(["hanguk", "norae"]);
  });
});
