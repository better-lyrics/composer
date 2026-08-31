import { migrateLegacyTransliterationLine } from "@/domain/language/migrate";
import { type LooseLine, type LyricLine, reconcileLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";

function legacyLine(overrides: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({
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
    const migrated = migrateLegacyTransliterationLine(legacyLine());

    expect(migrated.transliteration?.text).toBe("geol eum eun  Like  a  dance");
    expect(migrated.transliteration?.alignmentStatus).toBe("confirmed");
  });

  it("uses complete timed mappings instead of reinterpreting their display text", () => {
    const migrated = migrateLegacyTransliterationLine(
      legacyLine({
        text: "今日",
        words: [
          { text: "今", begin: 0, end: 0.5, transliteration: "kyou", transliterationJoinerAfter: "" },
          { text: "日", begin: 0.5, end: 1, transliteration: "hi" },
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

    expect(migrated.transliteration?.text).toBe("kyouhi");
    expect(migrated.words?.map((word) => word.transliteration)).toEqual(["kyou", "hi"]);
  });

  it("preserves potentially literal dashes and asks for review", () => {
    const migrated = migrateLegacyTransliterationLine(
      legacyLine({
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

    expect(migrated.transliteration?.text).toBe("to-do");
    expect(migrated.transliteration?.alignmentStatus).toBe("needs-review");
  });

  it("does not treat a partial timed prefix as a complete mapping", () => {
    const migrated = migrateLegacyTransliterationLine(
      legacyLine({
        text: "안녕 하세요",
        words: [{ text: "안녕 ", begin: 0, end: 1, transliteration: "stale" }],
        transliteration: {
          language: "ko-Latn",
          text: "an-nyeong haseyo",
          segments: [],
          origin: "google",
          sourceFingerprint: "legacy",
        },
      }),
    );

    expect(migrated.transliteration?.text).toBe("an nyeong  haseyo");
  });
});
