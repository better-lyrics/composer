import { describe, expect, it } from "vitest";
import { relativeTime } from "@/utils/library/relative-time";

const NOW = new Date("2026-06-13T12:00:00Z").getTime();
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

describe("relativeTime", () => {
  it("returns 'just now' for sub-minute deltas", () => {
    expect(relativeTime(NOW - 30 * 1000, NOW)).toBe("just now");
  });

  it("returns minute counts within the hour", () => {
    expect(relativeTime(NOW - 1 * MINUTE, NOW)).toBe("1m ago");
    expect(relativeTime(NOW - 5 * MINUTE, NOW)).toBe("5m ago");
  });

  it("returns hour counts within the day", () => {
    expect(relativeTime(NOW - 3 * HOUR, NOW)).toBe("3h ago");
    expect(relativeTime(NOW - 23 * HOUR, NOW)).toBe("23h ago");
  });

  it("returns day counts within the week", () => {
    expect(relativeTime(NOW - 3 * DAY, NOW)).toBe("3d ago");
    expect(relativeTime(NOW - 6 * DAY, NOW)).toBe("6d ago");
  });

  it("returns week counts within the month", () => {
    expect(relativeTime(NOW - 1 * WEEK, NOW)).toBe("1w ago");
    expect(relativeTime(NOW - 3 * WEEK, NOW)).toBe("3w ago");
  });

  it("returns month counts within the year", () => {
    expect(relativeTime(NOW - 1 * MONTH, NOW)).toBe("1mo ago");
    expect(relativeTime(NOW - 6 * MONTH, NOW)).toBe("6mo ago");
  });

  it("returns year counts past the year boundary", () => {
    expect(relativeTime(NOW - 1 * YEAR, NOW)).toBe("1y ago");
    expect(relativeTime(NOW - 2 * YEAR, NOW)).toBe("2y ago");
  });

  describe("edge cases", () => {
    it("returns 'just now' for future timestamps", () => {
      expect(relativeTime(NOW + 5 * MINUTE, NOW)).toBe("just now");
    });

    it("returns 'just now' for the zero delta", () => {
      expect(relativeTime(NOW, NOW)).toBe("just now");
    });
  });
});
