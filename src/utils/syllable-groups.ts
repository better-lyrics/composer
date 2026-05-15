import type { WordTiming } from "@/stores/project";
import { nanoid } from "nanoid";

// -- Types --------------------------------------------------------------------

interface SyllableGroup {
  startIndex: number;
  endIndex: number;
  originalWord: string;
}

type SyllablePosition = "none" | "first" | "middle" | "last";

// -- Functions ----------------------------------------------------------------

function joinSyllableText(words: WordTiming[], start: number, end: number): string {
  return words
    .slice(start, end + 1)
    .map((w) => w.text.trim())
    .join("");
}

function computeByGroupId(words: WordTiming[]): SyllableGroup[] {
  const groups: SyllableGroup[] = [];
  let i = 0;
  while (i < words.length) {
    const id = words[i].syllableGroupId;
    if (id === undefined) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < words.length && words[end + 1].syllableGroupId === id) end++;
    if (end > i) {
      groups.push({ startIndex: i, endIndex: end, originalWord: joinSyllableText(words, i, end) });
    }
    i = end + 1;
  }
  return groups;
}

function computeByTrailingSpace(words: WordTiming[]): SyllableGroup[] {
  const groups: SyllableGroup[] = [];
  let groupStart = 0;

  for (let i = 0; i < words.length; i++) {
    const hasTrailingSpace = words[i].text.endsWith(" ");
    const isLast = i === words.length - 1;

    if (hasTrailingSpace || isLast) {
      if (i > groupStart) {
        groups.push({ startIndex: groupStart, endIndex: i, originalWord: joinSyllableText(words, groupStart, i) });
      }
      groupStart = i + 1;
    }
  }

  return groups;
}

function computeSyllableGroups(words: WordTiming[]): SyllableGroup[] {
  if (words.some((w) => w.syllableGroupId !== undefined)) {
    return computeByGroupId(words);
  }
  return computeByTrailingSpace(words);
}

function getSyllablePositions(words: WordTiming[]): SyllablePosition[] {
  const positions: SyllablePosition[] = new Array(words.length).fill("none");
  const groups = computeSyllableGroups(words);

  for (const group of groups) {
    positions[group.startIndex] = "first";
    positions[group.endIndex] = "last";
    for (let i = group.startIndex + 1; i < group.endIndex; i++) {
      positions[i] = "middle";
    }
  }

  return positions;
}

function expandSelectionToGroupmates(words: WordTiming[], indices: number[]): number[] {
  const inBounds = indices.filter((i) => i >= 0 && i < words.length);
  if (inBounds.length === 0) return [];
  const expanded = new Set<number>(inBounds);
  const groups = computeSyllableGroups(words);
  for (const idx of inBounds) {
    for (const group of groups) {
      if (idx >= group.startIndex && idx <= group.endIndex) {
        for (let i = group.startIndex; i <= group.endIndex; i++) expanded.add(i);
      }
    }
  }
  return Array.from(expanded).sort((a, b) => a - b);
}

function inferSyllableGroupIds(words: WordTiming[]): WordTiming[] {
  if (words.length === 0) return words;
  if (words.some((w) => w.syllableGroupId !== undefined)) return words;
  const groups = computeByTrailingSpace(words);
  if (groups.length === 0) return words;
  const result = words.slice();
  for (const group of groups) {
    const groupId = nanoid(8);
    for (let i = group.startIndex; i <= group.endIndex; i++) {
      result[i] = { ...result[i], syllableGroupId: groupId };
    }
  }
  return result;
}

// -- Exports ------------------------------------------------------------------

export { computeSyllableGroups, expandSelectionToGroupmates, getSyllablePositions, inferSyllableGroupIds };
export type { SyllablePosition };
