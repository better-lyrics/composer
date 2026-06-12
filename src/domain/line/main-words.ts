import { reconcileLine, type LyricLine } from "@/domain/line/model";
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import type { WordTiming } from "@/domain/word/timing";
import { getSplitCharacter } from "@/utils/split-character";

// -- Functions ----------------------------------------------------------------

// Single chokepoint for writing a line's main words from a timeline-side edit
// (reorder, paste, move, cross-line drop). Re-derives text so it stays coherent
// with the new word order. Edit-view text writes funnel through
// reconcileMatchedTiming in the opposite direction and do not call this.
function applyMainWordEdit(line: LyricLine, words: WordTiming[]): LyricLine {
  return reconcileLine({ ...line, words, text: reconstructLineText(words, getSplitCharacter()) });
}

// -- Exports ------------------------------------------------------------------

export { applyMainWordEdit };
