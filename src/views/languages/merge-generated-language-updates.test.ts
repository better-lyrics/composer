import { describe, expect, it } from "vitest";
import { withTrackPieces } from "@/domain/language/pieces";
import type { LyricLine } from "@/domain/line/model";
import { legacyLine } from "@/test/legacy-languages";
import { mergeGeneratedLanguageUpdates } from "@/views/languages/merge-generated-language-updates";

const original = legacyLine({
  id: "line",
  agentId: "v1",
  text: "하늘",
  words: [{ id: "w1", text: "하늘", sep: "", begin: 0, end: 1, transliteration: "haneul", joinsNext: false }],
  transliteration: {
    language: "ko-Latn",
    text: "haneul",
    segments: [],
    origin: "google",
    sourceFingerprint: "older source",
  },
});

describe("mergeGeneratedLanguageUpdates", () => {
  it("skips a line whose syllable readings changed while the request ran", () => {
    const track = original.languages?.transliteration;
    if (!track) throw new Error("fixture has a romanization");
    const edited: LyricLine = {
      ...original,
      languages: { transliteration: withTrackPieces(track, "main", { w1: { text: "ha-neul" } }) },
    };
    const updates = mergeGeneratedLanguageUpdates(
      new Map([[original.id, original]]),
      [edited],
      [],
      {
        force: true,
        transliteration: {
          language: "ko-Latn",
          main: new Map([["line", { id: "line", text: "haneul", segments: [] }]]),
          background: new Map(),
        },
        translations: [],
      },
      { transliteration: new Set(), translations: new Map() },
    );
    expect(updates).toEqual([]);
  });
});
