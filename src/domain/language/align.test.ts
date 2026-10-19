import { mappedTransliteration, planTransliterationAlignment, withAlignedWords } from "@/domain/language/align";
import type { LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";

describe("transliteration alignment", () => {
  it("removes cached fragments and joiners when alternate text is cleared", () => {
    expect(
      planTransliterationAlignment(
        [{ text: "今日", begin: 1, end: 2, transliteration: "kyou", transliterationJoinerAfter: " " }],
        "",
      ).words,
    ).toEqual([{ text: "今日", begin: 1, end: 2 }]);
  });

  it("maps explicit pronunciation and word spaces to timing slots", () => {
    const words = [
      { text: "걸", begin: 0, end: 0.2 },
      { text: "음", begin: 0.2, end: 0.4 },
      { text: "은 ", begin: 0.4, end: 0.6 },
      { text: "Like", begin: 0.6, end: 1 },
    ];
    const plan = planTransliterationAlignment(words, "geol eum eun  Like");
    expect(plan.status).toBe("inferred");
    expect(plan.words.map((word) => word.transliteration)).toEqual(["geol", "eum", "eun", "Like"]);
    expect(plan.words.slice(0, -1).map((word) => word.transliterationJoinerAfter)).toEqual([" ", " ", "  "]);
  });

  it("allows Google word spaces inside an unspaced original group", () => {
    const words = [{ text: "こんにちは世界", begin: 0, end: 2 }];
    const plan = planTransliterationAlignment(words, "Kon'nichiwa  sekai");
    expect(plan.status).toBe("inferred");
    expect(plan.words[0].transliteration).toBe("Kon'nichiwa  sekai");
  });

  it("keeps a proportional mapping as reviewable rather than changing display text", () => {
    const words = ["붙", "어", "있", "던"].map((text, index) => ({ text, begin: index, end: index + 1 }));
    const plan = planTransliterationAlignment(words, "but eoissdeon");
    expect(plan.status).toBe("needs-review");
    expect(mappedTransliteration(plan.words)).toBe("but eoissdeon");
  });

  it("reports an unresolved mapping when there are too few graphemes", () => {
    const words = ["가", "나", "다"].map((text, index) => ({ text, begin: index, end: index + 1 }));
    expect(planTransliterationAlignment(words, "a").status).toBe("unresolved");
  });

  it("preserves an existing confirmed mapping", () => {
    const words = [
      { text: "今", begin: 0, end: 1, transliteration: "kyou", transliterationJoinerAfter: "" },
      { text: "日", begin: 1, end: 2, transliteration: "hi" },
    ];
    const plan = planTransliterationAlignment(words, "kyouhi");
    expect(plan.status).toBe("confirmed");
    expect(plan.words).toBe(words);
  });
});

describe("withAlignedWords", () => {
  const koreanLine: LyricLine = {
    id: "line",
    agentId: "v1",
    text: "Uh 일단은 나",
    words: [
      { text: "Uh ", begin: 0, end: 0.5, transliteration: "Oh" },
      { text: "일단은 ", begin: 0.5, end: 1.5, transliteration: "ildaneun" },
      { text: "나", begin: 1.5, end: 2, transliteration: "nah" },
    ],
    backgroundText: "그래 yeah",
    backgroundWords: [
      { text: "그래 ", begin: 2, end: 2.5 },
      { text: "yeah", begin: 2.5, end: 3 },
    ],
    transliteration: {
      language: "ko-Latn",
      text: "Uh  ildan eun  na",
      backgroundText: "geurae  yeah",
      segments: [{ original: "Uh 일단은 나", transliteration: "Uh  ildan eun  na" }],
      origin: "google",
      sourceFingerprint: "source",
      alignmentStatus: "confirmed",
    },
  };

  it("returns the same line when there is no transliteration track", () => {
    const line: LyricLine = { id: "line", agentId: "v1", text: "Hello", words: [{ text: "Hello", begin: 0, end: 1 }] };
    expect(withAlignedWords(line)).toBe(line);
  });

  it("replaces stale stored pieces with the plan from the track text", () => {
    const aligned = withAlignedWords(koreanLine);
    expect(aligned.words?.map((word) => word.transliteration)).toEqual(["Uh", "ildan eun", "na"]);
    expect(aligned.backgroundWords?.map((word) => word.transliteration)).toEqual(["geurae", "yeah"]);
  });

  it("writes the plan status for each track onto the transliteration", () => {
    const aligned = withAlignedWords(koreanLine);
    expect(aligned.transliteration?.alignmentStatus).toBe("inferred");
    expect(aligned.transliteration?.backgroundAlignmentStatus).toBe("inferred");
    expect(aligned.transliteration?.text).toBe("Uh  ildan eun  na");
  });

  it("does not mutate the input line", () => {
    const before = structuredClone(koreanLine);
    withAlignedWords(koreanLine);
    expect(koreanLine).toEqual(before);
  });
});
