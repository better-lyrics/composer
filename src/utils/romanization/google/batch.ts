const WORD_SEP = "␞";
const LINE_SEP = "␝";

const LINE_SEPARATOR_CANDIDATES = [`\n\n${LINE_SEP}\n\n`, LINE_SEP, "\n\n;\n\n", ";", "\n\n"];

function encodeBatch(lines: ReadonlyArray<ReadonlyArray<string>>): string {
  if (lines.length === 0) return "";
  return lines.map((words) => words.join(WORD_SEP)).join(`\n\n${LINE_SEP}\n\n`);
}

function parseBatchResponse(romaji: string, expectedWordCounts?: ReadonlyArray<number>): Array<string[] | null> {
  if (expectedWordCounts && expectedWordCounts.length === 0) return [];
  if (romaji.length === 0) {
    if (!expectedWordCounts) return [];
    return expectedWordCounts.map((count) => (count === 0 ? [] : null));
  }
  const lineParts = splitOnLineSeparator(romaji);
  const lineCount = expectedWordCounts ? expectedWordCounts.length : lineParts.length;
  const out: Array<string[] | null> = [];
  for (let i = 0; i < lineCount; i++) {
    const part = lineParts[i];
    if (part === undefined) {
      out.push(null);
      continue;
    }
    const words = part
      .split(WORD_SEP)
      .map((word) => word.trim())
      .filter((word) => word.length > 0);
    if (expectedWordCounts && words.length !== expectedWordCounts[i]) {
      out.push(null);
    } else {
      out.push(words);
    }
  }
  return out;
}

function splitOnLineSeparator(text: string): string[] {
  for (const separator of LINE_SEPARATOR_CANDIDATES) {
    if (text.includes(separator)) return text.split(separator);
  }
  return [text];
}

export { encodeBatch, LINE_SEP, parseBatchResponse, WORD_SEP };
