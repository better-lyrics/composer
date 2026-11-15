import type { LyricLine } from "./line";
import { lineText } from "./line-text";

function linesToEditText(lines: readonly LyricLine[], splitChar: string): string {
  return lines.map((line) => lineText(line, splitChar)).join("\n");
}

// Rows the user typed stay verbatim (spaces mid-typing survive); only rows a linked edit rewrote show the committed text.
function editTextWithRewrittenRows(
  typedText: string,
  typedLines: readonly LyricLine[],
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

function shiftCaretPastRewrittenRows(typedText: string, displayedText: string, caret: number): number {
  const typedRows = typedText.split("\n");
  const displayedRows = displayedText.split("\n");
  if (typedRows.length !== displayedRows.length) return caret;
  let displayedStart = 0;
  let rowStart = 0;
  for (let i = 0; i < typedRows.length; i++) {
    const rowEnd = rowStart + typedRows[i].length;
    if (caret <= rowEnd) return displayedStart + caretInRewrittenRow(typedRows[i], displayedRows[i], caret - rowStart);
    displayedStart += displayedRows[i].length + 1;
    rowStart = rowEnd + 1;
  }
  return caret;
}

export { editTextWithRewrittenRows, linesToEditText, shiftCaretPastRewrittenRows };
