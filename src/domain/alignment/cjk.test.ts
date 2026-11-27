import { hasCjk, hasKana, splitCjkPart } from "@/domain/alignment/cjk";
import { describe, expect, it } from "vitest";

describe("splitCjkPart", () => {
  it("leaves non-CJK parts alone", () => {
    expect(splitCjkPart("hello,")).toEqual(["hello,"]);
  });

  it("splits Chinese into characters, keeping punctuation with what it follows", () => {
    expect(splitCjkPart("我爱你，")).toEqual(["我", "爱", "你，"]);
  });

  it("keeps small kana, the long-vowel mark and small tsu with the kana before", () => {
    expect(splitCjkPart("きょうはコーヒー")).toEqual(["きょ", "う", "は", "コー", "ヒー"]);
    expect(splitCjkPart("きって")).toEqual(["きっ", "て"]);
  });

  it("splits Hangul into syllable blocks, which Korean is timed by, while hasCjk stays Chinese and Japanese only", () => {
    expect(splitCjkPart("사랑해요,")).toEqual(["사", "랑", "해", "요,"]);
    expect(splitCjkPart("baby사랑")).toEqual(["baby", "사", "랑"]);
    expect(hasCjk("사랑")).toBe(false);
  });

  it("keeps runs of other letters together", () => {
    expect(splitCjkPart("君とdance")).toEqual(["君", "と", "dance"]);
  });
});

describe("script checks", () => {
  it("tells CJK and kana apart", () => {
    expect(hasCjk("hello")).toBe(false);
    expect(hasCjk("夜")).toBe(true);
    expect(hasKana("夜")).toBe(false);
    expect(hasKana("夜に")).toBe(true);
  });
});
