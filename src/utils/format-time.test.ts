import { describe, expect, it } from "vitest";
import { formatTime } from "@/utils/format-time";

describe("formatTime", () => {
  describe("happy paths", () => {
    it("formats milliseconds by default", () => {
      expect(formatTime(65.25)).toBe("1:05.250");
    });

    it("formats centiseconds", () => {
      expect(formatTime(65.25, 2)).toBe("1:05.25");
    });

    it("formats whole seconds", () => {
      expect(formatTime(65.25, 0)).toBe("1:05");
    });
  });

  describe("edge cases", () => {
    it("formats zero", () => {
      expect(formatTime(0)).toBe("0:00.000");
    });

    it("falls back to zero for negative and non-finite input", () => {
      expect(formatTime(-1)).toBe("0:00.000");
      expect(formatTime(Number.NaN, 2)).toBe("0:00.00");
      expect(formatTime(Number.POSITIVE_INFINITY, 0)).toBe("0:00");
    });

    it("carries into minutes when the millisecond rounds up to a full minute", () => {
      expect(formatTime(59.9996)).toBe("1:00.000");
    });

    it("keeps truncation below the millisecond grid for coarser precisions", () => {
      expect(formatTime(1.999, 2)).toBe("0:01.99");
      expect(formatTime(59.9, 0)).toBe("0:59");
    });

    it("formats times past an hour as minutes", () => {
      expect(formatTime(3725.5)).toBe("62:05.500");
    });
  });

  describe("regressions", () => {
    it("regression: does not export 18.2 s as 0:18.199", () => {
      expect(formatTime(18.2)).toBe("0:18.200");
      expect(formatTime(4.1)).toBe("0:04.100");
      expect(formatTime(99.99)).toBe("1:39.990");
    });

    it("regression: accumulated 50 ms nudges land on the millisecond grid", () => {
      expect(formatTime(0.08 + 0.05 + 0.05 + 0.05)).toBe("0:00.230");
    });

    it("regression: a 0.8 s duration from float subtraction shows as 0.80", () => {
      expect(formatTime(5.3 - 4.5, 2)).toBe("0:00.80");
    });
  });

  describe("invariants", () => {
    it("always pads seconds to two digits and the fraction to its precision", () => {
      for (const seconds of [0.001, 1.05, 9.5, 60.01, 600.1]) {
        expect(formatTime(seconds)).toMatch(/^\d+:\d{2}\.\d{3}$/);
        expect(formatTime(seconds, 2)).toMatch(/^\d+:\d{2}\.\d{2}$/);
        expect(formatTime(seconds, 0)).toMatch(/^\d+:\d{2}$/);
      }
    });

    it("never goes backwards as time increases", () => {
      const toMs = (formatted: string) => {
        const [mins, rest] = formatted.split(":");
        return Number(mins) * 60_000 + Math.round(Number(rest) * 1000);
      };
      let previous = -1;
      for (let step = 0; step <= 2000; step++) {
        const current = toMs(formatTime(step * 0.037));
        expect(current).toBeGreaterThanOrEqual(previous);
        previous = current;
      }
    });
  });
});
