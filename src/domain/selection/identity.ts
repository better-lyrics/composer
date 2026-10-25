import type { WordSelection } from "@/domain/selection/model";

// -- Identity -----------------------------------------------------------------

// A word selection is identified by (lineId, wordIndex, type); lineIndex is a
// render-position hint and never participates in identity comparisons.
type WordIdentity = Pick<WordSelection, "lineId" | "wordIndex" | "type">;

function sameWordSelection(a: WordIdentity, b: WordIdentity): boolean {
  return a.lineId === b.lineId && a.wordIndex === b.wordIndex && a.type === b.type;
}

function isWordSelected(selections: WordSelection[], lineId: string, wordIndex: number, type: "word" | "bg"): boolean {
  return selections.some((w) => w.lineId === lineId && w.wordIndex === wordIndex && w.type === type);
}

// -- Exports ------------------------------------------------------------------

export { isWordSelected, sameWordSelection };
export type { WordIdentity };
