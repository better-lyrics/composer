import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import type { WordTiming } from "@/domain/word/timing";

function shiftWords(words: readonly WordTiming[], delta: number): WordTiming[] {
  return words.map((w) => ({ ...w, begin: Math.max(0, w.begin + delta), end: Math.max(0, w.end + delta) }));
}

// Background words move with the main vocal so they keep their place relative to it.
function shiftLineTiming(line: LyricLine, delta: number): Partial<LyricLine> {
  const background = line.backgroundWords?.length ? { backgroundWords: shiftWords(line.backgroundWords, delta) } : {};
  if (line.words?.length) return { words: shiftWords(line.words, delta), ...background };
  if (isLineSynced(line)) {
    return { begin: Math.max(0, line.begin + delta), end: Math.max(0, line.end + delta), ...background };
  }
  return background;
}

export { shiftLineTiming, shiftWords };
