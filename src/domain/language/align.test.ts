import { alignTrackToLine, mappedTransliteration, planTransliterationAlignment } from "@/domain/language/align";
import type { TransliterationTrack } from "@/domain/language/model";
import { reconcileLine } from "@/domain/line/model";
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
    const plan = planTransliterationAlignment(words, "kyouhi", "confirmed");
    expect(plan.status).toBe("confirmed");
    expect(plan.words).toBe(words);
  });

  it("does not promote a reused proportional mapping to confirmed", () => {
    const words = ["붙", "어", "있", "던"].map((text, index) => ({ text, begin: index, end: index + 1 }));
    const track: TransliterationTrack = {
      language: "ko-Latn",
      text: "but eoissdeon",
      segments: [],
      origin: "google",
      sourceFingerprint: "test",
    };
    const line = { id: "line", agentId: "v1", text: "붙어있던", words };
    const first = reconcileLine({ ...line, ...alignTrackToLine(line, track) });
    expect(first.transliteration?.alignmentStatus).toBe("needs-review");
    const reused = alignTrackToLine(first, first.transliteration!);
    expect(reused.transliteration?.alignmentStatus).toBe("needs-review");
    expect(reused.words).toBe(first.words);
    expect(alignTrackToLine(first, track).transliteration?.alignmentStatus).toBe("needs-review");
  });

  it.each([undefined, "inferred", "unresolved"] as const)(
    "accepts matching stored fragments as inferred when prior status is %s",
    (status) => {
      const words = [
        { text: "가", begin: 0, end: 1, transliteration: "ga", transliterationJoinerAfter: "" },
        { text: "나", begin: 1, end: 2, transliteration: "na" },
      ];
      expect(planTransliterationAlignment(words, "gana", status).status).toBe("inferred");
    },
  );

  it("does not reuse manual confirmation when the reading changes", () => {
    const words = [
      { text: "가", begin: 0, end: 1, transliteration: "ga", transliterationJoinerAfter: "" },
      { text: "나", begin: 1, end: 2, transliteration: "na" },
    ];
    expect(planTransliterationAlignment(words, "ganna", "confirmed").status).toBe("needs-review");
  });

  it("does not label empty or untimed text as manually confirmed", () => {
    expect(planTransliterationAlignment([], "gana").status).toBe("inferred");
    expect(planTransliterationAlignment([{ text: "가", begin: 0, end: 1 }], "").status).toBe("inferred");
    const track: TransliterationTrack = {
      language: "ko-Latn",
      text: "ga",
      backgroundText: "na",
      segments: [],
      origin: "google",
      sourceFingerprint: "test",
    };
    expect(
      alignTrackToLine({ id: "line", agentId: "v1", text: "가", backgroundText: "나" }, track).transliteration,
    ).toMatchObject({ alignmentStatus: "inferred", backgroundAlignmentStatus: "inferred" });
  });

  it("preserves main and background review states independently", () => {
    const track: TransliterationTrack = {
      language: "ko-Latn",
      text: "ga",
      backgroundText: "na",
      segments: [],
      origin: "manual",
      sourceFingerprint: "test",
      alignmentStatus: "confirmed",
      backgroundAlignmentStatus: "needs-review",
    };
    const line = {
      id: "line",
      agentId: "v1",
      text: "가",
      backgroundText: "나",
      words: [{ text: "가", begin: 0, end: 1, transliteration: "ga" }],
      backgroundWords: [{ text: "나", begin: 0, end: 1, transliteration: "na" }],
    };
    expect(alignTrackToLine(line, track).transliteration).toMatchObject({
      alignmentStatus: "confirmed",
      backgroundAlignmentStatus: "needs-review",
    });
  });
});
