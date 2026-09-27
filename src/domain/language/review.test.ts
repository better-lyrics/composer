import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import {
  confirmTransliterationAlignment,
  getLanguageReviewItems,
  getLanguageReviewTracks,
  isTransliterationSourceStale,
} from "@/domain/language/review";
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
        tracks: [
          { kind: "transliteration", reasons: ["source-changed"] },
          { kind: "translation", language: "en", reasons: ["source-changed"] },
        ],
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

function reviewLine(): LyricLine {
  return {
    id: "review",
    agentId: "v1",
    text: "가나",
    backgroundText: "다라",
    transliteration: {
      language: "ko-Latn",
      text: "gana",
      backgroundText: "dara",
      segments: [],
      origin: "manual",
      sourceFingerprint: "old-source",
      alignmentStatus: "needs-review",
      backgroundAlignmentStatus: "inferred",
      stale: true,
    },
  };
}

describe("transliteration review", () => {
  it("distinguishes inferred alignment from alignment needing review", () => {
    const line = reviewLine();
    line.transliteration!.sourceFingerprint = languageSourceFingerprint(line.text, line.backgroundText);
    expect(getLanguageReviewTracks(line)).toEqual([{ kind: "transliteration", reasons: ["alignment"] }]);
    line.transliteration!.alignmentStatus = "inferred";
    expect(getLanguageReviewTracks(line)).toEqual([]);
  });

  it("reports both causes when the source changed and boundaries need checking", () => {
    expect(getLanguageReviewTracks(reviewLine())).toEqual([
      { kind: "transliteration", reasons: ["source-changed", "alignment"] },
    ]);
  });

  it("acknowledges only the side that was aligned, even if the other had a confirmed mapping", () => {
    const line = reviewLine();
    line.transliteration!.backgroundAlignmentStatus = "confirmed";
    line.transliteration = confirmTransliterationAlignment(line, "words");
    expect(isTransliterationSourceStale(line, "words")).toBe(false);
    expect(isTransliterationSourceStale(line, "backgroundWords")).toBe(true);
    expect(line.transliteration!.sourceFingerprint).toBe("old-source");
    expect(getLanguageReviewTracks(line)).toEqual([{ kind: "transliteration", reasons: ["source-changed"] }]);
  });

  it("refreshes the shared fingerprint after both sides are reviewed, in either order", () => {
    for (const first of ["words", "backgroundWords"] as const) {
      const line = reviewLine();
      line.transliteration = confirmTransliterationAlignment(line, first);
      line.transliteration = confirmTransliterationAlignment(line, first === "words" ? "backgroundWords" : "words");
      expect(line.transliteration!.sourceFingerprint).toBe(languageSourceFingerprint(line.text, line.backgroundText));
      expect(line.transliteration!.reviewedSourceFingerprint).toBeUndefined();
      expect(line.transliteration!.backgroundReviewedSourceFingerprint).toBeUndefined();
      expect(line.transliteration!.stale).toBeUndefined();
      expect(getLanguageReviewTracks(line)).toEqual([]);
    }
  });

  it("does not clear an independent alignment warning when the source is already current", () => {
    const line = reviewLine();
    line.transliteration!.sourceFingerprint = languageSourceFingerprint(line.text, line.backgroundText);
    line.transliteration!.backgroundAlignmentStatus = "needs-review";
    line.transliteration = confirmTransliterationAlignment(line, "words");
    expect(getLanguageReviewTracks(line)).toEqual([{ kind: "transliteration", reasons: ["alignment"] }]);
  });

  it("refreshes a single populated side without reviewing empty background content", () => {
    const line = reviewLine();
    line.transliteration!.backgroundText = undefined;
    line.transliteration = confirmTransliterationAlignment(line, "words");
    expect(line.transliteration!.sourceFingerprint).toBe(languageSourceFingerprint(line.text, line.backgroundText));
    expect(getLanguageReviewTracks(line)).toEqual([]);
  });

  it("invalidates a side acknowledgement when the lyrics change again", () => {
    const line = reviewLine();
    line.transliteration = confirmTransliterationAlignment(line, "words");
    line.text = "마나";
    expect(isTransliterationSourceStale(line, "words")).toBe(true);
  });
});
