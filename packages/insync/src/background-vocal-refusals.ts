import type { LyricLine } from "./line";
import { extractionSlot, keepsTypedBackgroundGroups, lineHasInlineParens } from "./background-vocal-extraction";
import { memoBySplitCharacter } from "./memo-by-identity";

// -- Types --------------------------------------------------------------------

type BackgroundBracketRefusal = "own" | "linked";

interface LineBrackets {
  keepsOwn: boolean;
  hasInline: boolean;
}

// -- Helpers ------------------------------------------------------------------

const lineBrackets = memoBySplitCharacter(
  (line: LyricLine, splitChar: string): LineBrackets => ({
    keepsOwn: keepsTypedBackgroundGroups(line, splitChar),
    hasInline: lineHasInlineParens(line, splitChar),
  }),
);

// -- Functions ----------------------------------------------------------------

// Lines whose typed brackets stay text because of a timed background: their own, or a linked instance's, which
// refuses extraction for every instance of its template line.
function backgroundBracketRefusals(
  lines: readonly LyricLine[],
  splitChar: string,
): Map<string, BackgroundBracketRefusal> {
  const refusals = new Map<string, BackgroundBracketRefusal>();
  const refusedSlots = new Set<string>();
  for (const line of lines) {
    if (!lineBrackets(line, splitChar).keepsOwn) continue;
    refusals.set(line.id, "own");
    const slot = extractionSlot(line);
    if (slot !== null) refusedSlots.add(slot);
  }
  if (refusedSlots.size === 0) return refusals;
  for (const line of lines) {
    const slot = extractionSlot(line);
    if (slot === null || !refusedSlots.has(slot) || refusals.has(line.id)) continue;
    if (lineBrackets(line, splitChar).hasInline) refusals.set(line.id, "linked");
  }
  return refusals;
}

// -- Exports ------------------------------------------------------------------

export type { BackgroundBracketRefusal };
export { backgroundBracketRefusals };
