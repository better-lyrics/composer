import type { LyricLine } from "@/domain/line/model";
import { trackWords } from "@/domain/line/tracks";
import { boundsOverlap } from "@/domain/word/overlap";

// -- Functions ----------------------------------------------------------------

function makeDragOverlapCheck(
  draggedWord: { lineId: string; wordIndex: number; trackType: "word" | "bg"; begin: number; end: number },
  lines: LyricLine[],
) {
  const line = lines.find((l) => l.id === draggedWord.lineId);
  if (!line) return () => true;
  const wordsArr = trackWords(line, draggedWord.trackType) ?? [];
  return (shift: number) => {
    const newBegin = draggedWord.begin + shift;
    const newEnd = draggedWord.end + shift;
    return !wordsArr.some((w, i) => {
      if (i === draggedWord.wordIndex) return false;
      return boundsOverlap({ begin: newBegin, end: newEnd }, w);
    });
  };
}

// -- Exports ------------------------------------------------------------------

export { makeDragOverlapCheck };
