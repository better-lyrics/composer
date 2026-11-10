import type { LyricLine } from "@/domain/line/model";
import { trackWords } from "@/domain/line/tracks";
import { boundsOverlap } from "@/domain/word/overlap";

// -- Functions ----------------------------------------------------------------

function makeDragOverlapCheck(
  data: { lineId: string; wordIndex: number; trackType: "word" | "bg"; begin: number; end: number },
  lines: LyricLine[],
) {
  const line = lines.find((l) => l.id === data.lineId);
  if (!line) return () => true;
  const wordsArr = trackWords(line, data.trackType) ?? [];
  return (shift: number) => {
    const newBegin = data.begin + shift;
    const newEnd = data.end + shift;
    return !wordsArr.some((w, i) => {
      if (i === data.wordIndex) return false;
      return boundsOverlap({ begin: newBegin, end: newEnd }, w);
    });
  };
}

// -- Exports ------------------------------------------------------------------

export { makeDragOverlapCheck };
