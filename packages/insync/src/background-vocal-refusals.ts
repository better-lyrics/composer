import type { LyricLine } from "./line";
import {
  classifyLine,
  extractionSlot,
  keepsTypedBackgroundGroups,
  lineHasInlineParens,
} from "./background-vocal-extraction";
import { gluedGroups } from "./background-vocal-glued-groups";
import { isWordSynced } from "./line-predicates";
import { lineText } from "./line-text";
import { memoBySplitCharacter } from "./memo-by-identity";

// -- Types --------------------------------------------------------------------

type BackgroundBracketRefusal = "own" | "linked" | "glued";

interface LineBrackets {
  keepsOwn: boolean;
  hasInline: boolean;
  glued: boolean;
}

// -- Helpers ------------------------------------------------------------------

function hasGluedGroup(line: LyricLine, splitChar: string): boolean {
  if (!isWordSynced(line)) return false;
  const classified = classifyLine(lineText(line, splitChar));
  return classified.kind === "inline" && gluedGroups(line, classified.groups, splitChar).size > 0;
}

const lineBrackets = memoBySplitCharacter(
  (line: LyricLine, splitChar: string): LineBrackets => ({
    keepsOwn: keepsTypedBackgroundGroups(line, splitChar),
    hasInline: lineHasInlineParens(line, splitChar),
    glued: hasGluedGroup(line, splitChar),
  }),
);

// -- Functions ----------------------------------------------------------------

// Lines whose typed brackets stay text because of a timed background: their own, or a linked instance's, which
// refuses extraction for every instance of its template line; or because a timed word holds the bracket.
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
  for (const line of lines)
    if (!refusals.has(line.id) && lineBrackets(line, splitChar).glued) refusals.set(line.id, "glued");
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
