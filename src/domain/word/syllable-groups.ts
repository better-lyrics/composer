import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

interface SyllableGroup {
  startIndex: number;
  endIndex: number;
  originalWord: string;
}

type SyllablePosition = "none" | "first" | "middle" | "last";

// -- Functions ----------------------------------------------------------------

function joinSyllableText(words: readonly WordTiming[], start: number, end: number): string {
  return words
    .slice(start, end + 1)
    .map((w) => w.text.trim())
    .join("");
}

function joinsNextAt(words: readonly WordTiming[], index: number): boolean {
  return index < words.length - 1 && words[index].joinsNext;
}

function isInSyllableGroup(words: readonly WordTiming[], index: number): boolean {
  return joinsNextAt(words, index) || (index > 0 && joinsNextAt(words, index - 1));
}

// Run index per word: syllables that join share one, a word on its own gets its own.
function syllableRunIndices(words: readonly WordTiming[]): number[] {
  let run = 0;
  return words.map((_, index) => (index > 0 && !joinsNextAt(words, index - 1) ? ++run : run));
}

function computeSyllableGroups(words: readonly WordTiming[]): SyllableGroup[] {
  const groups: SyllableGroup[] = [];
  let start = 0;
  for (let index = 0; index < words.length; index++) {
    if (joinsNextAt(words, index)) continue;
    if (index > start) {
      groups.push({ startIndex: start, endIndex: index, originalWord: joinSyllableText(words, start, index) });
    }
    start = index + 1;
  }
  return groups;
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

  const runOf = syllableRunIndices(words);
  for (let i = 0; i < words.length; i++) {
    if (!deleted.has(i) || !isInSyllableGroup(words, i)) continue;

    let leftIdx = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (runOf[j] !== runOf[i]) break;
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
      if (runOf[j] !== runOf[i]) break;
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
      ...(boundary !== undefined && { sep: boundary, joinsNext: false }),
      begin: newBegin !== undefined && newBegin < w.begin ? newBegin : w.begin,
      end: newEnd !== undefined && newEnd > w.end ? newEnd : w.end,
    };
  });
}

// Deleting spans never joins the words on either side: when a deleted run held a word boundary, the
// surviving span before it ends the word and takes that boundary's separator (the new sep per survivor).
function boundariesHandedBack(words: WordTiming[], deleted: Set<number>): Map<number, string> {
  const handed = new Map<number, string>();
  for (let i = 1; i < words.length; i++) {
    if (!deleted.has(i) || deleted.has(i - 1)) continue;
    let end = i;
    while (deleted.has(end + 1)) end++;
    const boundary = words.slice(i, end + 1).findLast((w) => !w.joinsNext);
    const survivor = words[i - 1];
    if (end + 1 >= words.length || !boundary || !survivor.joinsNext) continue;
    handed.set(i - 1, survivor.sep.endsWith(" ") ? survivor.sep : survivor.sep + boundary.sep);
  }
  return handed;
}

// A word that stops joining gets a space after it, or reconstructLineText would glue it to the next word.
function endedWord(word: WordTiming): WordTiming {
  return { ...word, joinsNext: false, sep: word.sep.endsWith(" ") ? word.sep : `${word.sep} ` };
}

// A copy of a syllable whose next groupmate stays behind ends its word, so a paste never glues it to a stranger.
function copiedSyllable(words: readonly WordTiming[], index: number, copied: ReadonlySet<number>): WordTiming {
  const word = words[index];
  if (!word.joinsNext || (joinsNextAt(words, index) && copied.has(index + 1))) return { ...word };
  return endedWord(word);
}

function hasIntraGroupGap(words: WordTiming[]): boolean {
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].joinsNext && words[i].end < words[i + 1].begin) return true;
  }
  return false;
}

function closeIntraGroupGaps(words: WordTiming[]): WordTiming[] {
  if (words.length < 2) return words;
  let changed = false;
  const result = words.slice();
  for (let i = 0; i < result.length - 1; i++) {
    if (result[i].joinsNext && result[i].end < result[i + 1].begin) {
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
  computeSyllableGroups,
  copiedSyllable,
  endedWord,
  expandSelectionToGroupmates,
  getSyllablePositions,
  hasIntraGroupGap,
  isInSyllableGroup,
};
