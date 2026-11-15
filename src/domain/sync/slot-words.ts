import type { Syllable } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

// -- Functions ----------------------------------------------------------------

// A slot past the timed words is the next untimed syllable, timed in place: it keeps its id, text and join.
function withSlotWord(
  existing: readonly WordTiming[],
  slots: readonly Syllable[],
  index: number,
  timing: { begin: number; end: number },
): WordTiming[] {
  const words = [...existing];
  words[index] = { ...(existing.at(index) ?? slots[index]), ...timing };
  return words;
}

// -- Exports ------------------------------------------------------------------

export { withSlotWord };
