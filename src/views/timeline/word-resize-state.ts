import type { Bounds } from "@/domain/word/bounds";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

interface DragState {
  wordIndex: number;
  edge: "left" | "right";
  begin: number;
  end: number;
  adjacentWordIndex?: number;
  adjacentBegin?: number;
  adjacentEnd?: number;
}

// -- Functions ----------------------------------------------------------------

function liveWordBounds(state: DragState): Map<number, Bounds> {
  const words = new Map<number, Bounds>([[state.wordIndex, { begin: state.begin, end: state.end }]]);
  if (state.adjacentWordIndex !== undefined && state.adjacentBegin !== undefined && state.adjacentEnd !== undefined) {
    words.set(state.adjacentWordIndex, { begin: state.adjacentBegin, end: state.adjacentEnd });
  }
  return words;
}

function displayedBounds(words: WordTiming[], wordIndex: number, dragState: DragState | null): Bounds {
  if (dragState?.wordIndex === wordIndex) return { begin: dragState.begin, end: dragState.end };
  if (dragState?.adjacentWordIndex === wordIndex)
    return { begin: dragState.adjacentBegin!, end: dragState.adjacentEnd! };
  const word = words[wordIndex];
  return { begin: word.begin, end: word.end };
}

function resizeChangedTiming(initial: DragState, final: DragState, words: WordTiming[]): boolean {
  if (final.begin !== initial.begin || final.end !== initial.end) return true;
  if (final.adjacentWordIndex === undefined) return false;
  const adjacent = words[final.adjacentWordIndex];
  return final.adjacentBegin !== adjacent.begin || final.adjacentEnd !== adjacent.end;
}

// -- Exports ------------------------------------------------------------------

export type { DragState };
export { displayedBounds, liveWordBounds, resizeChangedTiming };
