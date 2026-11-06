import { sungTransliteration } from "@/domain/alignment/transliteration";
import type { LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";

function line(text: string, transliteration?: string, extra: Partial<LyricLine> = {}): LyricLine {
  return {
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
  } as LyricLine;
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
    stale.transliteration!.stale = true;
    expect(sungTransliteration(stale)).toBeNull();
  });

  it("joins per-word transliterations when the track has no text", () => {
    const words = [
      { text: "完", begin: 0, end: 1, transliteration: "ka" },
      { text: "璧", begin: 1, end: 2, transliteration: "n peki" },
    ];
    const withWords = line("完璧", "", { words, begin: undefined, end: undefined } as Partial<LyricLine>);
    expect(sungTransliteration(withWords)).toBe("ka n peki");
  });
});
