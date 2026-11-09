import { noteGuideSignal } from "@/lib/guide-signals";

// -- Constants ----------------------------------------------------------------

const TINY_DRAG_SECONDS = 0.03;

// -- API ----------------------------------------------------------------------

function noteWordDragShift(lineId: string, track: "word" | "bg", wordIndex: number, shiftSeconds: number): void {
  if (Math.abs(shiftSeconds) < TINY_DRAG_SECONDS)
    noteGuideSignal("timeline.tinyDrag", `${lineId}:${track}:${wordIndex}`);
}

// -- Exports ------------------------------------------------------------------

export { noteWordDragShift };
