import { useMemo } from "react";
import type { LyricLine } from "insync/line";
import { lineText } from "insync/line-text";
import { useSettingsStore } from "@/stores/settings";
import {
  type ExtractOptions,
  extractBackgroundVocals,
  extractionSlot,
  refusesExtraction,
} from "insync/background-vocal-extraction";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

interface WindowVerdict {
  previous: LyricLine | undefined;
  options: ExtractOptions;
  splitCharacter: string;
  changes: boolean;
  refuses: boolean;
}

// -- Constants ----------------------------------------------------------------

const verdicts = new WeakMap<LyricLine, WindowVerdict>();

// -- Helpers ------------------------------------------------------------------

// Whether the line itself changes, or merges into the line before it; the line before has a window of its own.
function windowChanges(previous: LyricLine | undefined, line: LyricLine, options: ExtractOptions): boolean {
  const window = previous ? [previous, line] : [line];
  const extracted = extractBackgroundVocals(window, options, getSplitCharacter());
  return extracted.length !== window.length || extracted.at(-1) !== line;
}

function lineVerdict(
  previous: LyricLine | undefined,
  line: LyricLine,
  options: ExtractOptions,
  splitCharacter: string,
): WindowVerdict {
  const cached = verdicts.get(line);
  if (
    cached &&
    cached.previous === previous &&
    cached.options === options &&
    cached.splitCharacter === splitCharacter
  ) {
    return cached;
  }
  const verdict = {
    previous,
    options,
    splitCharacter,
    changes: windowChanges(previous, line, options),
    refuses: refusesExtraction(line, options, getSplitCharacter()),
  };
  verdicts.set(line, verdict);
  return verdict;
}

// The whole-list pass changes a line exactly when the line, read with only the line before it, changes and no linked
// instance of its template line refuses extraction. Only a line holding "(" can change.
function extractableLineCount(lines: readonly LyricLine[], options: ExtractOptions, splitCharacter: string): number {
  const verdictsByLine = new Map<LyricLine, WindowVerdict>();
  const refusedSlots = new Set<string>();
  lines.forEach((line, index) => {
    if (!lineText(line, getSplitCharacter()).includes("(")) return;
    const verdict = lineVerdict(lines[index - 1], line, options, splitCharacter);
    verdictsByLine.set(line, verdict);
    if (verdict.refuses) refusedSlots.add(extractionSlot(line) ?? "");
  });
  let count = 0;
  for (const [line, verdict] of verdictsByLine) {
    if (verdict.changes && !refusedSlots.has(extractionSlot(line) ?? "")) count++;
  }
  return count;
}

// -- Hooks --------------------------------------------------------------------

function useExtractableLineCount(lines: readonly LyricLine[], options: ExtractOptions): number {
  const splitCharacter = useSettingsStore((s) => s.splitCharacter);
  return useMemo(() => extractableLineCount(lines, options, splitCharacter), [lines, options, splitCharacter]);
}

// -- Exports ------------------------------------------------------------------

export { extractableLineCount, useExtractableLineCount };
