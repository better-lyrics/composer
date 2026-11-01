import { formatCountdown } from "@/utils/format-countdown";
import { describe, expect, it } from "vitest";

describe("formatCountdown", () => {
  it("rounds whole seconds up so the count never shows 0 before it ends", () => {
    expect(formatCountdown(2.01, 0)).toBe("3");
    expect(formatCountdown(2, 0)).toBe("2");
    expect(formatCountdown(0.2, 0)).toBe("1");
  });

  it("rounds tenths up", () => {
    expect(formatCountdown(1.46, 1)).toBe("1.5");
    expect(formatCountdown(1, 1)).toBe("1.0");
    expect(formatCountdown(0.04, 1)).toBe("0.1");
  });

  describe("edge cases", () => {
    it("shows zero when the count has run out", () => {
      expect(formatCountdown(0, 0)).toBe("0");
      expect(formatCountdown(0, 1)).toBe("0.0");
    });

    it("clamps negative time to zero", () => {
      expect(formatCountdown(-0.3, 0)).toBe("0");
      expect(formatCountdown(-0.3, 1)).toBe("0.0");
    });

    it("does not show float noise", () => {
      expect(formatCountdown(0.1 + 0.2, 1)).toBe("0.3");
      expect(formatCountdown(3 * 1.1 - 0.3, 0)).toBe("3");
      expect(formatCountdown(0.3, 1)).toBe("0.3");
    });
  });

  describe("invariants", () => {
    it("always shows exactly one decimal under 10 seconds at tenth precision", () => {
      for (let tenth = 0; tenth < 100; tenth++) {
        expect(formatCountdown(tenth / 10, 1)).toMatch(/^\d\.\d$/);
      }
    });
  });
});
