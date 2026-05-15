import type { LyricLine } from "@/stores/project";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";

// -- Types --------------------------------------------------------------------

interface Bounds {
  begin: number;
  end: number;
}

// -- Functions ----------------------------------------------------------------

function mainBounds(line: LyricLine): Bounds | null {
  if (isWordSynced(line)) {
    const words = line.words!;
    return { begin: words[0].begin, end: words[words.length - 1].end };
  }
  if (isLineSynced(line)) {
    return { begin: line.begin, end: line.end };
  }
  return null;
}

function bgBounds(line: LyricLine): Bounds | null {
  if (!line.backgroundWords?.length) return null;
  const bg = line.backgroundWords;
  return { begin: bg[0].begin, end: bg[bg.length - 1].end };
}

function effectiveBounds(line: LyricLine): Bounds | null {
  const main = mainBounds(line);
  if (!main) return null;
  const bg = bgBounds(line);
  if (!bg) return main;
  return { begin: Math.min(main.begin, bg.begin), end: Math.max(main.end, bg.end) };
}

// -- Exports ------------------------------------------------------------------

export { bgBounds, effectiveBounds, mainBounds };
export type { Bounds };
