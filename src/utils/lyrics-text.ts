import { CLEARED_BACKGROUND } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import { reconcileMatchedTiming } from "@/domain/line/reconcile-text";
import { cleanSplitCharacters, stripSplitCharacter } from "@/utils/split-character";

// -- Helpers ------------------------------------------------------------------

function matchKey(text: string): string {
  return stripSplitCharacter(cleanSplitCharacters(text.trim()));
}

function carriesBackground(line: LyricLine): boolean {
  return (
    line.backgroundText !== undefined || line.backgroundWords !== undefined || line.backgroundTextSource !== undefined
  );
}

function keepsNoTimedBackground(line: LyricLine, source: LyricLine | undefined): boolean {
  const sourceText = source && cleanSplitCharacters(source.text.trim());
  return sourceText !== line.text || !line.backgroundWords?.length;
}

// Each typed row takes the earliest existing row with its text after the last one taken: in order, linear time.
function inOrderKeyPairs(
  existingKeys: string[],
  typedKeys: string[],
  start: number,
  existingEnd: number,
  typedEnd: number,
): Array<[number, number]> {
  const rowsByKey = new Map<string, number[]>();
  for (let index = existingEnd - 1; index >= start; index--) {
    const rows = rowsByKey.get(existingKeys[index]);
    if (rows) rows.push(index);
    else rowsByKey.set(existingKeys[index], [index]);
  }
  const pairs: Array<[number, number]> = [];
  let lastTaken = start - 1;
  for (let typedIndex = start; typedIndex < typedEnd; typedIndex++) {
    const rows = rowsByKey.get(typedKeys[typedIndex]);
    while (rows?.length && rows[rows.length - 1] <= lastTaken) rows.pop();
    const existingIndex = rows?.pop();
    if (existingIndex === undefined) continue;
    pairs.push([existingIndex, typedIndex]);
    lastTaken = existingIndex;
  }
  return pairs;
}

function unchangedRowPairs(existingKeys: string[], typedKeys: string[]): Array<[number, number]> {
  let head = 0;
  while (head < existingKeys.length && head < typedKeys.length && existingKeys[head] === typedKeys[head]) head++;
  let tail = 0;
  while (
    tail < existingKeys.length - head &&
    tail < typedKeys.length - head &&
    existingKeys[existingKeys.length - 1 - tail] === typedKeys[typedKeys.length - 1 - tail]
  ) {
    tail++;
  }
  const middle = inOrderKeyPairs(existingKeys, typedKeys, head, existingKeys.length - tail, typedKeys.length - tail);
  const prefix = Array.from({ length: head }, (_, index): [number, number] => [index, index]);
  const suffix = Array.from({ length: tail }, (_, offset): [number, number] => [
    existingKeys.length - tail + offset,
    typedKeys.length - tail + offset,
  ]);
  return [...prefix, ...middle, ...suffix];
}

function textToLyricLines(text: string, defaultAgentId: string, existingLines: LyricLine[] = []): LyricLine[] {
  const textToCandidates = new Map<string, LyricLine[]>();
  const existingKeys = existingLines.map((line) => matchKey(line.text));
  existingLines.forEach((line, index) => {
    const key = existingKeys[index];
    let bucket = textToCandidates.get(key);
    if (!bucket) {
      bucket = [];
      textToCandidates.set(key, bucket);
    }
    bucket.push(line);
  });

  const usedExistingIds = new Set<string>();
  const newLines = text.split("\n");
  // Position-based fallback only makes sense when the user is editing-in-place
  // (same number of typed lines as existing lines). If the count changed, the
  // user inserted or deleted rows: position-match would silently overwrite the
  // wrong existing line, so we generate a fresh id for any unmatched typed line.
  const allowPositionMatch = newLines.length === existingLines.length;

  const cleanedTexts = newLines.map((lineText) => cleanSplitCharacters(lineText.trim()));
  const cleanedKeys = cleanedTexts.map(matchKey);
  const claimed: Array<LyricLine | undefined> = new Array(newLines.length);
  const claim = (index: number, line: LyricLine) => {
    claimed[index] = line;
    usedExistingIds.add(line.id);
  };

  // Unchanged rows claim first, so a repeated line is never taken by a copy elsewhere in the song.
  if (allowPositionMatch) {
    cleanedKeys.forEach((_, index) => {
      if (existingKeys[index] === cleanedKeys[index]) claim(index, existingLines[index]);
    });
  } else {
    for (const [existingIndex, typedIndex] of unchangedRowPairs(existingKeys, cleanedKeys)) {
      claim(typedIndex, existingLines[existingIndex]);
    }
  }

  cleanedKeys.forEach((_, index) => {
    if (claimed[index]) return;
    const exactMatch = textToCandidates.get(cleanedKeys[index])?.find((line) => !usedExistingIds.has(line.id));
    if (exactMatch) claim(index, exactMatch);
  });

  const sources: Array<LyricLine | undefined> = new Array(newLines.length);
  const mapped = cleanedTexts.map((cleanedText, index) => {
    const matched = claimed[index];
    if (matched) {
      sources[index] = matched;
      return reconcileMatchedTiming(matched, cleanedText);
    }

    if (allowPositionMatch) {
      const positionMatch = existingLines[index];
      if (!usedExistingIds.has(positionMatch.id)) {
        usedExistingIds.add(positionMatch.id);
        sources[index] = positionMatch;
        return reconcileMatchedTiming(positionMatch, cleanedText);
      }
    }

    return {
      id: crypto.randomUUID(),
      text: cleanedText,
      agentId: defaultAgentId,
    };
  });

  // Parentheses in a row stand for its background vocals, so a carried-over background would double on
  // re-extraction. Timed background words on a row the edit left unchanged are kept.
  return mapped.map((line, index) =>
    carriesBackground(line) && keepsNoTimedBackground(line, sources[index]) && /\([^)]*\)/.test(line.text)
      ? { ...line, ...CLEARED_BACKGROUND }
      : line,
  );
}

// -- Exports ------------------------------------------------------------------

export { textToLyricLines };
