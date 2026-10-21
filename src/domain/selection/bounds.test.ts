import { selectionBounds } from "@/domain/selection/bounds";
import type { WordSelection } from "@/domain/selection/model";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function sel(lineId: string, wordIndex: number, type: "word" | "bg" = "word"): WordSelection {
  return { lineId, lineIndex: 0, wordIndex, type };
}

const wordLine = createLine({
  id: "a",
  text: "Hold me close",
  words: [
    { text: "Hold ", begin: 1, end: 1.4 },
    { text: "me ", begin: 1.4, end: 1.7 },
    { text: "close", begin: 1.7, end: 2.3 },
  ],
  backgroundText: "ooh",
  backgroundWords: [{ text: "ooh", begin: 2.5, end: 3 }],
});

const nextLine = createLine({
  id: "b",
  text: "Never let",
  words: [
    { text: "Never ", begin: 4, end: 4.5 },
    { text: "let", begin: 4.5, end: 4.8 },
  ],
});

const lineSynced = createLine({ id: "c", text: "Whole line", begin: 6, end: 8 });

// -- selectionBounds ----------------------------------------------------------

describe("selectionBounds", () => {
  it("returns a single word's bounds", () => {
    expect(selectionBounds([wordLine], [sel("a", 2)])).toEqual({ begin: 1.7, end: 2.3 });
  });

  it("spans words across lines regardless of selection order", () => {
    expect(selectionBounds([wordLine, nextLine], [sel("b", 1), sel("a", 0)])).toEqual({ begin: 1, end: 4.8 });
  });

  it("includes background words", () => {
    expect(selectionBounds([wordLine], [sel("a", 2), sel("a", 0, "bg")])).toEqual({ begin: 1.7, end: 3 });
  });

  it("reads a line-synced row through its effective word", () => {
    expect(selectionBounds([lineSynced], [sel("c", 0)])).toEqual({ begin: 6, end: 8 });
  });

  describe("edge cases", () => {
    it("returns null for an empty selection", () => {
      expect(selectionBounds([wordLine], [])).toBeNull();
    });

    it("skips selections that point past the timed words", () => {
      expect(selectionBounds([wordLine], [sel("a", 1), sel("a", 9)])).toEqual({ begin: 1.4, end: 1.7 });
    });

    it("returns null when nothing selected is timed", () => {
      const untimed = createLine({ id: "u", text: "No timing" });
      expect(selectionBounds([untimed], [sel("u", 0)])).toBeNull();
    });

    it("skips selections whose line no longer exists", () => {
      expect(selectionBounds([wordLine], [sel("gone", 0), sel("a", 0)])).toEqual({ begin: 1, end: 1.4 });
    });
  });
});
