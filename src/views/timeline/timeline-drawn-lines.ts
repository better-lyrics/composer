import type { LyricLine } from "@/domain/line/model";
import { useSettingsStore } from "@/stores/settings";
import { getSplitCharacter } from "@/utils/split-character";

// -- State --------------------------------------------------------------------

let lastLines: readonly LyricLine[] | null = null;
let lastSplitCharacter = "";
let lastDrawnLines: LyricLine[] = [];

// -- Functions ----------------------------------------------------------------

// A new array per lines change and split character, so anything keyed on it redraws when the split character changes.
function drawnLines(lines: readonly LyricLine[]): LyricLine[] {
  return [...lines];
}

function timelineDrawnLines(lines: readonly LyricLine[]): LyricLine[] {
  const splitCharacter = getSplitCharacter();
  if (lines !== lastLines || splitCharacter !== lastSplitCharacter) {
    lastDrawnLines = drawnLines(lines);
    lastLines = lines;
    lastSplitCharacter = splitCharacter;
  }
  return lastDrawnLines;
}

function useTimelineDrawnLines(lines: readonly LyricLine[]): LyricLine[] {
  useSettingsStore((s) => s.splitCharacter);
  return timelineDrawnLines(lines);
}

// -- Exports ------------------------------------------------------------------

export { timelineDrawnLines, useTimelineDrawnLines };
