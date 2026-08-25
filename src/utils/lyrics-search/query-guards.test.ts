import { describe, expect, it } from "vitest";
import { hasNonEmptyString, hasUsableDuration } from "@/utils/lyrics-search/query-guards";

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

describe("hasUsableDuration", () => {
  it("accepts a positive duration in seconds", () => {
    expect(hasUsableDuration(307)).toBe(true);
  });

  it("accepts a fractional duration", () => {
    expect(hasUsableDuration(306.4)).toBe(true);
  });

  it("accepts a duration below one second", () => {
    expect(hasUsableDuration(0.001)).toBe(true);
  });

  describe("edge cases", () => {
    it("rejects undefined", () => {
      expect(hasUsableDuration(undefined)).toBe(false);
    });

    it("rejects zero", () => {
      expect(hasUsableDuration(0)).toBe(false);
      expect(hasUsableDuration(-0)).toBe(false);
    });

    it("rejects negative durations", () => {
      expect(hasUsableDuration(-1)).toBe(false);
      expect(hasUsableDuration(-306.4)).toBe(false);
    });

    it("rejects values that are not finite", () => {
      expect(hasUsableDuration(Number.NaN)).toBe(false);
      expect(hasUsableDuration(Number.POSITIVE_INFINITY)).toBe(false);
      expect(hasUsableDuration(Number.NEGATIVE_INFINITY)).toBe(false);
    });
  });

  describe("invariants", () => {
    it("narrows the type for the caller", () => {
      const value: number | undefined = 307;
      if (hasUsableDuration(value)) {
        expect(Math.round(value)).toBe(307);
      } else {
        throw new Error("guard should have narrowed");
      }
    });

    it("accepts exactly the values that survive Math.round into a positive request parameter", () => {
      for (const candidate of [0, -0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(hasUsableDuration(candidate)).toBe(false);
      }
      for (const candidate of [0.5, 1, 307, 1e6]) {
        expect(hasUsableDuration(candidate)).toBe(true);
      }
    });
  });
});
