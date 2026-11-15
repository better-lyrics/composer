import { type LanguageDisplayLine, type LanguageTextVariant, getLanguageDisplayLine } from "insync/language-display";
import type { LyricLine } from "insync/line";
import { useSettingsStore } from "@/stores/settings";
import { useMemo } from "react";
import { getSplitCharacter } from "@/utils/split-character";

// -- Interfaces ---------------------------------------------------------------

type SyncDisplayLine = Omit<LyricLine, keyof LanguageDisplayLine> & LanguageDisplayLine;

interface DisplayLineCache {
  textVariant: LanguageTextVariant;
  splitCharacter: string;
  byLine: WeakMap<LyricLine, SyncDisplayLine>;
}

// -- Functions ----------------------------------------------------------------

function displayLineFor(cache: DisplayLineCache, line: LyricLine): SyncDisplayLine {
  const cached = cache.byLine.get(line);
  if (cached) return cached;
  const displayLine = { ...line, ...getLanguageDisplayLine(line, cache.textVariant, getSplitCharacter()) };
  cache.byLine.set(line, displayLine);
  return displayLine;
}

// -- Hooks --------------------------------------------------------------------

// A tap replaces one line object, so every other line keeps its display line and the rows reading it stay memoized.
function useDisplayLines(lines: readonly LyricLine[], textVariant: LanguageTextVariant): SyncDisplayLine[] {
  const splitCharacter = useSettingsStore((s) => s.splitCharacter);
  const cache = useMemo<DisplayLineCache>(
    () => ({ textVariant, splitCharacter, byLine: new WeakMap() }),
    [textVariant, splitCharacter],
  );
  return useMemo(() => lines.map((line) => displayLineFor(cache, line)), [cache, lines]);
}

// -- Exports ------------------------------------------------------------------

export { useDisplayLines };
