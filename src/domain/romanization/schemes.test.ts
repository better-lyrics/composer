import { describe, expect, it } from "vitest";
import { availableSchemesForLang, defaultSchemeForLang, schemeBelongsToLang } from "@/domain/romanization/schemes";

describe("availableSchemesForLang", () => {
  it.each([
    ["ja", ["ja-Latn-hepburn", "ja-Latn-kunrei"]],
    ["zh", ["zh-Latn-pinyin"]],
    ["ko", ["ko-Latn-rr", "ko-Latn-mr"]],
    ["th", ["th-Latn-rtgs"]],
    ["ru", ["ru-Latn-iso9", "ru-Latn-bgn"]],
    ["el", ["el-Latn-iso843"]],
    ["ar", ["ar-Latn-iso233"]],
    ["he", ["he-Latn"]],
    ["hi", ["hi-Latn-iast"]],
    ["bn", ["bn-Latn-iast"]],
  ])("returns schemes for %s", (lang, expected) => {
    expect(availableSchemesForLang(lang)).toEqual(expected);
  });

  it("returns the universal fallback for 'und'", () => {
    expect(availableSchemesForLang("und")).toEqual(["und-Latn"]);
  });

  it("returns ['und-Latn'] for an unknown lang", () => {
    expect(availableSchemesForLang("xx")).toEqual(["und-Latn"]);
  });
});

describe("defaultSchemeForLang", () => {
  it("returns the first scheme of each language", () => {
    expect(defaultSchemeForLang("ja")).toBe("ja-Latn-hepburn");
    expect(defaultSchemeForLang("zh")).toBe("zh-Latn-pinyin");
    expect(defaultSchemeForLang("ko")).toBe("ko-Latn-rr");
  });
  it("returns 'und-Latn' for unknown", () => {
    expect(defaultSchemeForLang("xx")).toBe("und-Latn");
  });
});

describe("schemeBelongsToLang", () => {
  it.each([
    ["ja-Latn-hepburn", "ja", true],
    ["zh-Latn-pinyin", "zh", true],
    ["ja-Latn-hepburn", "zh", false],
    ["und-Latn", "und", true],
    ["", "ja", false],
  ])("scheme %s in %s => %s", (scheme, lang, expected) => {
    expect(schemeBelongsToLang(scheme, lang)).toBe(expected);
  });
});
