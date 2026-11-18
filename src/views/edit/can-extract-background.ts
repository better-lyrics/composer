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
import { backgroundNeedsOnePair } from "insync/background-vocal-one-pair";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

interface WindowVerdict {
  previous: LyricLine | undefined;
  options: ExtractOptions;
  splitCharacter: string;
  changes: boolean;
  mergesUp: boolean;
  refuses: boolean;
}

// -- Constants ----------------------------------------------------------------

const verdicts = new WeakMap<LyricLine, WindowVerdict>();

// -- Helpers ------------------------------------------------------------------

// Whether the line itself changes, or merges into the line before it; the line before has a window of its own.
function windowChange(previous: LyricLine | undefined, line: LyricLine, options: ExtractOptions) {
  const window = previous ? [previous, line] : [line];
  const extracted = extractBackgroundVocals(window, options, getSplitCharacter());
  const mergesUp = extracted.length !== window.length;
  return { changes: mergesUp || extracted.at(-1) !== line, mergesUp };
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
    ...windowChange(previous, line, options),
    refuses: refusesExtraction(line, options, getSplitCharacter()),
  };
  verdicts.set(line, verdict);
  return verdict;
}

// The whole-list pass changes a line exactly when the line, read with only the last line before it the pass keeps,
// changes and no linked instance of its template line refuses extraction. A row merged into the line above counts as
// changed. Only a line holding "(", or a background that is not one pair, can change.
function extractableLineCount(lines: readonly LyricLine[], options: ExtractOptions, splitCharacter: string): number {
  const verdictsByLine = new Map<LyricLine, WindowVerdict>();
  const refusedSlots = new Set<string>();
  let kept: LyricLine | undefined;
  for (const line of lines) {
    if (!lineText(line, getSplitCharacter()).includes("(") && !backgroundNeedsOnePair(line, getSplitCharacter())) {
      kept = line;
      continue;
    }
    const verdict = lineVerdict(kept, line, options, splitCharacter);
    verdictsByLine.set(line, verdict);
    if (verdict.refuses) refusedSlots.add(extractionSlot(line) ?? "");
    if (!verdict.mergesUp) kept = line;
  }
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
