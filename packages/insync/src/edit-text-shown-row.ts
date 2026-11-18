import { hasBalancedBrackets } from "./background-vocal-brackets";
import { alternateBackgroundPlacement } from "./language-background-placement";
import type { LyricLine } from "./line";
import { backgroundText, lineText, syllableJoint } from "./line-text";
import { mainTrack } from "./line-track";
import { memoBySplitCharacter } from "./memo-by-identity";

// -- Types --------------------------------------------------------------------

// Where a row shows its background track: the `(...)` token at [start, end). A bracketed background was stored with
// its brackets, so the token is its text; otherwise the brackets only wrap it. `withoutMain` marks a token shown for a
// line with no main text, so a row of only such tokens reads back as that line instead of as typed text.
interface BackgroundRange {
  start: number;
  end: number;
  bracketed: boolean;
  withoutMain?: true;
}

interface ShownRow {
  text: string;
  backgrounds: readonly BackgroundRange[];
}

interface ShownEditText {
  text: string;
  ranges: readonly BackgroundRange[];
}

// -- Constants ----------------------------------------------------------------

const NO_RANGES: readonly BackgroundRange[] = [];

// -- Rows ---------------------------------------------------------------------

function isBracketed(text: string): boolean {
  return text.startsWith("(") && text.endsWith(")");
}

// Where each top-level `(...)` group of a token starts and ends; null when the token is not groups apart by spaces.
function bracketGroups(token: string): [number, number][] | null {
  const groups: [number, number][] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < token.length; index++) {
    const char = token[index];
    if (depth === 0 && char !== "(") {
      if (char.trim()) return null;
      continue;
    }
    if (char === "(") {
      if (depth === 0) start = index;
      depth++;
    } else if (char === ")") {
      depth--;
      if (depth === 0) groups.push([start, index + 1]);
    }
  }
  return depth === 0 && groups.length > 0 ? groups : null;
}

// A token that reads as exactly one `(...)` group, so typing never stores unbalanced brackets in a background.
function isOneGroup(token: string): boolean {
  const groups = bracketGroups(token);
  return groups?.length === 1 && groups[0][0] === 0 && groups[0][1] === token.length;
}

// The opening bracket still closes only at the very end, while a pair inside may be half typed.
function staysFramed(token: string): boolean {
  if (!isBracketed(token)) return false;
  let depth = 0;
  for (const char of token.slice(0, -1)) {
    if (char === "(") depth++;
    else if (char === ")" && --depth <= 0) return false;
  }
  return true;
}

const bracketCount = (token: string, bracket: string) => token.split(bracket).length - 1;

// A pair half typed inside a background only adds brackets; an edit that takes one out ends the background.
function keepsEveryBracket(oldToken: string, newToken: string): boolean {
  return ["(", ")"].every((bracket) => bracketCount(newToken, bracket) >= bracketCount(oldToken, bracket));
}

// Whether a token typed into still shows a background: one group, a background stored with its brackets that still
// frame it while a pair is typed inside, or a stored background that was never one group (an import can hold text
// between its groups) whose brackets still balance.
function keepsBackgroundToken(oldToken: string, newToken: string, bracketed: boolean): boolean {
  if (newToken.includes("\n")) return false;
  if (isOneGroup(newToken)) return true;
  const typingInside =
    bracketed &&
    keepsEveryBracket(oldToken, newToken) &&
    (isOneGroup(oldToken) || (isBracketed(oldToken) && !hasBalancedBrackets(oldToken)));
  return typingInside ? staysFramed(newToken) : !isOneGroup(oldToken) && hasBalancedBrackets(newToken);
}

// The main text's offset after the syllable a middle background follows, when a single space joins it to the next.
function middleOffset(line: LyricLine, afterIndex: number, splitChar: string): number | null {
  const { syllables } = mainTrack(line);
  if (syllableJoint(syllables, afterIndex, splitChar) !== " ") return null;
  let offset = 0;
  for (let index = 0; index <= afterIndex; index++) {
    offset += syllables[index].text.length + syllableJoint(syllables, index, splitChar).length;
  }
  return offset;
}

// A bracketed background of several groups shows one token per group, so text typed between them stays main text.
function rowWithToken(before: string, token: string, after: string, bracketed: boolean): ShownRow {
  const lead = before ? `${before} ` : "";
  const text = `${lead}${token}${after ? ` ${after}` : ""}`;
  const groups = (bracketed && bracketGroups(token)) || [[0, token.length]];
  const withoutMain = !before.trim() && !after.trim();
  const backgrounds = groups.map(([start, end]): BackgroundRange => {
    const range = { start: lead.length + start, end: lead.length + end, bracketed };
    return withoutMain ? { ...range, withoutMain: true } : range;
  });
  return { text, backgrounds };
}

// The background goes where the export places it among the main words; an untimed one goes at the end.
function computeShownRow(line: LyricLine, splitChar: string): ShownRow {
  const main = lineText(line, splitChar);
  const background = backgroundText(line, splitChar)?.trim();
  if (!background) return { text: main, backgrounds: NO_RANGES };
  const bracketed = isBracketed(background);
  const token = bracketed ? background : `(${background})`;
  const placement = alternateBackgroundPlacement(line);
  if (placement.position === "front") return rowWithToken("", token, main.trimStart(), bracketed);
  const offset = placement.position === "middle" ? middleOffset(line, placement.afterWordIndex, splitChar) : null;
  if (offset === null) return rowWithToken(main.trimEnd(), token, "", bracketed);
  return rowWithToken(main.slice(0, offset).trimEnd(), token, main.slice(offset), bracketed);
}

const shownRow = memoBySplitCharacter(computeShownRow);

function shiftedRange(range: BackgroundRange, by: number): BackgroundRange {
  return by === 0 ? range : { ...range, start: range.start + by, end: range.end + by };
}

// The Edit text: one row per line, each showing its background track inline.
function shownEditText(lines: readonly LyricLine[], splitChar: string): ShownEditText {
  const rows: string[] = [];
  const ranges: BackgroundRange[] = [];
  let offset = 0;
  for (const line of lines) {
    const row = shownRow(line, splitChar);
    for (const background of row.backgrounds) ranges.push(shiftedRange(background, offset));
    rows.push(row.text);
    offset += row.text.length + 1;
  }
  return { text: rows.join("\n"), ranges: ranges.length === 0 ? NO_RANGES : ranges };
}

// -- Exports ------------------------------------------------------------------

export type { BackgroundRange, ShownEditText };
export { keepsBackgroundToken, NO_RANGES, shiftedRange, shownEditText, shownRow };
