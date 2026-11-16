import type { LyricLine } from "./line";
import { lineText } from "./line-text";
import { DEFAULT_SPLIT_CHARACTER } from "./split-character-text";

function linesToEditText(lines: readonly LyricLine[], splitChar: string): string {
  return lines.map((line) => lineText(line, splitChar)).join("\n");
}

// Rows the user typed stay verbatim (spaces mid-typing survive); only rows a linked edit rewrote show the committed text.
function editTextWithRewrittenRows(
  typedText: string,
  typedLines: readonly (LyricLine | undefined)[],
  finalLines: readonly LyricLine[],
  splitChar: string,
): string {
  return typedText
    .split("\n")
    .map((row, i) => (finalLines[i] === typedLines[i] ? row : lineText(finalLines[i], splitChar)))
    .join("\n");
}

// A caret inside the part of its own row the rewrite changed lands where that change starts.
function caretInRewrittenRow(typedRow: string, displayedRow: string, offset: number): number {
  let prefix = 0;
  while (prefix < typedRow.length && typedRow[prefix] === displayedRow[prefix]) prefix++;
  if (offset <= prefix) return offset;
  const unchangedTail = Math.min(typedRow.length, displayedRow.length) - prefix;
  let suffix = 0;
  while (suffix < unchangedTail && typedRow.at(-1 - suffix) === displayedRow.at(-1 - suffix)) suffix++;
  if (offset >= typedRow.length - suffix) return offset + displayedRow.length - typedRow.length;
  return prefix;
}

// -- Caret by content ----------------------------------------------------------

interface Group {
  start: number;
  end: number;
}

// Top-level `(...)` groups of each row, where a shown background sits.
function rowGroups(text: string): Group[] {
  const groups: Group[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "\n") depth = 0;
    else if (char === "(" && depth++ === 0) start = index;
    else if (char === ")" && depth > 0 && --depth === 0) groups.push({ start, end: index + 1 });
  }
  return groups;
}

// The text's own letters, without spaces, row breaks, split marks or bracket groups, where each sits, and its groups.
function contentOf(text: string, splitChar: string) {
  const groups = rowGroups(text);
  const positions: number[] = [];
  let next = 0;
  for (let index = 0; index < text.length; index++) {
    if (next < groups.length && index === groups[next].start) {
      index = groups[next++].end - 1;
      continue;
    }
    const char = text[index];
    if (char !== splitChar && char.trim()) positions.push(index);
  }
  const letters = positions.map((index) => text[index]).join("");
  const groupTexts = groups.map((group) => text.slice(group.start, group.end));
  return { positions, groups, groupTexts, key: `${letters}\u0000${groupTexts.toSorted().join("\u0000")}` };
}

// Where the caret goes when a redraw only moved things around (bracket groups, spaces, split marks, row breaks): after
// the same letter of the main text, then past the same spaces and breaks it had after that letter; inside a group, at
// the same place in that group. Null when the redraw changed the text itself.
function caretThroughRedraw(typed: string, displayed: string, caret: number, splitChar: string): number | null {
  if (typed === displayed) return caret;
  const before = contentOf(typed, splitChar);
  const after = contentOf(displayed, splitChar);
  if (before.key !== after.key) return null;
  const inGroup = before.groups.findIndex((group) => group.start < caret && caret < group.end);
  if (inGroup >= 0) {
    const text = before.groupTexts[inGroup];
    const nth = before.groupTexts.slice(0, inGroup).filter((other) => other === text).length;
    const matching = after.groups.filter((_, index) => after.groupTexts[index] === text);
    const target = matching[nth];
    return target ? target.start + caret - before.groups[inGroup].start : null;
  }
  const count = before.positions.filter((position) => position < caret).length;
  const typedFrom = count > 0 ? before.positions[count - 1] + 1 : 0;
  let at = count > 0 ? after.positions[count - 1] + 1 : 0;
  const gap = [...typed.slice(typedFrom, caret)].filter((_, offset) => {
    const index = typedFrom + offset;
    return !before.groups.some((group) => group.start <= index && index < group.end);
  });
  for (const char of gap) {
    const group = after.groups.find((candidate) => candidate.start === at);
    if (group && char !== "(") at = group.end;
    if (displayed[at] === char) at++;
  }
  return at;
}

function shiftCaretPastRewrittenRows(
  typedText: string,
  displayedText: string,
  caret: number,
  splitChar = DEFAULT_SPLIT_CHARACTER,
): number {
  const typedRows = typedText.split("\n");
  const displayedRows = displayedText.split("\n");
  if (typedRows.length !== displayedRows.length) return caret;
  let displayedStart = 0;
  let rowStart = 0;
  for (let i = 0; i < typedRows.length; i++) {
    const rowEnd = rowStart + typedRows[i].length;
    if (caret <= rowEnd) {
      const offset = caret - rowStart;
      const mapped =
        caretThroughRedraw(typedRows[i], displayedRows[i], offset, splitChar) ??
        caretInRewrittenRow(typedRows[i], displayedRows[i], offset);
      return displayedStart + mapped;
    }
    displayedStart += displayedRows[i].length + 1;
    rowStart = rowEnd + 1;
  }
  return caret;
}

export { caretThroughRedraw, editTextWithRewrittenRows, linesToEditText, shiftCaretPastRewrittenRows };
