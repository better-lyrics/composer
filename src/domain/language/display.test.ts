import { describe, expect, it } from "vitest";
import { getLanguageDisplayLine } from "@/domain/language/display";
import { fieldsOfLine, lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { legacyLanguages, legacyLine, legacyWords } from "@/test/legacy-languages";

const line: LyricLine = legacyLine({
  id: "mixed",
  agentId: "v1",
  text: "걸음은 Like a dance",
  words: [
    { id: "w1", text: "걸음은", sep: " ", begin: 0, end: 1, joinsNext: false },
    { id: "w2", text: "Like", sep: " ", begin: 1, end: 2, joinsNext: false },
    { id: "w3", text: "a", sep: " ", begin: 2, end: 3, joinsNext: false },
    { id: "w4", text: "dance", sep: "", begin: 3, end: 4, joinsNext: false },
  ],
  transliteration: {
    language: "ko-Latn",
    text: "geol eum eun  Like  a  dance",
    segments: [{ original: "걸음은 Like a dance", transliteration: "geol eum eun  Like  a  dance" }],
    origin: "google",
    sourceFingerprint: "test",
  },
});

describe("language display alignment", () => {
  it("includes literal dashes in untimed Sync labels as well as timed foreground and background slots", () => {
    const words = [
      {
        id: "w5",
        text: "空",
        sep: "",
        begin: 0,
        end: 1,
        transliteration: "so",
        transliterationJoinerAfter: "-",
        joinsNext: true,
      },
      { id: "w6", text: "風", sep: "", begin: 1, end: 2, transliteration: "ra", joinsNext: false },
    ];
    const dashed: LyricLine = legacyLine({
      ...fieldsOfLine(line),
      text: "空|風",
      words,
      backgroundText: "空|風",
      backgroundWords: words,
      transliteration: { ...legacyLanguages(line.languages).transliteration!, text: "so-ra", backgroundText: "so-ra" },
    });
    const before = structuredClone(dashed);
    for (const candidate of [dashed, lineFromFields({ ...fieldsOfLine(dashed), words: [], backgroundWords: [] })]) {
      const display = getLanguageDisplayLine(candidate, "transliteration");
      expect(display.wordTexts).toEqual(["so-", "ra"]);
      expect(display.backgroundWordTexts).toEqual(["so-", "ra"]);
    }
    expect(dashed).toEqual(before);
  });

  it("displays a background-only alternate while retaining the original foreground", () => {
    const backgroundOnly: LyricLine = legacyLine({
      ...fieldsOfLine(line),
      text: "Hello",
      words: [{ id: "w7", text: "Hello", sep: "", begin: 1, end: 2, transliteration: "stale", joinsNext: false }],
      backgroundText: "空",
      backgroundWords: [{ id: "w8", text: "空", sep: "", begin: 1, end: 2, joinsNext: false }],
      transliteration: {
        ...legacyLanguages(line.languages).transliteration!,
        text: "",
        backgroundText: "sora",
        segments: [],
      },
    });
    const display = getLanguageDisplayLine(backgroundOnly, "transliteration");
    expect(display.text).toBe("Hello");
    expect(display.wordTexts).toBeUndefined();
    expect(legacyWords(display.words, display.languages)?.[0].transliteration).toBeUndefined();
    expect(display.backgroundText).toBe("sora");
    expect(display.backgroundWordTexts).toEqual(["sora"]);
  });

  it("keeps romanized syllables on their canonical source-word timing slot", () => {
    const display = getLanguageDisplayLine(line, "transliteration");
    expect(display.text).toBe("geol eum eun  Like  a  dance");
    expect(display.wordTexts).toEqual(["geol eum eun  ", "Like  ", "a  ", "dance"]);
    expect(display.words?.map((word) => word.text)).toEqual(timedSyllables(mainTrack(line)).map((word) => word.text));
  });

  it("returns canonical content in original mode", () => {
    expect(getLanguageDisplayLine(line, "original")).toMatchObject({
      text: lineText(line),
      words: timedSyllables(mainTrack(line)),
    });
  });

  it("keeps all labels visible while only the timed prefix has timing", () => {
    const partial = lineFromFields({ ...fieldsOfLine(line), words: timedSyllables(mainTrack(line)).slice(0, 1) });
    const display = getLanguageDisplayLine(partial, "transliteration");
    expect(display.wordTexts).toEqual(["geol eum eun", "Like", "a", "dance"]);
    expect(display.words).toHaveLength(1);
    expect(legacyWords(display.words, display.languages)?.[0].transliteration).toBe("geol eum eun");
  });

  it("uses canonical timed-word transliterations when provider segments cannot be realigned", () => {
    const mismatched: LyricLine = legacyLine({
      id: "canonical-words",
      agentId: "v1",
      text: "한국 노래",
      words: [
        { id: "w9", text: "한국", sep: " ", transliteration: "hanguk", begin: 0, end: 1, joinsNext: false },
        { id: "w10", text: "노래", sep: "", transliteration: "norae", begin: 1, end: 2, joinsNext: false },
      ],
      transliteration: {
        language: "ko-Latn",
        text: "hanguknorae",
        segments: [{ original: "한국 노래", transliteration: "hanguknorae" }],
        origin: "import",
        sourceFingerprint: "test",
      },
    });

    const display = getLanguageDisplayLine(mismatched, "transliteration");

    expect(display.wordTexts).toEqual(["hanguk", "norae"]);
    expect(legacyWords(display.words, display.languages)?.map((word) => word.transliteration)).toEqual([
      "hanguk",
      "norae",
    ]);
  });
});
