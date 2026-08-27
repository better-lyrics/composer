import { describe, expect, it } from "vitest";
import { hasUsableDuration, toUsableDurationSec } from "@/domain/lyrics-search/duration";

// -- Tests --------------------------------------------------------------------

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

describe("toUsableDurationSec", () => {
  it("keeps a whole number of seconds", () => {
    expect(toUsableDurationSec(307)).toBe(307);
  });

  it("rounds a fractional duration to whole seconds", () => {
    expect(toUsableDurationSec(306.4)).toBe(306);
    expect(toUsableDurationSec(306.6)).toBe(307);
  });

  describe("edge cases", () => {
    it("maps a missing field to undefined", () => {
      expect(toUsableDurationSec(undefined)).toBeUndefined();
    });

    it("maps a null to undefined rather than to zero", () => {
      expect(toUsableDurationSec(null)).toBeUndefined();
    });

    it("maps a non-numeric value to undefined", () => {
      expect(toUsableDurationSec("307")).toBeUndefined();
      expect(toUsableDurationSec(true)).toBeUndefined();
      expect(toUsableDurationSec({ seconds: 307 })).toBeUndefined();
      expect(toUsableDurationSec([307])).toBeUndefined();
    });

    it("maps zero and negative durations to undefined", () => {
      expect(toUsableDurationSec(0)).toBeUndefined();
      expect(toUsableDurationSec(-0)).toBeUndefined();
      expect(toUsableDurationSec(-1)).toBeUndefined();
      expect(toUsableDurationSec(-306.4)).toBeUndefined();
    });

    it("maps values that are not finite to undefined", () => {
      expect(toUsableDurationSec(Number.NaN)).toBeUndefined();
      expect(toUsableDurationSec(Number.POSITIVE_INFINITY)).toBeUndefined();
      expect(toUsableDurationSec(Number.NEGATIVE_INFINITY)).toBeUndefined();
    });

    it("maps a sub-second duration that rounds to zero to undefined", () => {
      expect(toUsableDurationSec(0.4)).toBeUndefined();
      expect(toUsableDurationSec(0.5)).toBe(1);
    });
  });

  describe("invariants", () => {
    it("returns only values the reader guard accepts", () => {
      const candidates: unknown[] = [
        307,
        306.4,
        0.4,
        0.5,
        0,
        -0,
        -1,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        null,
        undefined,
        "307",
        {},
      ];
      for (const candidate of candidates) {
        const normalized = toUsableDurationSec(candidate);
        if (normalized === undefined) continue;
        expect(hasUsableDuration(normalized)).toBe(true);
      }
    });

    it("is idempotent: normalizing an already normalized duration changes nothing", () => {
      const once = toUsableDurationSec(306.4);
      expect(toUsableDurationSec(once)).toBe(once);
    });

    it("always returns an integer when it returns a duration", () => {
      for (const candidate of [1, 306.4, 306.6, 1e6 + 0.5]) {
        expect(Number.isInteger(toUsableDurationSec(candidate))).toBe(true);
      }
    });
  });
});
