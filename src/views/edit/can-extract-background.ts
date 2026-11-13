import { useMemo } from "react";
import type { LyricLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
import { useSettingsStore } from "@/stores/settings";
import { extractBackgroundVocals } from "@/utils/background-vocal-extraction";

// -- Types --------------------------------------------------------------------

type ExtractOptions = Parameters<typeof extractBackgroundVocals>[1];

interface WindowVerdict {
  previous: LyricLine | undefined;
  options: ExtractOptions;
  splitCharacter: string;
  changes: boolean;
}

// -- Constants ----------------------------------------------------------------

const verdicts = new WeakMap<LyricLine, WindowVerdict>();

// -- Helpers ------------------------------------------------------------------

function windowChanges(previous: LyricLine | undefined, line: LyricLine, options: ExtractOptions): boolean {
  const window = previous ? [previous, line] : [line];
  const extracted = extractBackgroundVocals(window, options);
  return extracted.length !== window.length || extracted.some((extractedLine, i) => extractedLine !== window[i]);
}

function lineStartsChange(
  previous: LyricLine | undefined,
  line: LyricLine,
  options: ExtractOptions,
  splitCharacter: string,
): boolean {
  const cached = verdicts.get(line);
  if (
    cached &&
    cached.previous === previous &&
    cached.options === options &&
    cached.splitCharacter === splitCharacter
  ) {
    return cached.changes;
  }
  const changes = windowChanges(previous, line, options);
  verdicts.set(line, { previous, options, splitCharacter, changes });
  return changes;
}

// The whole-list pass changes nothing before its first change, so it changes something exactly when
// some line, read with only the line before it, does. Only a line holding "(" can start a change.
function canExtractBackgroundVocals(
  lines: readonly LyricLine[],
  options: ExtractOptions,
  splitCharacter: string,
): boolean {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (lineText(line).includes("(") && lineStartsChange(lines[i - 1], line, options, splitCharacter)) return true;
  }
  return false;
}

// -- Hooks --------------------------------------------------------------------

function useCanExtractBackgroundVocals(lines: readonly LyricLine[], options: ExtractOptions): boolean {
  const splitCharacter = useSettingsStore((s) => s.splitCharacter);
  return useMemo(() => canExtractBackgroundVocals(lines, options, splitCharacter), [lines, options, splitCharacter]);
}

// -- Exports ------------------------------------------------------------------

export { useCanExtractBackgroundVocals };
