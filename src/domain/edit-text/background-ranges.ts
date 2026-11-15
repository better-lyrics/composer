import { diffChars } from "diff";
import {
  type BackgroundRange,
  NO_RANGES,
  type ShownEditText,
  shiftedRange,
  shownRow,
} from "@/domain/edit-text/shown-row";
import type { LyricLine } from "insync/line";

// -- Types --------------------------------------------------------------------

// A typed row read back into its tracks: the main text, and the background it shows (null when it shows none).
interface EditRow {
  text: string;
  background: string | null;
}

// Old-text positions; `newEnd` is where the run ends once its new text replaces the old.
interface ChangedRegion {
  start: number;
  oldEnd: number;
  newEnd: number;
}

// -- Change -------------------------------------------------------------------

function commonPrefix(oldText: string, newText: string, limit: number): number {
  let length = 0;
  while (length < limit && oldText[length] === newText[length]) length++;
  return length;
}

function endsAlike(oldText: string, newText: string, length: number): boolean {
  for (let index = 1; index <= length; index++) {
    if (oldText[oldText.length - index] !== newText[newText.length - index]) return false;
  }
  return true;
}

function plainRegion(oldText: string, newText: string): ChangedRegion {
  const start = commonPrefix(oldText, newText, Math.min(oldText.length, newText.length));
  let suffix = 0;
  const room = Math.min(oldText.length, newText.length) - start;
  while (suffix < room && oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]) suffix++;
  return { start, oldEnd: oldText.length - suffix, newEnd: newText.length - suffix };
}

// A typed or deleted run at the caret, checked with whole-string compares so a keystroke never walks the text.
function caretRegion(oldText: string, newText: string, caret: number): ChangedRegion | null {
  const delta = newText.length - oldText.length;
  const start = delta > 0 ? caret - delta : caret;
  const oldEnd = delta > 0 ? start : caret - delta;
  if (start < 0 || oldEnd > oldText.length) return null;
  const same = oldText.slice(0, start) === newText.slice(0, start) && oldText.slice(oldEnd) === newText.slice(caret);
  return same ? { start, oldEnd, newEnd: caret } : null;
}

// The one run of text a keystroke changed. Where repeated letters leave its place unclear, it ends at the caret.
function changedRegion(oldText: string, newText: string, caret?: number): ChangedRegion {
  const typed = caret === undefined ? null : caretRegion(oldText, newText, caret);
  if (typed) return typed;
  const plain = plainRegion(oldText, newText);
  const shift = caret === undefined ? 0 : plain.newEnd - caret;
  if (shift <= 0 || shift > plain.start || !endsAlike(oldText, newText, newText.length - (caret ?? 0))) return plain;
  return { start: plain.start - shift, oldEnd: plain.oldEnd - shift, newEnd: plain.newEnd - shift };
}

// One input may change several runs apart (autocorrect, replace): read them out of the one region it spans.
function changedRuns(oldText: string, newText: string, region: ChangedRegion): ChangedRegion[] {
  const changes = diffChars(oldText.slice(region.start, region.oldEnd), newText.slice(region.start, region.newEnd));
  const runs: ChangedRegion[] = [];
  let oldAt = region.start;
  let open: ChangedRegion | null = null;
  for (const change of changes) {
    const length = change.value.length;
    if (!change.added && !change.removed) {
      if (open) runs.push(open);
      open = null;
      oldAt += length;
      continue;
    }
    // A run's ends are kept in old-text positions, so its new end minus its old end is its own length change.
    open ??= { start: oldAt, oldEnd: oldAt, newEnd: oldAt };
    if (change.removed) open = { ...open, oldEnd: open.oldEnd + length };
    else open = { ...open, newEnd: open.newEnd + length };
    if (change.removed) oldAt += length;
  }
  if (open) runs.push(open);
  return runs;
}

// A change before a background token moves it, one inside its brackets grows or shrinks it, and one that touches a
// bracket turns the token into plain text.
function remappedRange(range: BackgroundRange, runs: readonly ChangedRegion[], newText: string) {
  let shift = 0;
  let growth = 0;
  for (const run of runs) {
    const delta = run.newEnd - run.oldEnd;
    if (run.oldEnd <= range.start) shift += delta;
    else if (run.start >= range.end) break;
    else if (run.start <= range.start || run.oldEnd >= range.end) return null;
    else growth += delta;
  }
  const moved = { ...range, start: range.start + shift, end: range.end + shift + growth };
  return newText.slice(moved.start, moved.end).includes("\n") ? null : moved;
}

function remapBackgroundRanges(
  oldText: string,
  newText: string,
  ranges: readonly BackgroundRange[],
  caret?: number,
): readonly BackgroundRange[] {
  if (ranges.length === 0 || oldText === newText) return ranges;
  const region = changedRegion(oldText, newText, caret);
  const remapAll = (runs: readonly ChangedRegion[]) => ranges.map((range) => remappedRange(range, runs, newText));
  let remapped = remapAll([region]);
  if (remapped.includes(null)) remapped = remapAll(changedRuns(oldText, newText, region));
  const kept = remapped.filter((range) => range !== null);
  return kept.length === 0 ? NO_RANGES : kept;
}

// -- Rows ---------------------------------------------------------------------

// Main text either side of a token joins with one space, as the row showed it.
function joinedAtSeam(before: string, after: string): string {
  const left = before.trimEnd();
  const right = after.trimStart();
  return left && right ? `${left} ${right}` : left + right;
}

function tokenText(text: string, range: BackgroundRange): string {
  return (range.bracketed ? text.slice(range.start, range.end) : text.slice(range.start + 1, range.end - 1)).trim();
}

function editRow(row: string, rowStart: number, ranges: readonly BackgroundRange[]): EditRow {
  if (ranges.length === 0) return { text: row, background: null };
  const own = ranges.map((range) => shiftedRange(range, -rowStart));
  const segments: string[] = [];
  let at = 0;
  for (const range of own) {
    segments.push(row.slice(at, range.start));
    at = range.end;
  }
  segments.push(row.slice(at));
  const background = own
    .map((range) => tokenText(row, range))
    .filter(Boolean)
    .join(" ");
  const main = segments.reduce(joinedAtSeam);
  // A row of tokens only stays text, as a typed row of brackets always has.
  return main ? { text: main, background: background || null } : { text: row, background: null };
}

// Each row of the Edit text, split into the main text and the background its tokens show.
function editRows(text: string, ranges: readonly BackgroundRange[]): EditRow[] {
  const sorted = ranges.toSorted((a, b) => a.start - b.start);
  let next = 0;
  let rowStart = 0;
  return text.split("\n").map((row) => {
    const rowEnd = rowStart + row.length;
    const own: BackgroundRange[] = [];
    while (next < sorted.length && sorted[next].end <= rowEnd) {
      if (sorted[next].start >= rowStart) own.push(sorted[next]);
      next++;
    }
    const parsed = editRow(row, rowStart, own);
    rowStart = rowEnd + 1;
    return parsed;
  });
}

// Rows the user typed stay verbatim with their tokens; only rows a linked edit rewrote show the committed line.
function shownWithRewrittenRows(
  typed: ShownEditText,
  typedLines: readonly LyricLine[],
  finalLines: readonly LyricLine[],
  splitChar: string,
): ShownEditText {
  const rows: string[] = [];
  const ranges: BackgroundRange[] = [];
  const sorted = typed.ranges.toSorted((a, b) => a.start - b.start);
  let next = 0;
  let oldStart = 0;
  let newStart = 0;
  typed.text.split("\n").forEach((row, index) => {
    const rewritten = finalLines[index] !== typedLines[index] ? shownRow(finalLines[index], splitChar) : null;
    const shown = rewritten?.text ?? row;
    if (rewritten?.background) ranges.push(shiftedRange(rewritten.background, newStart));
    const rowEnd = oldStart + row.length;
    for (; next < sorted.length && sorted[next].end <= rowEnd; next++) {
      if (!rewritten && sorted[next].start >= oldStart) ranges.push(shiftedRange(sorted[next], newStart - oldStart));
    }
    rows.push(shown);
    oldStart += row.length + 1;
    newStart += shown.length + 1;
  });
  return { text: rows.join("\n"), ranges: ranges.length === 0 ? NO_RANGES : ranges };
}

// -- Exports ------------------------------------------------------------------

export { editRows, remapBackgroundRanges, shownWithRewrittenRows };
