import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { alignmentNeedsReview, getLanguageReviewItems } from "@/domain/language/review";
import type { TransliterationTrack } from "@/domain/language/model";
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

describe("alignmentNeedsReview", () => {
  const track = (overrides: Partial<TransliterationTrack>): TransliterationTrack => ({
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
        expect(alignmentNeedsReview(track({ alignmentStatus: status, backgroundAlignmentStatus: status }), "main")).toBe(false);
        expect(alignmentNeedsReview(track({ alignmentStatus: status, backgroundAlignmentStatus: status }), "background")).toBe(
          false,
        );
      }
    });
  });
});
