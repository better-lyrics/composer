import { mappedTransliteration, planTransliterationAlignment } from "@/domain/language/align";
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
