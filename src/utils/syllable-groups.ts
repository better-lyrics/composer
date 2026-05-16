import type { WordTiming } from "@/stores/project";

// -- Types --------------------------------------------------------------------

interface SyllableGroup {
  startIndex: number;
  endIndex: number;
  originalWord: string;
}

type SyllablePosition = "none" | "first" | "middle" | "last";

// -- Functions ----------------------------------------------------------------

function computeSyllableGroups(words: WordTiming[]): SyllableGroup[] {
  const groups: SyllableGroup[] = [];
  let groupStart = 0;

  for (let i = 0; i < words.length; i++) {
    const hasTrailingSpace = words[i].text.endsWith(" ");
    const isLast = i === words.length - 1;

    if (hasTrailingSpace || isLast) {
      if (i > groupStart) {
        const joined = words
          .slice(groupStart, i + 1)
          .map((w) => w.text)
          .join("")
          .trim();
        groups.push({ startIndex: groupStart, endIndex: i, originalWord: joined });
      }
      groupStart = i + 1;
    }
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

function expandToSyllableGroup(words: WordTiming[], indices: number[]): number[] {
  if (indices.length === 0) return [];
  const groups = computeSyllableGroups(words);
  if (groups.length === 0) return Array.from(new Set(indices)).sort((a, b) => a - b);
  const expanded = new Set<number>(indices);
  for (const i of indices) {
    const group = groups.find((g) => i >= g.startIndex && i <= g.endIndex);
    if (!group) continue;
    for (let k = group.startIndex; k <= group.endIndex; k++) expanded.add(k);
  }
  return Array.from(expanded).sort((a, b) => a - b);
}

// -- Exports ------------------------------------------------------------------

export { computeSyllableGroups, expandToSyllableGroup, getSyllablePositions };
export type { SyllablePosition };
