import { hasLyricLines } from "@/domain/project/lyrics-presence";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

describe("hasLyricLines", () => {
  it("is true when any line has main lyrics", () => {
    expect(hasLyricLines([createLine({ text: "" }), createLine({ text: "Waiting in a car" })])).toBe(true);
  });

  describe("edge cases", () => {
    it("is false for no lines", () => {
      expect(hasLyricLines([])).toBe(false);
    });

    it("is false when every line is blank or whitespace", () => {
      expect(hasLyricLines([createLine({ text: "" }), createLine({ text: "   " })])).toBe(false);
    });

    it("counts unicode lyrics", () => {
      expect(hasLyricLines([createLine({ text: "夜に駆ける" })])).toBe(true);
    });
  });
});
