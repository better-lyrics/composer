import { describe, expect, it } from "vitest";
import { migrateLegacyTransliterationLine } from "@/domain/language/migrate";
import type { LyricLine } from "@/domain/line/model";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { type LegacyLine, legacyLine, legacyWords } from "@/test/legacy-languages";

function oldLine(overrides: Partial<LegacyLine> = {}): LyricLine {
  return legacyLine({
    id: "legacy",
    text: "걸음은 Like a dance",
    agentId: "v1",
    transliteration: {
      language: "ko-Latn",
      text: "geol-eum-eun Like a dance",
      segments: [],
      origin: "google",
      sourceFingerprint: "legacy",
    },
    ...overrides,
  });
}

describe("legacy transliteration migration", () => {
  it("turns old Google dashes into pronunciation spaces and old spaces into word spaces", () => {
    const migrated = migrateLegacyTransliterationLine(oldLine());

    expect(migrated.languages?.transliteration?.main.text).toBe("geol eum eun  Like  a  dance");
    expect(migrated.languages?.transliteration?.main.alignmentStatus).toBe("inferred");
  });

  it("uses complete timed mappings instead of reinterpreting their display text", () => {
    const migrated = migrateLegacyTransliterationLine(
      oldLine({
        text: "今日",
        words: [
          {
            id: "w1",
            text: "今",
            sep: "",
            begin: 0,
            end: 0.5,
            transliteration: "kyou",
            transliterationJoinerAfter: "",
            joinsNext: true,
          },
          { id: "w2", text: "日", sep: "", begin: 0.5, end: 1, transliteration: "hi", joinsNext: false },
        ],
        transliteration: {
          language: "ja-Latn",
          text: "kyou-hi",
          segments: [],
          origin: "manual",
          sourceFingerprint: "legacy",
        },
      }),
    );

    expect(migrated.languages?.transliteration?.main.text).toBe("kyouhi");
    expect(
      legacyWords(timedSyllables(mainTrack(migrated)), migrated.languages)?.map((word) => word.transliteration),
    ).toEqual(["kyou", "hi"]);
  });

  it("preserves potentially literal dashes and asks for review", () => {
    const migrated = migrateLegacyTransliterationLine(
      oldLine({
        text: "to-do",
        transliteration: {
          language: "en-Latn",
          text: "to-do",
          segments: [],
          origin: "manual",
          sourceFingerprint: "legacy",
        },
      }),
    );

    expect(migrated.languages?.transliteration?.main.text).toBe("to-do");
    expect(migrated.languages?.transliteration?.main.alignmentStatus).toBe("needs-review");
  });

  it("does not treat a partial timed prefix as a complete mapping", () => {
    const migrated = migrateLegacyTransliterationLine(
      oldLine({
        text: "안녕 하세요",
        words: [{ id: "w3", text: "안녕", sep: " ", begin: 0, end: 1, transliteration: "stale", joinsNext: false }],
        transliteration: {
          language: "ko-Latn",
          text: "an-nyeong haseyo",
          segments: [],
          origin: "google",
          sourceFingerprint: "legacy",
        },
      }),
    );

    expect(migrated.languages?.transliteration?.main.text).toBe("an nyeong  haseyo");
  });
});
