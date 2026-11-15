import { nanoid } from "nanoid";
import type { WordTiming } from "@/domain/word/timing";

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
    const hasTrailingSpace = words[i].sep.endsWith(" ");
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

function absorbDeletedSyllablesIntoNeighbors(words: WordTiming[], deletedIndices: Iterable<number>): WordTiming[] {
  const deleted = new Set<number>();
  for (const i of deletedIndices) deleted.add(i);
  if (deleted.size === 0) return words;

  const beginExtensions = new Map<number, number>();
  const endExtensions = new Map<number, number>();

  for (let i = 0; i < words.length; i++) {
    if (!deleted.has(i)) continue;
    const groupId = words[i].syllableGroupId;
    if (groupId === undefined) continue;

    let leftIdx = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (words[j].syllableGroupId !== groupId) break;
      if (!deleted.has(j)) {
        leftIdx = j;
        break;
      }
    }

    if (leftIdx >= 0) {
      const cur = endExtensions.get(leftIdx);
      endExtensions.set(leftIdx, cur === undefined ? words[i].end : Math.max(cur, words[i].end));
      continue;
    }

    for (let j = i + 1; j < words.length; j++) {
      if (words[j].syllableGroupId !== groupId) break;
      if (!deleted.has(j)) {
        const cur = beginExtensions.get(j);
        beginExtensions.set(j, cur === undefined ? words[i].begin : Math.min(cur, words[i].begin));
        break;
      }
    }
  }

  const handedBoundaries = boundariesHandedBack(words, deleted);
  if (beginExtensions.size === 0 && endExtensions.size === 0 && handedBoundaries.size === 0) return words;

  return words.map((w, i) => {
    const newBegin = beginExtensions.get(i);
    const newEnd = endExtensions.get(i);
    const boundary = handedBoundaries.get(i);
    if (newBegin === undefined && newEnd === undefined && boundary === undefined) return w;
    return {
      ...w,
      sep: boundary === undefined ? w.sep : `${w.sep}${boundary}`,
      begin: newBegin !== undefined && newBegin < w.begin ? newBegin : w.begin,
      end: newEnd !== undefined && newEnd > w.end ? newEnd : w.end,
    };
  });
}

// Deleting spans never joins the words on either side: when a deleted run held a word boundary, the
// surviving span before it takes that boundary's whitespace.
function boundariesHandedBack(words: WordTiming[], deleted: Set<number>): Map<number, string> {
  const handed = new Map<number, string>();
  for (let i = 1; i < words.length; i++) {
    if (!deleted.has(i) || deleted.has(i - 1)) continue;
    let end = i;
    while (deleted.has(end + 1)) end++;
    const boundary = words.slice(i, end + 1).findLast((w) => w.sep.endsWith(" "))?.sep;
    const survivorAfter = end + 1 < words.length;
    if (survivorAfter && boundary && !words[i - 1].sep.endsWith(" ")) handed.set(i - 1, boundary);
  }
  return handed;
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

function hasIntraGroupGap(words: WordTiming[]): boolean {
  for (let i = 0; i < words.length - 1; i++) {
    const id = words[i].syllableGroupId;
    if (id === undefined) continue;
    if (words[i + 1].syllableGroupId !== id) continue;
    if (words[i].end < words[i + 1].begin) return true;
  }
  return false;
}

function closeIntraGroupGaps(words: WordTiming[]): WordTiming[] {
  if (words.length < 2) return words;
  let changed = false;
  const result = words.slice();
  for (let i = 0; i < result.length - 1; i++) {
    const id = result[i].syllableGroupId;
    if (id === undefined) continue;
    if (result[i + 1].syllableGroupId !== id) continue;
    if (result[i].end < result[i + 1].begin) {
      result[i] = { ...result[i], end: result[i + 1].begin };
      changed = true;
    }
  }
  return changed ? result : words;
}

// -- Exports ------------------------------------------------------------------

export type { SyllablePosition };
export {
  absorbDeletedSyllablesIntoNeighbors,
  closeIntraGroupGaps,
  computeByGroupId,
  computeSyllableGroups,
  expandSelectionToGroupmates,
  getSyllablePositions,
  hasIntraGroupGap,
  inferSyllableGroupIds,
};
