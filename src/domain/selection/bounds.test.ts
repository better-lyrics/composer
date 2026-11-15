import { drawnSyllables } from "@/domain/line/drawn-track";
import { trackRole } from "insync/line-track";
import { selectionBounds } from "@/domain/selection/bounds";
import type { SyllableAddress } from "@/domain/selection/model";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

// -- Helpers ------------------------------------------------------------------

function sel(lineId: string, wordIndex: number, type: "word" | "bg" = "word"): SyllableAddress {
  const line = [wordLine, nextLine, lineSynced].find((candidate) => candidate.id === lineId);
  const word = line ? drawnSyllables(line, trackRole(type), DEFAULT_SPLIT_CHARACTER)[wordIndex] : undefined;
  return { lineId, type, syllableId: word?.id ?? `missing-${wordIndex}` };
}

const wordLine = createLine({
  id: "a",
  text: "Hold me close",
  words: [
    { text: "Hold", sep: " ", begin: 1, end: 1.4 },
    { text: "me", sep: " ", begin: 1.4, end: 1.7 },
    { text: "close", begin: 1.7, end: 2.3 },
  ],
  backgroundText: "ooh",
  backgroundWords: [{ text: "ooh", begin: 2.5, end: 3 }],
});

const nextLine = createLine({
  id: "b",
  text: "Never let",
  words: [
    { text: "Never", sep: " ", begin: 4, end: 4.5 },
    { text: "let", begin: 4.5, end: 4.8 },
  ],
});

const lineSynced = createLine({ id: "c", text: "Whole line", begin: 6, end: 8 });

// -- selectionBounds ----------------------------------------------------------

describe("selectionBounds", () => {
  it("returns a single word's bounds", () => {
    expect(selectionBounds([wordLine], [sel("a", 2)], DEFAULT_SPLIT_CHARACTER)).toEqual({ begin: 1.7, end: 2.3 });
  });

  it("spans words across lines regardless of selection order", () => {
    expect(selectionBounds([wordLine, nextLine], [sel("b", 1), sel("a", 0)], DEFAULT_SPLIT_CHARACTER)).toEqual({
      begin: 1,
      end: 4.8,
    });
  });

  it("includes background words", () => {
    expect(selectionBounds([wordLine], [sel("a", 2), sel("a", 0, "bg")], DEFAULT_SPLIT_CHARACTER)).toEqual({
      begin: 1.7,
      end: 3,
    });
  });

  it("reads a line-synced row through its effective word", () => {
    expect(selectionBounds([lineSynced], [sel("c", 0)], DEFAULT_SPLIT_CHARACTER)).toEqual({ begin: 6, end: 8 });
  });

  describe("edge cases", () => {
    it("returns null for an empty selection", () => {
      expect(selectionBounds([wordLine], [], DEFAULT_SPLIT_CHARACTER)).toBeNull();
    });

    it("skips selections that point past the timed words", () => {
      expect(selectionBounds([wordLine], [sel("a", 1), sel("a", 9)], DEFAULT_SPLIT_CHARACTER)).toEqual({
        begin: 1.4,
        end: 1.7,
      });
    });

    it("returns null when nothing selected is timed", () => {
      const untimed = createLine({ id: "u", text: "No timing" });
      expect(selectionBounds([untimed], [sel("u", 0)], DEFAULT_SPLIT_CHARACTER)).toBeNull();
    });

    it("skips selections whose line no longer exists", () => {
      expect(selectionBounds([wordLine], [sel("gone", 0), sel("a", 0)], DEFAULT_SPLIT_CHARACTER)).toEqual({
        begin: 1,
        end: 1.4,
      });
    });
  });
});
