import { describe, expect, it } from "vitest";
import { parseTxt } from "@/utils/lyrics-parsers/txt";

const texts = (content: string) => parseTxt(content).lines.map((line) => line.text);

describe("parseTxt", () => {
  it("keeps a blank line between stanzas as an empty line", () => {
    expect(texts("First\nSecond\n\nThird")).toEqual(["First", "Second", "", "Third"]);
  });

  it("cleans stray split characters from the edges of each word", () => {
    expect(texts("|sec|ond|")).toEqual(["sec|ond"]);
  });

  it("trims each line", () => {
    expect(texts("  padded  \r\nnext")).toEqual(["padded", "next"]);
  });

  describe("edge cases", () => {
    it("drops blank lines before the first and after the last lyric", () => {
      expect(texts("\n\nOnly\n\n")).toEqual(["Only"]);
    });

    it("keeps each blank line of a longer gap", () => {
      expect(texts("A\n\n\nB")).toEqual(["A", "", "", "B"]);
    });

    it("returns no lines for whitespace only content", () => {
      expect(texts("  \n \n")).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("reports no timing and no issues", () => {
      const result = parseTxt("A\n\nB");
      expect(result.hasTimingData).toBe(false);
      expect(result.issues).toEqual([]);
    });
  });
});
