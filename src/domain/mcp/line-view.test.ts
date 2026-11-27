import { describe, expect, it } from "vitest";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { lineView } from "@/domain/mcp/line-view";
import { createLine } from "@/test/factories";

function autoAlignedLine(text: string, syllables: string[], reading: string) {
  const line = createLine({
    text,
    words: syllables.map((syllable, index) => ({ text: syllable, begin: index, end: index + 1 })),
  });
  return {
    ...line,
    transliteration: {
      language: "ko-Latn",
      text: reading,
      segments: [{ original: text, transliteration: reading }],
      origin: "import" as const,
      sourceFingerprint: languageSourceFingerprint(line.text),
      alignmentStatus: "inferred" as const,
    },
  };
}

describe("lineView", () => {
  it("regression: shows the split Composer estimates for syllables auto-align left without a saved reading", () => {
    const exact = lineView(autoAlignedLine("바|람|이", ["바", "람", "이"], "ba ram i"), 0);
    expect(exact.syllables?.map((syllable) => syllable.transliteration)).toEqual(["ba", "ram", "i"]);
    expect(exact.issues).toEqual([]);

    const estimated = lineView(autoAlignedLine("바|람|이", ["바", "람", "이"], "barami"), 0);
    expect(estimated.syllables?.every((syllable) => syllable.transliteration)).toBe(true);
    expect(estimated.issues).toEqual(["transliteration-alignment-needs-review"]);
  });
});
