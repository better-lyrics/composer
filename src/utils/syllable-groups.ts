import type { WordTiming } from "@/stores/project";

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

// -- Exports ------------------------------------------------------------------

export { computeSyllableGroups, getSyllablePositions };
export type { SyllablePosition };
