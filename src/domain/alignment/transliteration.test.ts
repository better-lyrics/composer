import { sungTransliteration } from "@/domain/alignment/transliteration";
import type { LyricLine } from "@/domain/line/model";
import { type LegacyLine, legacyLine } from "@/test/legacy-languages";
import { describe, expect, it } from "vitest";

function line(text: string, transliteration?: string, extra: Partial<LegacyLine> = {}): LyricLine {
  return legacyLine({
    id: "L1",
    agentId: "v1",
    text,
    begin: 0,
    end: 1,
    ...(transliteration !== undefined && {
      transliteration: {
        language: "ja-Latn",
        text: transliteration,
        segments: [],
        origin: "import",
        sourceFingerprint: "x",
      },
    }),
    ...extra,
  } as LegacyLine);
}

describe("sungTransliteration", () => {
  it("uses a romanization that differs from the line", () => {
    expect(sungTransliteration(line("運命", "sadame"))).toBe("sadame");
  });

  it("ignores a transliteration that is just the line again", () => {
    expect(sungTransliteration(line("You're pushing me away", "You're  pushing  me  away"))).toBeNull();
  });

  it("ignores stale and missing transliterations", () => {
    expect(sungTransliteration(line("運命"))).toBeNull();
    const stale = line("運命", "sadame");
    const track = stale.languages?.transliteration;
    expect(track).toBeDefined();
    const staleTrack = track && { ...track, stale: true };
    expect(sungTransliteration({ ...stale, languages: { transliteration: staleTrack } })).toBeNull();
  });

  it("joins per-word transliterations when the track has no text", () => {
    const words = [
      { id: "w1", text: "完", sep: "", begin: 0, end: 1, transliteration: "ka", joinsNext: true },
      { id: "w2", text: "璧", sep: "", begin: 1, end: 2, transliteration: "n peki", joinsNext: false },
    ];
    const withWords = line("完璧", "", { words, begin: undefined, end: undefined });
    expect(sungTransliteration(withWords)).toBe("ka n peki");
  });
});
