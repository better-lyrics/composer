import {
  alignTrackToLine,
  mappedTransliteration,
  planTransliterationAlignment,
  withAlignedWords,
} from "@/domain/language/align";
import type { TransliterationTrack } from "@/domain/language/model";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { newWordId } from "@/domain/word/id";
import { describe, expect, it } from "vitest";

describe("transliteration alignment", () => {
  it("removes cached fragments and joiners when alternate text is cleared", () => {
    expect(
      planTransliterationAlignment(
        [
          {
            id: "w1",
            text: "今日",
            sep: "",
            begin: 1,
            end: 2,
            transliteration: "kyou",
            transliterationJoinerAfter: " ",
          },
        ],
        "",
      ).words,
    ).toEqual([{ text: "今日", sep: "", begin: 1, end: 2 }]);
  });

  it("maps explicit pronunciation and word spaces to timing slots", () => {
    const words = [
      { id: "w1", text: "걸", sep: "", begin: 0, end: 0.2 },
      { id: "w2", text: "음", sep: "", begin: 0.2, end: 0.4 },
      { id: "w3", text: "은", sep: " ", begin: 0.4, end: 0.6 },
      { id: "w4", text: "Like", sep: "", begin: 0.6, end: 1 },
    ];
    const plan = planTransliterationAlignment(words, "geol eum eun  Like");
    expect(plan.status).toBe("inferred");
    expect(plan.words.map((word) => word.transliteration)).toEqual(["geol", "eum", "eun", "Like"]);
    expect(plan.words.slice(0, -1).map((word) => word.transliterationJoinerAfter)).toEqual([" ", " ", "  "]);
  });

  it("allows Google word spaces inside an unspaced original group", () => {
    const words = [{ id: "w5", text: "こんにちは世界", sep: "", begin: 0, end: 2 }];
    const plan = planTransliterationAlignment(words, "Kon'nichiwa  sekai");
    expect(plan.status).toBe("inferred");
    expect(plan.words[0].transliteration).toBe("Kon'nichiwa  sekai");
  });

  it("keeps a proportional mapping as reviewable rather than changing display text", () => {
    const words = ["붙", "어", "있", "던"].map((text, index) => ({
      id: newWordId(),
      text,
      sep: "",
      begin: index,
      end: index + 1,
    }));
    const plan = planTransliterationAlignment(words, "but eoissdeon");
    expect(plan.status).toBe("needs-review");
    expect(mappedTransliteration(plan.words)).toBe("but eoissdeon");
  });

  it("reports an unresolved mapping when there are too few graphemes", () => {
    const words = ["가", "나", "다"].map((text, index) => ({
      id: newWordId(),
      text,
      sep: "",
      begin: index,
      end: index + 1,
    }));
    expect(planTransliterationAlignment(words, "a").status).toBe("unresolved");
  });

  it("preserves an existing confirmed mapping", () => {
    const words = [
      { id: "w6", text: "今", sep: "", begin: 0, end: 1, transliteration: "kyou", transliterationJoinerAfter: "" },
      { id: "w7", text: "日", sep: "", begin: 1, end: 2, transliteration: "hi" },
    ];
    const plan = planTransliterationAlignment(words, "kyouhi", "confirmed");
    expect(plan.status).toBe("confirmed");
    expect(plan.words).toBe(words);
  });

  it("does not promote a reused proportional mapping to confirmed", () => {
    const words = ["붙", "어", "있", "던"].map((text, index) => ({
      id: newWordId(),
      text,
      sep: "",
      begin: index,
      end: index + 1,
    }));
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
        {
          id: newWordId(),
          text: "가",
          sep: "",
          begin: 0,
          end: 1,
          transliteration: "ga",
          transliterationJoinerAfter: "",
        },
        { id: newWordId(), text: "나", sep: "", begin: 1, end: 2, transliteration: "na" },
      ];
      expect(planTransliterationAlignment(words, "gana", status).status).toBe("inferred");
    },
  );

  it("does not reuse manual confirmation when the reading changes", () => {
    const words = [
      { id: "w8", text: "가", sep: "", begin: 0, end: 1, transliteration: "ga", transliterationJoinerAfter: "" },
      { id: "w9", text: "나", sep: "", begin: 1, end: 2, transliteration: "na" },
    ];
    expect(planTransliterationAlignment(words, "ganna", "confirmed").status).toBe("needs-review");
  });

  it("does not label empty or untimed text as manually confirmed", () => {
    expect(planTransliterationAlignment([], "gana").status).toBe("inferred");
    expect(planTransliterationAlignment([{ id: "w10", text: "가", sep: "", begin: 0, end: 1 }], "").status).toBe(
      "inferred",
    );
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
      words: [{ id: "w11", text: "가", sep: "", begin: 0, end: 1, transliteration: "ga" }],
      backgroundWords: [{ id: "w12", text: "나", sep: "", begin: 0, end: 1, transliteration: "na" }],
    };
    expect(alignTrackToLine(line, track).transliteration).toMatchObject({
      alignmentStatus: "confirmed",
      backgroundAlignmentStatus: "needs-review",
    });
  });
});

describe("withAlignedWords", () => {
  const koreanLine: LyricLine = {
    id: "line",
    agentId: "v1",
    text: "Uh 일단은 나",
    words: [
      { id: "w13", text: "Uh", sep: " ", begin: 0, end: 0.5, transliteration: "Oh" },
      { id: "w14", text: "일단은", sep: " ", begin: 0.5, end: 1.5, transliteration: "ildaneun" },
      { id: "w15", text: "나", sep: "", begin: 1.5, end: 2, transliteration: "nah" },
    ],
    backgroundText: "그래 yeah",
    backgroundWords: [
      { id: "w16", text: "그래", sep: " ", begin: 2, end: 2.5 },
      { id: "w17", text: "yeah", sep: "", begin: 2.5, end: 3 },
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
    const line: LyricLine = {
      id: "line",
      agentId: "v1",
      text: "Hello",
      words: [{ id: "w18", text: "Hello", sep: "", begin: 0, end: 1 }],
    };
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
