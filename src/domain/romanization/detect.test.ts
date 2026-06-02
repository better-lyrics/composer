import { describe, expect, it } from "vitest";
import type { Script } from "@/domain/romanization/detect";
import { detectScript, hasNonLatinScript } from "@/domain/romanization/detect";

describe("detectScript", () => {
  it("returns 'latin' for empty string", () => {
    expect(detectScript("")).toBe("latin");
  });

  it("returns 'latin' for ASCII", () => {
    expect(detectScript("Hello world")).toBe("latin");
  });

  it("returns 'japanese' for hiragana", () => {
    expect(detectScript("どうでも")).toBe("japanese");
  });

  it("returns 'japanese' for katakana", () => {
    expect(detectScript("メモリー")).toBe("japanese");
  });

  it("returns 'japanese' for half-width katakana", () => {
    expect(detectScript("ﾒﾓﾘｰ")).toBe("japanese");
  });

  it("returns 'japanese' for mixed kana + kanji", () => {
    expect(detectScript("夜だけど")).toBe("japanese");
  });

  it("returns 'chinese' for pure CJK without kana", () => {
    expect(detectScript("你好世界")).toBe("chinese");
  });

  it("returns 'korean' for hangul syllables", () => {
    expect(detectScript("안녕하세요")).toBe("korean");
  });

  it("returns 'korean' for hangul jamo", () => {
    expect(detectScript("ᄀᄂᄃ")).toBe("korean");
  });

  describe("hangul non-syllable ranges", () => {
    it("detects Hangul Jamo (U+1100)", () => {
      expect(detectScript("ᄀ")).toBe("korean");
    });

    it("detects Hangul Compatibility Jamo (U+3131)", () => {
      expect(detectScript("ㄱ")).toBe("korean");
    });

    it("detects Hangul Jamo Extended-A (U+A960)", () => {
      expect(detectScript("ꥠ")).toBe("korean");
    });

    it("detects Hangul Jamo Extended-B (U+D7B0)", () => {
      expect(detectScript("ힰ")).toBe("korean");
    });
  });

  it("returns 'japanese' for mixed kana + latin", () => {
    expect(detectScript("こんにちは world")).toBe("japanese");
  });

  it("returns 'latin' for emoji only", () => {
    expect(detectScript("🎵🎶")).toBe("latin");
  });

  it("strips BOM before detecting", () => {
    expect(detectScript("﻿どうでも")).toBe("japanese");
  });

  it("handles latin combining marks", () => {
    expect(detectScript("café")).toBe("latin");
  });

  it("prioritises kana over kanji for japanese vs chinese disambiguation", () => {
    expect(detectScript("夜だ")).toBe("japanese");
  });

  it("hasNonLatinScript is true for any non-latin", () => {
    expect(hasNonLatinScript("夜だけど")).toBe(true);
    expect(hasNonLatinScript("你好")).toBe(true);
    expect(hasNonLatinScript("안녕")).toBe(true);
  });

  it("hasNonLatinScript is false for latin or empty", () => {
    expect(hasNonLatinScript("Hello")).toBe(false);
    expect(hasNonLatinScript("")).toBe(false);
  });

  it.each<[string, Script]>([
    ["夜だ", "japanese"],
    ["사랑해", "korean"],
    ["你好", "chinese"],
    ["Привет", "russian"],
    ["Γεια", "greek"],
    ["สวัสดี", "thai"],
    ["السلام", "arabic"],
    ["नमस्ते", "hindi"],
    ["ভালো", "bengali"],
    ["שלום", "hebrew"],
    ["hello world", "latin"],
  ])("classifies '%s' as %s", (text, expected) => {
    expect(detectScript(text)).toBe(expected);
  });

  it("returns 'latin' for the empty string", () => {
    expect(detectScript("")).toBe("latin");
  });

  it("returns the first detected script when multiple are present", () => {
    expect(detectScript("夜だ night")).toBe("japanese");
  });

  it("hasNonLatinScript returns true for each of the 8 new scripts", () => {
    for (const text of ["사랑해", "Привет", "Γεια", "สวัสดี", "السلام", "नमस्ते", "ভালো", "שלום"]) {
      expect(hasNonLatinScript(text)).toBe(true);
    }
  });
});
