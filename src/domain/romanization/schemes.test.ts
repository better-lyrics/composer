import { describe, expect, it } from "vitest";
import type { Script } from "@/domain/romanization/detect";
import { getSchemeByScript, getSchemeLabel, isKnownScheme, SCHEMES } from "@/domain/romanization/schemes";

describe("schemes", () => {
  it("isKnownScheme accepts ja-Latn-hepburn", () => {
    expect(isKnownScheme("ja-Latn-hepburn")).toBe(true);
  });

  it("isKnownScheme accepts every entry in SCHEMES", () => {
    for (const scheme of SCHEMES) {
      expect(isKnownScheme(scheme.id)).toBe(true);
    }
  });

  it("isKnownScheme rejects unknown", () => {
    expect(isKnownScheme("xx-Latn-foo")).toBe(false);
  });

  it("isKnownScheme rejects empty string", () => {
    expect(isKnownScheme("")).toBe(false);
  });

  it("getSchemeByScript returns the default scheme for japanese", () => {
    expect(getSchemeByScript("japanese")).toBe("ja-Latn-hepburn");
  });

  it("getSchemeByScript returns pinyin for chinese", () => {
    expect(getSchemeByScript("chinese")).toBe("zh-Latn-pinyin");
  });

  it("getSchemeByScript returns undefined for latin", () => {
    expect(getSchemeByScript("latin")).toBeUndefined();
  });

  it("SCHEMES enumerates expected entries", () => {
    expect(SCHEMES.map((s) => s.id).toSorted()).toEqual([
      "ar-Latn-google",
      "bn-Latn-google",
      "el-Latn-google",
      "he-Latn-google",
      "hi-Latn-google",
      "ja-Latn-hepburn",
      "ja-Latn-kunrei",
      "ja-Latn-nihon",
      "ko-Latn-google",
      "ru-Latn-google",
      "th-Latn-google",
      "zh-Latn-pinyin",
      "zh-Latn-wadegiles",
    ]);
  });

  it("every scheme carries a script tag", () => {
    const validScripts: Script[] = [
      "japanese",
      "chinese",
      "korean",
      "russian",
      "greek",
      "thai",
      "arabic",
      "hindi",
      "bengali",
      "hebrew",
    ];
    for (const scheme of SCHEMES) {
      expect(validScripts).toContain(scheme.script);
    }
  });

  it("getSchemeLabel returns human-readable for Hepburn", () => {
    expect(getSchemeLabel("ja-Latn-hepburn")).toBe("Hepburn");
  });

  it("getSchemeLabel returns human-readable for Pinyin", () => {
    expect(getSchemeLabel("zh-Latn-pinyin")).toBe("Pinyin");
  });

  it("getSchemeLabel returns undefined for unknown scheme", () => {
    expect(getSchemeLabel("xx-Latn-foo")).toBeUndefined();
  });

  it("registers a default scheme for each of the 8 new scripts", () => {
    expect(getSchemeByScript("korean")).toBe("ko-Latn-google");
    expect(getSchemeByScript("russian")).toBe("ru-Latn-google");
    expect(getSchemeByScript("greek")).toBe("el-Latn-google");
    expect(getSchemeByScript("thai")).toBe("th-Latn-google");
    expect(getSchemeByScript("arabic")).toBe("ar-Latn-google");
    expect(getSchemeByScript("hindi")).toBe("hi-Latn-google");
    expect(getSchemeByScript("bengali")).toBe("bn-Latn-google");
    expect(getSchemeByScript("hebrew")).toBe("he-Latn-google");
  });

  it("recognizes the 8 new google scheme IDs as known", () => {
    for (const id of [
      "ko-Latn-google",
      "ru-Latn-google",
      "el-Latn-google",
      "th-Latn-google",
      "ar-Latn-google",
      "hi-Latn-google",
      "bn-Latn-google",
      "he-Latn-google",
    ]) {
      expect(isKnownScheme(id)).toBe(true);
    }
  });

  it("preserves existing ja and zh schemes alongside the new google entries", () => {
    expect(getSchemeByScript("japanese")).toBe("ja-Latn-hepburn");
    expect(getSchemeByScript("chinese")).toBe("zh-Latn-pinyin");
    expect(isKnownScheme("ja-Latn-hepburn")).toBe(true);
    expect(isKnownScheme("zh-Latn-pinyin")).toBe(true);
  });

  it("getSchemeLabel returns 'Romanized (auto)' for each google scheme", () => {
    for (const id of [
      "ko-Latn-google",
      "ru-Latn-google",
      "el-Latn-google",
      "th-Latn-google",
      "ar-Latn-google",
      "hi-Latn-google",
      "bn-Latn-google",
      "he-Latn-google",
    ]) {
      expect(getSchemeLabel(id)).toBe("Romanized (auto)");
    }
  });
});
