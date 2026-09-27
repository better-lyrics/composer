import { describe, expect, it } from "vitest";
import { isValidLanguageTag, normalizeLanguageTag } from "@/domain/project/language";

describe("normalizeLanguageTag", () => {
  it("keeps a plain language tag", () => {
    expect(normalizeLanguageTag("en")).toBe("en");
  });

  it("canonicalises the case of a region tag", () => {
    expect(normalizeLanguageTag("EN-us")).toBe("en-US");
  });

  it("keeps a script and region tag", () => {
    expect(normalizeLanguageTag("zh-Hant-TW")).toBe("zh-Hant-TW");
  });

  it("canonicalises a lowercase script subtag", () => {
    expect(normalizeLanguageTag("ja-latn")).toBe("ja-Latn");
  });

  it("rejects free text", () => {
    expect(normalizeLanguageTag("not a lang!!")).toBeUndefined();
  });

  describe("edge cases", () => {
    it("gives undefined for empty input", () => {
      expect(normalizeLanguageTag("")).toBeUndefined();
    });

    it("gives undefined for whitespace-only input", () => {
      expect(normalizeLanguageTag("   ")).toBeUndefined();
    });

    it("trims surrounding whitespace", () => {
      expect(normalizeLanguageTag("  ja  ")).toBe("ja");
    });

    it("rejects a single-letter tag", () => {
      expect(normalizeLanguageTag("x")).toBeUndefined();
    });

    it("rejects a tag containing a quote", () => {
      expect(normalizeLanguageTag('en"US')).toBeUndefined();
    });
  });

  describe("invariants", () => {
    it("is idempotent", () => {
      const once = normalizeLanguageTag("PT-br");
      expect(once).toBe("pt-BR");
      expect(normalizeLanguageTag(once ?? "")).toBe(once);
    });
  });
});

describe("isValidLanguageTag", () => {
  it("accepts a valid tag", () => {
    expect(isValidLanguageTag("pt-BR")).toBe(true);
  });

  it("rejects an invalid tag", () => {
    expect(isValidLanguageTag("not a lang!!")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isValidLanguageTag("")).toBe(false);
  });
});
