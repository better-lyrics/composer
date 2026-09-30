import type { LyricLine } from "@/domain/line/model";
import { lcsPairs, wordKey } from "@/domain/word/alignment";

// -- Types --------------------------------------------------------------------

interface Gap {
  stored: number[];
  edited: number[];
}

interface Candidate {
  editedIndex: number;
  storedIndex: number;
  score: number;
  distance: number;
}

// -- Constants ----------------------------------------------------------------

const MIN_SIMILARITY = 0.5;

// -- Helpers ------------------------------------------------------------------

function indexesBetween(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start - 1) }, (_, offset) => start + 1 + offset);
}

function gapsBetween(anchors: readonly [number, number][], storedCount: number, editedCount: number): Gap[] {
  const bounds: [number, number][] = [[-1, -1], ...anchors, [storedCount, editedCount]];
  return bounds.slice(1).map(([storedEnd, editedEnd], index) => {
    const [storedStart, editedStart] = bounds[index] ?? [-1, -1];
    return { stored: indexesBetween(storedStart, storedEnd), edited: indexesBetween(editedStart, editedEnd) };
  });
}

function similarity(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  return (2 * lcsPairs([...a], [...b]).length) / (a.length + b.length);
}

// -- Pairing ------------------------------------------------------------------

function pairEditedLines(stored: readonly LyricLine[], edited: readonly LyricLine[]): (number | undefined)[] {
  const storedKeys = stored.map((line) => wordKey(line.text));
  const editedKeys = edited.map((line) => wordKey(line.text));
  const storedCharacters = storedKeys.map((key) => Array.from(key));
  const editedCharacters = editedKeys.map((key) => Array.from(key));
  const partnerIndex = new Map<number, number>();
  const paired = new Set<number>();
  const pair = (editedIndex: number, storedIndex: number) => {
    partnerIndex.set(editedIndex, storedIndex);
    paired.add(storedIndex);
  };
  const freeEdited = (indexes: readonly number[]) => indexes.filter((index) => !partnerIndex.has(index));
  const freeStored = (indexes: readonly number[]) => indexes.filter((index) => !paired.has(index));
  const pairBySimilarity = (editedIndexes: readonly number[], storedIndexes: readonly number[]) => {
    const candidates = editedIndexes.flatMap((editedIndex) =>
      storedIndexes.flatMap((storedIndex): Candidate[] => {
        const score = similarity(editedCharacters[editedIndex] ?? [], storedCharacters[storedIndex] ?? []);
        return score >= MIN_SIMILARITY
          ? [{ editedIndex, storedIndex, score, distance: Math.abs(editedIndex - storedIndex) }]
          : [];
      }),
    );
    const ranked = candidates.toSorted(
      (a, b) => b.score - a.score || a.distance - b.distance || a.editedIndex - b.editedIndex,
    );
    for (const { editedIndex, storedIndex } of ranked) {
      if (!partnerIndex.has(editedIndex) && !paired.has(storedIndex)) pair(editedIndex, storedIndex);
    }
  };

  const anchors = lcsPairs(storedKeys, editedKeys);
  for (const [storedIndex, editedIndex] of anchors) pair(editedIndex, storedIndex);
  editedKeys.forEach((key, editedIndex) => {
    if (partnerIndex.has(editedIndex)) return;
    const moved = storedKeys.findIndex((storedKey, storedIndex) => !paired.has(storedIndex) && storedKey === key);
    if (moved >= 0) pair(editedIndex, moved);
  });
  const gaps = gapsBetween(anchors, stored.length, edited.length);
  for (const gap of gaps) pairBySimilarity(freeEdited(gap.edited), freeStored(gap.stored));
  pairBySimilarity(freeEdited(edited.map((_, index) => index)), freeStored(stored.map((_, index) => index)));
  for (const gap of gaps) {
    const editedLeft = freeEdited(gap.edited);
    const storedLeft = freeStored(gap.stored);
    if (editedLeft.length !== storedLeft.length) continue;
    editedLeft.forEach((editedIndex, offset) => {
      const storedIndex = storedLeft[offset];
      if (storedIndex !== undefined) pair(editedIndex, storedIndex);
    });
  }
  return edited.map((_, editedIndex) => partnerIndex.get(editedIndex));
}

// -- Exports ------------------------------------------------------------------

export { pairEditedLines };
