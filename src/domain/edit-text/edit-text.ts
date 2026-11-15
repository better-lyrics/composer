import type { LyricLine } from "@/domain/line/model";

function linesToEditText(lines: readonly LyricLine[]): string {
  return lines.map((line) => line.text).join("\n");
}

// Rows the user typed stay verbatim (spaces mid-typing survive); only rows a linked edit rewrote show the committed text.
function editTextWithRewrittenRows(
  typedText: string,
  typedLines: readonly LyricLine[],
  finalLines: readonly LyricLine[],
): string {
  return typedText
    .split("\n")
    .map((row, i) => (finalLines[i] === typedLines[i] ? row : finalLines[i].text))
    .join("\n");
}

function shiftCaretPastRewrittenRows(typedText: string, displayedText: string, caret: number): number {
  const typedRows = typedText.split("\n");
  const displayedRows = displayedText.split("\n");
  if (typedRows.length !== displayedRows.length) return caret;
  let shift = 0;
  let rowStart = 0;
  for (let i = 0; i < typedRows.length; i++) {
    const rowEnd = rowStart + typedRows[i].length;
    if (caret <= rowEnd) break;
    shift += displayedRows[i].length - typedRows[i].length;
    rowStart = rowEnd + 1;
  }
  return caret + shift;
}

export { editTextWithRewrittenRows, linesToEditText, shiftCaretPastRewrittenRows };
