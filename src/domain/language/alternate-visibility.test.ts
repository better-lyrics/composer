import { alternateMatchesMainText } from "@/domain/language/alternate-visibility";
import { describe, expect, it } from "vitest";

describe("alternateMatchesMainText", () => {
  it("matches case, punctuation, split markers, and whitespace like Better Lyrics", () => {
    expect(alternateMatchesMainText("SAME,   LINE!", "same| line")).toBe(true);
  });

  it("keeps visibly different text", () => {
    expect(alternateMatchesMainText("different line", "same line")).toBe(false);
  });
});
