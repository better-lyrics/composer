import { alternateBackgroundPlacement } from "@/domain/language/background-placement";
import type { LyricLine } from "insync/line";
import { backgroundText, lineText, syllableJoint } from "insync/line-text";
import { mainTrack } from "insync/line-track";

// -- Types --------------------------------------------------------------------

// Where a row shows its background track: the `(...)` token at [start, end). A bracketed background was stored with
// its brackets, so the token is its text; otherwise the brackets only wrap it.
interface BackgroundRange {
  start: number;
  end: number;
  bracketed: boolean;
}

interface ShownRow {
  text: string;
  background: BackgroundRange | null;
}

interface ShownEditText {
  text: string;
  ranges: readonly BackgroundRange[];
}

// -- Constants ----------------------------------------------------------------

const NO_RANGES: readonly BackgroundRange[] = [];

// -- Rows ---------------------------------------------------------------------

const rowByLine = new WeakMap<LyricLine, { splitChar: string; row: ShownRow }>();

function isBracketed(text: string): boolean {
  return text.startsWith("(") && text.endsWith(")");
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

function rowWithToken(before: string, token: string, after: string, bracketed: boolean): ShownRow {
  const lead = before ? `${before} ` : "";
  const text = `${lead}${token}${after ? ` ${after}` : ""}`;
  return { text, background: { start: lead.length, end: lead.length + token.length, bracketed } };
}

// The background goes where the export places it among the main words; an untimed one goes at the end.
function computeShownRow(line: LyricLine, splitChar: string): ShownRow {
  const main = lineText(line, splitChar);
  const background = backgroundText(line, splitChar)?.trim();
  if (!background) return { text: main, background: null };
  const bracketed = isBracketed(background);
  const token = bracketed ? background : `(${background})`;
  const placement = alternateBackgroundPlacement(line);
  if (placement.position === "front") return rowWithToken("", token, main.trimStart(), bracketed);
  const offset = placement.position === "middle" ? middleOffset(line, placement.afterWordIndex, splitChar) : null;
  if (offset === null) return rowWithToken(main.trimEnd(), token, "", bracketed);
  return rowWithToken(main.slice(0, offset).trimEnd(), token, main.slice(offset), bracketed);
}

function shownRow(line: LyricLine, splitChar: string): ShownRow {
  const cached = rowByLine.get(line);
  if (cached?.splitChar === splitChar) return cached.row;
  const row = computeShownRow(line, splitChar);
  rowByLine.set(line, { splitChar, row });
  return row;
}

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
    if (row.background) ranges.push(shiftedRange(row.background, offset));
    rows.push(row.text);
    offset += row.text.length + 1;
  }
  return { text: rows.join("\n"), ranges: ranges.length === 0 ? NO_RANGES : ranges };
}

// -- Exports ------------------------------------------------------------------

export type { BackgroundRange, ShownEditText };
export { NO_RANGES, shiftedRange, shownEditText, shownRow };
