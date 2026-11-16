import type { LyricLine } from "./line";
import {
  type ExtractOptions,
  extractBackgroundVocals,
  extractionSlot,
  lineHasInlineParens,
} from "./background-vocal-extraction";

// -- Functions ----------------------------------------------------------------

// Inline extraction of the given lines, read with every linked instance of theirs so the instances extract together or
// not at all. Other lines are never read, and a row of only brackets waits for the whole pass.
function extractBackgroundVocalsOnLines(
  lines: LyricLine[],
  lineIds: ReadonlySet<string>,
  options: ExtractOptions,
  splitChar: string,
  songEnd = Number.POSITIVE_INFINITY,
): LyricLine[] {
  const slots = new Set<string>();
  let hasCandidate = false;
  for (const line of lines) {
    if (!lineIds.has(line.id) || !lineHasInlineParens(line, splitChar)) continue;
    hasCandidate = true;
    const slot = extractionSlot(line);
    if (slot !== null) slots.add(slot);
  }
  if (!hasCandidate) return lines;
  const window = lines.filter((line) => lineIds.has(line.id) || slots.has(extractionSlot(line) ?? ""));
  const extracted = extractBackgroundVocals(window, { ...options, mergeStandaloneLines: false }, splitChar, songEnd);
  const byId = new Map<string, LyricLine>();
  extracted.forEach((line, index) => {
    if (line !== window[index]) byId.set(line.id, line);
  });
  return byId.size === 0 ? lines : lines.map((line) => byId.get(line.id) ?? line);
}

// -- Exports ------------------------------------------------------------------

export { extractBackgroundVocalsOnLines };
