interface PasteAlignment {
  mappedLines: string[];
  pastedLineCount: number;
  strategy: "preserve" | "compact" | "manual";
  warning?: string;
}

function pastedRows(text: string): string[] {
  const rows = text.replace(/\r\n?/g, "\n").split("\n");
  while (rows.length > 0 && rows[rows.length - 1] === "") rows.pop();
  return rows;
}

function alignPastedLanguageLines(text: string, sourceLines: string[]): PasteAlignment {
  const rows = pastedRows(text);
  if (rows.length === sourceLines.length) {
    return { mappedLines: rows, pastedLineCount: rows.length, strategy: "preserve" };
  }

  const compactRows = rows.filter((row) => row.trim());
  const nonemptySourceIndices = sourceLines.flatMap((line, index) => (line.trim() ? [index] : []));
  if (compactRows.length === nonemptySourceIndices.length) {
    const mappedLines = sourceLines.map(() => "");
    nonemptySourceIndices.forEach((sourceIndex, index) => {
      mappedLines[sourceIndex] = compactRows[index];
    });
    return { mappedLines, pastedLineCount: rows.length, strategy: "compact" };
  }

  return {
    mappedLines: sourceLines.map((_, index) => rows[index] ?? ""),
    pastedLineCount: rows.length,
    strategy: "manual",
    warning: `Pasted ${rows.length} lines for ${sourceLines.length} lyric lines. Edit either side of the mapping before importing.`,
  };
}

export { alignPastedLanguageLines, pastedRows };
export type { PasteAlignment };
