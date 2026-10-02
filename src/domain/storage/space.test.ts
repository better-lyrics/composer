import { LOW_SPACE_BYTES, bytesToFree, freeBytes } from "@/domain/storage/space";
import { describe, expect, it } from "vitest";

const MEBIBYTE = 1024 ** 2;
const PLENTY = { usage: 100 * MEBIBYTE, quota: 50_000 * MEBIBYTE };

describe("freeBytes", () => {
  it("is the quota left after the usage", () => {
    expect(freeBytes({ usage: 300, quota: 1000 })).toBe(700);
  });

  describe("edge cases", () => {
    it("never goes below zero when usage passes the quota", () => {
      expect(freeBytes({ usage: 1200, quota: 1000 })).toBe(0);
    });

    it("treats a non-finite quota as zero instead of producing NaN", () => {
      expect(freeBytes({ usage: 100, quota: Number.NaN })).toBe(0);
      expect(freeBytes({ usage: 100, quota: Number.POSITIVE_INFINITY })).toBe(0);
    });

    it("treats a non-finite usage as zero instead of producing NaN", () => {
      expect(freeBytes({ usage: Number.NaN, quota: 1000 })).toBe(1000);
      expect(freeBytes({ usage: Number.POSITIVE_INFINITY, quota: 1000 })).toBe(1000);
    });
  });
});

describe("bytesToFree", () => {
  it("frees what is over the limit", () => {
    expect(bytesToFree({ usedBytes: 1500, limitBytes: 1000, estimate: PLENTY, storageFull: false })).toBe(500);
  });

  it("frees nothing under the limit with plenty of space", () => {
    expect(bytesToFree({ usedBytes: 900, limitBytes: 1000, estimate: PLENTY, storageFull: false })).toBe(0);
  });

  it("frees enough to get back to the low space line", () => {
    const estimate = { usage: 900 * MEBIBYTE, quota: 1000 * MEBIBYTE };
    expect(bytesToFree({ usedBytes: 0, limitBytes: undefined, estimate, storageFull: false })).toBe(
      LOW_SPACE_BYTES - 100 * MEBIBYTE,
    );
  });

  it("frees at least the low space amount after a quota error", () => {
    expect(bytesToFree({ usedBytes: 0, limitBytes: undefined, estimate: PLENTY, storageFull: true })).toBe(
      LOW_SPACE_BYTES,
    );
  });

  describe("edge cases", () => {
    it("has no limit to pass with No limit", () => {
      expect(bytesToFree({ usedBytes: 10 ** 12, limitBytes: undefined, estimate: PLENTY, storageFull: false })).toBe(0);
    });

    it("ignores a missing or empty estimate", () => {
      expect(bytesToFree({ usedBytes: 10, limitBytes: 100, estimate: undefined, storageFull: false })).toBe(0);
      expect(
        bytesToFree({ usedBytes: 10, limitBytes: 100, estimate: { usage: 0, quota: 0 }, storageFull: false }),
      ).toBe(0);
    });

    it("treats a fully invalid estimate as no low space signal", () => {
      const estimate = { usage: Number.NaN, quota: Number.NaN };
      expect(bytesToFree({ usedBytes: 0, limitBytes: undefined, estimate, storageFull: false })).toBe(0);
    });

    it("still frees the low space amount when the estimate is unbounded", () => {
      const estimate = { usage: Number.POSITIVE_INFINITY, quota: Number.POSITIVE_INFINITY };
      expect(bytesToFree({ usedBytes: 0, limitBytes: undefined, estimate, storageFull: false })).toBe(LOW_SPACE_BYTES);
    });
  });

  describe("invariants", () => {
    it("is always finite and non-negative for any combination of NaN or infinite estimate values", () => {
      const badValues = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1000];
      for (const usage of badValues) {
        for (const quota of badValues) {
          const result = bytesToFree({
            usedBytes: 0,
            limitBytes: undefined,
            estimate: { usage, quota },
            storageFull: false,
          });
          expect(Number.isFinite(result)).toBe(true);
          expect(result).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("takes the largest of the three reasons", () => {
      const estimate = { usage: 950 * MEBIBYTE, quota: 1000 * MEBIBYTE };
      const lowSpace = LOW_SPACE_BYTES - 50 * MEBIBYTE;
      expect(
        bytesToFree({ usedBytes: 2000 * MEBIBYTE, limitBytes: 1000 * MEBIBYTE, estimate, storageFull: false }),
      ).toBe(Math.max(1000 * MEBIBYTE, lowSpace));
      expect(bytesToFree({ usedBytes: 0, limitBytes: 0, estimate, storageFull: true })).toBe(
        Math.max(lowSpace, LOW_SPACE_BYTES),
      );
    });
  });
});
