import { formatSavedAt, formatSavedWorkSummary } from "@/utils/format-saved-at";
import { describe, expect, it } from "vitest";

describe("formatSavedAt", () => {
  it("formats a timestamp in the reader's locale", () => {
    expect(formatSavedAt(1_715_000_000_000)).toBe(new Date(1_715_000_000_000).toLocaleString());
  });

  describe("edge cases", () => {
    it("reads unknown without a timestamp", () => {
      expect(formatSavedAt(undefined)).toBe("unknown");
      expect(formatSavedAt(0)).toBe("unknown");
    });
  });
});

describe("formatSavedWorkSummary", () => {
  it("counts the lines and says when they were last edited", () => {
    expect(formatSavedWorkSummary(12, 1_715_000_000_000)).toBe(
      `12 lines, last edited ${new Date(1_715_000_000_000).toLocaleString()}`,
    );
  });

  describe("edge cases", () => {
    it("uses the singular for one line and unknown without a timestamp", () => {
      expect(formatSavedWorkSummary(1, undefined)).toBe("1 line, last edited unknown");
    });
  });
});
