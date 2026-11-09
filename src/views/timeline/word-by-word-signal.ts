import { noteGuideSignal } from "@/lib/guide-signals";

// -- State --------------------------------------------------------------------

const lastMovedWord = new Map<string, number>();

// -- API ----------------------------------------------------------------------

// Counts a lone word drag only when it moves a different word of the line than the last one, so refining one word never counts.
function noteLoneWordMove(lineId: string, track: "word" | "bg", wordIndex: number): void {
  const key = `${lineId}:${track}`;
  if (lastMovedWord.get(key) === wordIndex) return;
  lastMovedWord.set(key, wordIndex);
  noteGuideSignal("timeline.wordByWord", key);
}

// -- Exports ------------------------------------------------------------------

export { noteLoneWordMove };
