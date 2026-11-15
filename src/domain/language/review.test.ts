import { describe, expect, it } from "vitest";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { LineLanguage } from "@/domain/language/model";
import {
  alignmentNeedsReview,
  confirmTransliterationAlignment,
  getLanguageReviewItems,
  getLanguageReviewTracks,
  isTransliterationSourceStale,
} from "@/domain/language/review";
import type { V3TransliterationTrack } from "@/domain/language/v3-languages";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import { withFields } from "@/test/field-updates";
import { legacyLine, legacyTrack } from "@/test/legacy-languages";

describe("getLanguageReviewItems", () => {
  it("reports stale alternate-language tracks by line", () => {
    const lines: LyricLine[] = [
      legacyLine({
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
      }),
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
      legacyLine({
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
      }),
    ];

    expect(getLanguageReviewItems(lines)).toEqual([]);
  });
});

describe("alignmentNeedsReview", () => {
  const track = (overrides: Partial<V3TransliterationTrack>): LineLanguage =>
    legacyTrack({
      language: "ja-Latn",
      text: "kimi",
      backgroundText: "sora",
      segments: [],
      origin: "manual",
      sourceFingerprint: "fp",
      ...overrides,
    });

  it("flags the main part when its alignment needs review", () => {
    expect(alignmentNeedsReview(track({ alignmentStatus: "needs-review" }), "main")).toBe(true);
    expect(alignmentNeedsReview(track({ alignmentStatus: "needs-review" }), "background")).toBe(false);
  });

  it("flags the background part when its alignment needs review", () => {
    expect(alignmentNeedsReview(track({ backgroundAlignmentStatus: "needs-review" }), "background")).toBe(true);
    expect(alignmentNeedsReview(track({ backgroundAlignmentStatus: "needs-review" }), "main")).toBe(false);
  });

  describe("edge cases", () => {
    it("is false without a track", () => {
      expect(alignmentNeedsReview(undefined, "main")).toBe(false);
      expect(alignmentNeedsReview(undefined, "background")).toBe(false);
    });

    it("is false for every settled status", () => {
      for (const status of ["confirmed", "inferred", "unresolved", undefined] as const) {
        expect(
          alignmentNeedsReview(track({ alignmentStatus: status, backgroundAlignmentStatus: status }), "main"),
        ).toBe(false);
        expect(
          alignmentNeedsReview(track({ alignmentStatus: status, backgroundAlignmentStatus: status }), "background"),
        ).toBe(false);
      }
    });
  });
});

function reviewLine(): LyricLine {
  return legacyLine({
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
  });
}

function transliterationOf(line: LyricLine): LineLanguage {
  const track = line.languages?.transliteration;
  if (!track) throw new Error("line has no transliteration");
  return track;
}

function backgroundOf(line: LyricLine): NonNullable<LineLanguage["bg"]> {
  const background = transliterationOf(line).bg;
  if (!background) throw new Error("line has no background transliteration");
  return background;
}

function confirmed(line: LyricLine, field: "words" | "backgroundWords"): LyricLine["languages"] {
  return { transliteration: confirmTransliterationAlignment(line, field) };
}

describe("transliteration review", () => {
  it("distinguishes inferred alignment from alignment needing review", () => {
    const line = reviewLine();
    transliterationOf(line).sourceFingerprint = languageSourceFingerprint(lineText(line), backgroundText(line));
    expect(getLanguageReviewTracks(line)).toEqual([{ kind: "transliteration", reasons: ["alignment"] }]);
    transliterationOf(line).main.alignmentStatus = "inferred";
    expect(getLanguageReviewTracks(line)).toEqual([]);
  });

  it("reports both causes when the source changed and boundaries need checking", () => {
    expect(getLanguageReviewTracks(reviewLine())).toEqual([
      { kind: "transliteration", reasons: ["source-changed", "alignment"] },
    ]);
  });

  it("acknowledges only the side that was aligned, even if the other had a confirmed mapping", () => {
    const line = reviewLine();
    backgroundOf(line).alignmentStatus = "confirmed";
    line.languages = confirmed(line, "words");
    expect(isTransliterationSourceStale(line, "words")).toBe(false);
    expect(isTransliterationSourceStale(line, "backgroundWords")).toBe(true);
    expect(transliterationOf(line).sourceFingerprint).toBe("old-source");
    expect(getLanguageReviewTracks(line)).toEqual([{ kind: "transliteration", reasons: ["source-changed"] }]);
  });

  it("refreshes the shared fingerprint after both sides are reviewed, in either order", () => {
    for (const first of ["words", "backgroundWords"] as const) {
      const line = reviewLine();
      line.languages = confirmed(line, first);
      line.languages = confirmed(line, first === "words" ? "backgroundWords" : "words");
      expect(transliterationOf(line).sourceFingerprint).toBe(
        languageSourceFingerprint(lineText(line), backgroundText(line)),
      );
      expect(transliterationOf(line).main.reviewedSourceFingerprint).toBeUndefined();
      expect(transliterationOf(line).bg?.reviewedSourceFingerprint).toBeUndefined();
      expect(transliterationOf(line).stale).toBeUndefined();
      expect(getLanguageReviewTracks(line)).toEqual([]);
    }
  });

  it("does not clear an independent alignment warning when the source is already current", () => {
    const line = reviewLine();
    transliterationOf(line).sourceFingerprint = languageSourceFingerprint(lineText(line), backgroundText(line));
    backgroundOf(line).alignmentStatus = "needs-review";
    line.languages = confirmed(line, "words");
    expect(getLanguageReviewTracks(line)).toEqual([{ kind: "transliteration", reasons: ["alignment"] }]);
  });

  it("refreshes a single populated side without reviewing empty background content", () => {
    const line = reviewLine();
    delete backgroundOf(line).text;
    line.languages = confirmed(line, "words");
    expect(transliterationOf(line).sourceFingerprint).toBe(
      languageSourceFingerprint(lineText(line), backgroundText(line)),
    );
    expect(getLanguageReviewTracks(line)).toEqual([]);
  });

  it("invalidates a side acknowledgement when the lyrics change again", () => {
    const line = reviewLine();
    line.languages = confirmed(line, "words");
    line.tracks = withFields(line, { text: "마나" }).tracks;
    expect(isTransliterationSourceStale(line, "words")).toBe(true);
  });
});
