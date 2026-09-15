import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { getLanguageReviewItems } from "@/domain/language/review";
import type { LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";

describe("getLanguageReviewItems", () => {
  it("reports stale alternate-language tracks by line", () => {
    const lines: LyricLine[] = [
      {
        id: "l1",
        text: "changed lyric",
        agentId: "v1",
        transliteration: {
          language: "ko-Latn",
          text: "romanization",
          segments: [],
          origin: "manual",
          sourceFingerprint: "old-source",
        },
        translations: {
          en: {
            language: "en",
            text: "Translation",
            origin: "manual",
            sourceFingerprint: "old-source",
          },
        },
      },
    ];

    expect(getLanguageReviewItems(lines)).toEqual([
      {
        lineId: "l1",
        lineIndex: 0,
        text: "changed lyric",
        tracks: [{ kind: "transliteration" }, { kind: "translation", language: "en" }],
      },
    ]);
  });

  it("ignores stale flags when the source fingerprint still matches", () => {
    const fingerprint = languageSourceFingerprint("to-do");
    const lines: LyricLine[] = [
      {
        id: "l1",
        text: "to-|do",
        agentId: "v1",
        transliteration: {
          language: "en-Latn",
          text: "to-do",
          segments: [],
          origin: "manual",
          sourceFingerprint: fingerprint,
          stale: true,
        },
      },
    ];

    expect(getLanguageReviewItems(lines)).toEqual([]);
  });
});
