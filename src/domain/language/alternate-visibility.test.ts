import { alternateMatchesMainText } from "@/domain/language/alternate-visibility";
import { describe, expect, it } from "vitest";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

describe("alternateMatchesMainText", () => {
  it("matches case, punctuation, split markers, and whitespace like Better Lyrics", () => {
    expect(alternateMatchesMainText("SAME,   LINE!", "same| line", DEFAULT_SPLIT_CHARACTER)).toBe(true);
  });

  it("keeps visibly different text", () => {
    expect(alternateMatchesMainText("different line", "same line", DEFAULT_SPLIT_CHARACTER)).toBe(false);
  });
});
