import { formatRelativeTime, formatRelativeTimeInline, formatShortDate } from "@/utils/format-relative-time";
import { describe, expect, it } from "vitest";

// -- Constants ----------------------------------------------------------------

const NOW = new Date(2026, 8, 27, 12, 0, 0).getTime();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// -- Tests --------------------------------------------------------------------

describe("formatRelativeTime", () => {
  it("names each range the way the switcher shows it", () => {
    expect(formatRelativeTime(NOW - 20_000, NOW)).toBe("Just now");
    expect(formatRelativeTime(NOW - 5 * MINUTE, NOW)).toBe("5 min ago");
    expect(formatRelativeTime(NOW - 3 * HOUR, NOW)).toBe("3 h ago");
    expect(formatRelativeTime(NOW - 30 * HOUR, NOW)).toBe("Yesterday");
    expect(formatRelativeTime(NOW - 4 * DAY, NOW)).toBe("4 days ago");
  });

  it("shows a short date after a week", () => {
    expect(formatRelativeTime(new Date(2026, 8, 1, 9, 0, 0).getTime(), NOW)).toBe("Sep 1");
  });

  describe("regressions", () => {
    it("includes the year when the date falls in a different year than now", () => {
      expect(formatRelativeTime(new Date(2025, 8, 20, 9, 0, 0).getTime(), NOW)).toBe("Sep 20, 2025");
    });
  });

  describe("edge cases", () => {
    it("treats a time in the future as just now", () => {
      expect(formatRelativeTime(NOW + HOUR, NOW)).toBe("Just now");
    });

    it("switches unit exactly at each boundary", () => {
      expect(formatRelativeTime(NOW - MINUTE, NOW)).toBe("1 min ago");
      expect(formatRelativeTime(NOW - HOUR, NOW)).toBe("1 h ago");
      expect(formatRelativeTime(NOW - DAY, NOW)).toBe("Yesterday");
      expect(formatRelativeTime(NOW - 2 * DAY, NOW)).toBe("2 days ago");
    });
  });
});

describe("formatShortDate", () => {
  it("shows the month and day in the same year and adds the year otherwise", () => {
    expect(formatShortDate(new Date(2026, 8, 20, 9, 0, 0).getTime(), NOW)).toBe("Sep 20");
    expect(formatShortDate(new Date(2025, 8, 20, 9, 0, 0).getTime(), NOW)).toBe("Sep 20, 2025");
  });

  describe("edge cases", () => {
    it("shows today as a date too", () => {
      expect(formatShortDate(NOW - MINUTE, NOW)).toBe("Sep 27");
    });
  });
});

describe("formatRelativeTimeInline", () => {
  it("lowercases the words inside a week so they read inside a sentence", () => {
    expect(formatRelativeTimeInline(NOW - 20_000, NOW)).toBe("just now");
    expect(formatRelativeTimeInline(NOW - 12 * MINUTE, NOW)).toBe("12 min ago");
    expect(formatRelativeTimeInline(NOW - 30 * HOUR, NOW)).toBe("yesterday");
    expect(formatRelativeTimeInline(NOW - 3 * DAY, NOW)).toBe("3 days ago");
  });

  it("keeps the capital on a date after a week", () => {
    expect(formatRelativeTimeInline(new Date(2026, 8, 1, 9, 0, 0).getTime(), NOW)).toBe("Sep 1");
  });

  describe("edge cases", () => {
    it("treats a time in the future as just now", () => {
      expect(formatRelativeTimeInline(NOW + HOUR, NOW)).toBe("just now");
    });
  });
});
