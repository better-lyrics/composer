import type { LyricLine } from "./line";
import { generateLineTtml } from "./ttml/write";
import type { LineKeyIds } from "./ttml/line-keys";

// -- Types --------------------------------------------------------------------

interface EditedLinePairs {
  lines: LyricLine[];
  partners: (LyricLine | undefined)[];
}

// -- Helpers ------------------------------------------------------------------

function withoutAlternates(line: LyricLine): LyricLine {
  const { languages: _languages, ...main } = line;
  return main;
}

function mainExport(line: LyricLine, splitChar: string): string {
  return generateLineTtml(withoutAlternates(line), splitChar);
}

function indexesByKey(editedKeys: readonly (string | undefined)[]): Map<string, number[]> {
  const indexes = new Map<string, number[]>();
  editedKeys.forEach((key, index) => {
    if (key !== undefined) indexes.set(key, [...(indexes.get(key) ?? []), index]);
  });
  return indexes;
}

function withAlternatesOf(line: LyricLine, source: LyricLine): LyricLine {
  return {
    ...withoutAlternates(line),
    ...(source.languages ? { languages: source.languages } : {}),
  };
}

// -- Pairing ------------------------------------------------------------------

function pairEditedLines(
  stored: readonly LyricLine[],
  edited: readonly LyricLine[],
  editedKeys: readonly (string | undefined)[],
  keyIds: LineKeyIds,
  splitChar: string,
): EditedLinePairs {
  const storedById = new Map(stored.map((line) => [line.id, line] as const));
  const lines = [...edited];
  const partners: (LyricLine | undefined)[] = edited.map(() => undefined);
  for (const [key, indexes] of indexesByKey(editedKeys)) {
    const id = keyIds[key];
    const partner = id === undefined ? undefined : storedById.get(id);
    const [first] = indexes;
    if (!partner || first === undefined) continue;
    const form = mainExport(partner, splitChar);
    const chosen = indexes.find((index) => {
      const line = edited[index];
      return line !== undefined && mainExport(line, splitChar) === form;
    });
    const pairedIndex = chosen ?? first;
    partners[pairedIndex] = partner;
    const firstLine = edited[first];
    const pairedLine = edited[pairedIndex];
    if (pairedIndex !== first && firstLine && pairedLine) {
      lines[pairedIndex] = withAlternatesOf(pairedLine, firstLine);
      lines[first] = withoutAlternates(firstLine);
    }
  }
  return { lines, partners };
}

// -- Exports ------------------------------------------------------------------

export { pairEditedLines };
