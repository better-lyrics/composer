import { describe, expect, it } from "vitest";
import { hasNonEmptyString } from "@/utils/lyrics-search/query-guards";

// -- Tests --------------------------------------------------------------------

describe("hasNonEmptyString", () => {
  it("accepts a populated string", () => {
    expect(hasNonEmptyString("Wanderlust")).toBe(true);
  });

  it("accepts a string that is only meaningful after trimming", () => {
    expect(hasNonEmptyString("  The Weeknd  ")).toBe(true);
  });

  describe("edge cases", () => {
    it("rejects undefined", () => {
      expect(hasNonEmptyString(undefined)).toBe(false);
    });

    it("rejects the empty string", () => {
      expect(hasNonEmptyString("")).toBe(false);
    });

    it("rejects whitespace of every flavour", () => {
      expect(hasNonEmptyString(" ")).toBe(false);
      expect(hasNonEmptyString("\t")).toBe(false);
      expect(hasNonEmptyString("\n\r")).toBe(false);
      expect(hasNonEmptyString(" ")).toBe(false);
    });

    it("accepts strings whose only content is punctuation or digits", () => {
      expect(hasNonEmptyString("0")).toBe(true);
      expect(hasNonEmptyString("-")).toBe(true);
    });

    it("accepts non-latin text", () => {
      expect(hasNonEmptyString("漂泊")).toBe(true);
      expect(hasNonEmptyString("한국어")).toBe(true);
    });
  });

  describe("invariants", () => {
    it("narrows the type for the caller", () => {
      const value: string | undefined = "Kiss Land";
      if (hasNonEmptyString(value)) {
        expect(value.trim()).toBe("Kiss Land");
      } else {
        throw new Error("guard should have narrowed");
      }
    });

    it("does not mutate or trim the value it inspects", () => {
      const value = "  padded  ";
      hasNonEmptyString(value);
      expect(value).toBe("  padded  ");
    });
  });
});
