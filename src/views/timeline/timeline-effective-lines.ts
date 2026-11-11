import { type EffectiveLine, getEffectiveLines } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { useSettingsStore } from "@/stores/settings";
import { getSplitCharacter } from "@/utils/split-character";

// -- State --------------------------------------------------------------------

let lastRawLines: readonly LyricLine[] | null = null;
let lastSplitCharacter = "";
let lastEffectiveLines: EffectiveLine[] = [];

// -- Functions ----------------------------------------------------------------

function timelineEffectiveLines(rawLines: readonly LyricLine[]): EffectiveLine[] {
  const splitCharacter = getSplitCharacter();
  if (rawLines !== lastRawLines || splitCharacter !== lastSplitCharacter) {
    lastEffectiveLines = getEffectiveLines(rawLines);
    lastRawLines = rawLines;
    lastSplitCharacter = splitCharacter;
  }
  return lastEffectiveLines;
}

function useTimelineEffectiveLines(rawLines: readonly LyricLine[]): EffectiveLine[] {
  useSettingsStore((s) => s.splitCharacter);
  return timelineEffectiveLines(rawLines);
}

// -- Exports ------------------------------------------------------------------

export { timelineEffectiveLines, useTimelineEffectiveLines };
