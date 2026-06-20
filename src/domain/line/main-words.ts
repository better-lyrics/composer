import { type LineFields, type LyricLine, reconcileLine } from "@/domain/line/model";
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import type { WordTiming } from "@/domain/word/timing";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

type MainWordFields = Pick<LineFields, "text"> & { words: WordTiming[] };

// -- Functions ----------------------------------------------------------------

// Spread-friendly partial for the main-word funnel: returns the reconciled
// `{ words, text }` pair so callers building Partial<LyricLine> updates can
// Object.assign without first constructing a full line.
function mainWordEditFields(words: WordTiming[]): MainWordFields {
  return { words, text: reconstructLineText(words, getSplitCharacter()) };
}

// Single chokepoint for writing a line's main words from a timeline-side edit
// (reorder, paste, move, cross-line drop). Re-derives text so it stays coherent
// with the new word order. Edit-view text writes funnel through
// reconcileMatchedTiming in the opposite direction and do not call this.
function applyMainWordEdit(line: LyricLine, words: WordTiming[]): LyricLine {
  return reconcileLine({ ...line, ...mainWordEditFields(words) });
}

// -- Exports ------------------------------------------------------------------

export { applyMainWordEdit, mainWordEditFields };
