import { describe, expect, it } from "vitest";
import { isValidIsrc, normalizeIsrc } from "@/utils/isrc";

describe("isValidIsrc", () => {
  it("accepts a canonical ISRC", () => {
    expect(isValidIsrc("USQX91700001")).toBe(true);
  });
  it("is case-insensitive on the country/registrant", () => {
    expect(isValidIsrc("usqx91700001")).toBe(true);
  });
  describe("edge cases", () => {
    it("rejects wrong length", () => expect(isValidIsrc("USQX9170001")).toBe(false));
    it("rejects empty", () => expect(isValidIsrc("")).toBe(false));
    it("rejects letters in the year/designation digits", () => expect(isValidIsrc("USQX9170000A")).toBe(false));
    it("trims surrounding whitespace before validating", () => expect(isValidIsrc(" USQX91700001 ")).toBe(true));
  });
  describe("invariants", () => {
    it("accepts digits in the registrant positions", () => expect(isValidIsrc("US3X91700001")).toBe(true));
    it("normalizer trims surrounding whitespace", () => expect(normalizeIsrc(" usqx91700001 ")).toBe("USQX91700001"));
    it("normalizer is idempotent on its own output", () => {
      const once = normalizeIsrc("usqx91700001");
      expect(normalizeIsrc(once as string)).toBe(once);
    });
    it("isValidIsrc agrees with normalizeIsrc for a clean valid code", () =>
      expect(isValidIsrc("USQX91700001")).toBe(normalizeIsrc("USQX91700001") !== undefined));
  });
});

describe("normalizeIsrc", () => {
  it("uppercases a valid code", () => expect(normalizeIsrc("usqx91700001")).toBe("USQX91700001"));
  it("returns undefined for invalid", () => expect(normalizeIsrc("nope")).toBeUndefined());
  it("returns undefined for empty", () => expect(normalizeIsrc("")).toBeUndefined());
});
