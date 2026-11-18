import type { LyricLine } from "insync/line";
import { fieldWords, trackField } from "insync/line-track";
import type { SyllableAddress } from "insync/selection-model";
import { resolveAddresses } from "insync/selection-resolve";
import { expandSelectionToGroupmates } from "insync/word-syllable-groups";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types ---------------------------------------------------------------------

interface ExplicitTarget {
  lineId: string;
  field: "words" | "backgroundWords";
  wordIndex: number;
}

interface ExplicitToggleResolution {
  targets: ExplicitTarget[];
  value: boolean;
  // Selected words that take the mark; a line-synced block takes none.
  markable: number;
}

// -- Functions -----------------------------------------------------------------

function resolveExplicitSelectionToggle(
  lines: LyricLine[],
  selection: readonly SyllableAddress[],
): ExplicitToggleResolution {
  const linesById = new Map(lines.map((l) => [l.id, l]));
  const groups = new Map<string, { lineId: string; field: "words" | "backgroundWords"; indices: number[] }>();
  let markable = 0;

  for (const w of resolveAddresses(lines, selection, getSplitCharacter())) {
    const field = trackField(w.type);
    const line = linesById.get(w.lineId);
    const wordsArr = line ? fieldWords(line, field) : undefined;
    if (!wordsArr || w.wordIndex < 0 || w.wordIndex >= wordsArr.length) continue;
    markable++;
    const key = `${w.lineId}:${field}`;
    const existing = groups.get(key);
    if (existing) existing.indices.push(w.wordIndex);
    else groups.set(key, { lineId: w.lineId, field, indices: [w.wordIndex] });
  }

  const targets: ExplicitTarget[] = [];
  let allMarked = true;

  for (const group of groups.values()) {
    const groupLine = linesById.get(group.lineId);
    const wordsArr = groupLine && fieldWords(groupLine, group.field);
    if (!wordsArr) continue;
    const expanded = expandSelectionToGroupmates(wordsArr, group.indices).filter((i) => i >= 0 && i < wordsArr.length);
    for (const idx of expanded) {
      targets.push({ lineId: group.lineId, field: group.field, wordIndex: idx });
      if (wordsArr[idx].explicit !== true) allMarked = false;
    }
  }

  return { targets, value: !allMarked, markable };
}

// -- Exports -------------------------------------------------------------------

export type { ExplicitToggleResolution };
export { resolveExplicitSelectionToggle };
