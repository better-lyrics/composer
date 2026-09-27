import { describe, expect, it } from "vitest";
import { matchesAllTerms, splitSearchTerms } from "@/utils/search-terms";

describe("splitSearchTerms", () => {
  it("lowercases and splits on whitespace", () => {
    expect(splitSearchTerms("Snap  Playhead")).toEqual(["snap", "playhead"]);
  });

  describe("edge cases", () => {
    it("returns no terms for an empty or whitespace query", () => {
      expect(splitSearchTerms("")).toEqual([]);
      expect(splitSearchTerms("   \t\n")).toEqual([]);
    });

    it("keeps punctuation and unicode as-is", () => {
      expect(splitSearchTerms("(magnet) Café")).toEqual(["(magnet)", "café"]);
    });
  });
});

describe("matchesAllTerms", () => {
  it("requires every term to appear", () => {
    expect(matchesAllTerms("Snap playhead to points", ["snap", "points"])).toBe(true);
    expect(matchesAllTerms("Snap playhead to points", ["snap", "zoom"])).toBe(false);
  });

  it("is case-insensitive on the haystack", () => {
    expect(matchesAllTerms("SNAP", ["snap"])).toBe(true);
  });

  describe("invariants", () => {
    it("matches everything when there are no terms", () => {
      expect(matchesAllTerms("anything", [])).toBe(true);
    });
  });
});
