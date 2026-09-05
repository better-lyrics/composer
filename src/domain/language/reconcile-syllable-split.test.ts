import { reconcileTransliterationAfterSyllableSplit } from "@/domain/language/reconcile-syllable-split";
import type { LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";

const track = {
  language: "ko-Latn",
  text: "Uh  ildan eun  na",
  segments: [{ original: "Uh 일단은 나", transliteration: "Uh  ildan eun  na" }],
  origin: "google" as const,
  sourceFingerprint: "source",
};

describe("reconcileTransliterationAfterSyllableSplit", () => {
  it("writes manually selected timing boundaries back to the canonical transliteration", () => {
    const line: LyricLine = {
      id: "line",
      agentId: "v1",
      text: "Uh 일단은 나",
      words: [
        { text: "Uh ", begin: 0, end: 0.5, transliteration: "Uh" },
        { text: "일단은 ", begin: 0.5, end: 1.5, transliteration: "ildan eun" },
        { text: "나", begin: 1.5, end: 2, transliteration: "na" },
      ],
      transliteration: track,
    };

    const result = reconcileTransliterationAfterSyllableSplit(line, "words", 1, [
      {
        text: "일",
        begin: 0.5,
        end: 0.8,
        transliteration: "i",
        transliterationJoinerAfter: "",
        syllableGroupId: "group",
      },
      {
        text: "단",
        begin: 0.8,
        end: 1.1,
        transliteration: "ldan",
        transliterationJoinerAfter: " ",
        syllableGroupId: "group",
      },
      { text: "은 ", begin: 1.1, end: 1.5, transliteration: "eun", syllableGroupId: "group" },
    ]);

    expect(result?.text).toBe("Uh  ildan eun  na");
    expect(result?.segments).toEqual([{ original: line.text, transliteration: "Uh  ildan eun  na" }]);
    expect(result?.origin).toBe("manual");
  });

  it("rebuilds the whole syllable group when an existing syllable is split again", () => {
    const line: LyricLine = {
      id: "line",
      agentId: "v1",
      text: "일|단은",
      words: [
        { text: "일", begin: 0, end: 0.5, transliteration: "il", syllableGroupId: "group" },
        { text: "단은", begin: 0.5, end: 1, transliteration: "daneun", syllableGroupId: "group" },
      ],
      transliteration: { ...track, text: "il daneun" },
    };

    const result = reconcileTransliterationAfterSyllableSplit(line, "words", 0, [
      {
        text: "ㅇ",
        begin: 0,
        end: 0.25,
        transliteration: "i",
        transliterationJoinerAfter: "",
        syllableGroupId: "group",
      },
      { text: "ㄹ", begin: 0.25, end: 0.5, transliteration: "l", syllableGroupId: "group" },
    ]);

    expect(result?.text).toBe("il daneun");
  });

  it("leaves the track alone when a replacement syllable has no transliteration", () => {
    const line: LyricLine = {
      id: "line",
      agentId: "v1",
      text: "일단은",
      words: [{ text: "일단은", begin: 0, end: 1, transliteration: "ildan eun" }],
      transliteration: { ...track, text: "ildan eun" },
    };

    expect(
      reconcileTransliterationAfterSyllableSplit(line, "words", 0, [
        { text: "일", begin: 0, end: 0.5, transliteration: "il" },
        { text: "단은", begin: 0.5, end: 1 },
      ]),
    ).toBeNull();
  });
});
