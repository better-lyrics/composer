import { describe, expect, it } from "vitest";
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

  it("getSchemeByScript returns undefined for korean (unsupported)", () => {
    expect(getSchemeByScript("korean")).toBeUndefined();
  });

  it("SCHEMES enumerates expected entries", () => {
    expect(SCHEMES.map((s) => s.id).toSorted()).toEqual([
      "ja-Latn-hepburn",
      "ja-Latn-kunrei",
      "ja-Latn-nihon",
      "zh-Latn-pinyin",
      "zh-Latn-wadegiles",
    ]);
  });

  it("every scheme carries a script tag", () => {
    for (const scheme of SCHEMES) {
      expect(["japanese", "chinese", "korean"]).toContain(scheme.script);
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
});
