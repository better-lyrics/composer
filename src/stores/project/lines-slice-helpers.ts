import { getLinkScope, isLinkedSibling } from "@/domain/group/linking";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { expandSelectionToGroupmates } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { addTrailingSpaceIfMissing, resolveOverlapsForward, trimTrailingSpaceFromLast } from "@/utils/word-spaces";
import { applySiblingWords } from "@/utils/word-diff";

// -- Types --------------------------------------------------------------------

type ExplicitTarget = { lineId: string; field: "words" | "backgroundWords"; wordIndex: number };

// -- Helpers ------------------------------------------------------------------

function expandTargetsToSyllableGroups(targets: ExplicitTarget[], linesById: Map<string, LyricLine>): ExplicitTarget[] {
  const byLineField = new Map<string, { lineId: string; field: "words" | "backgroundWords"; indices: number[] }>();
  for (const t of targets) {
    const key = `${t.lineId}:${t.field}`;
    const existing = byLineField.get(key);
    if (existing) existing.indices.push(t.wordIndex);
    else byLineField.set(key, { lineId: t.lineId, field: t.field, indices: [t.wordIndex] });
  }
  const out: ExplicitTarget[] = [];
  for (const group of byLineField.values()) {
    const line = linesById.get(group.lineId);
    const currentWords = line?.[group.field];
    const expanded = currentWords ? expandSelectionToGroupmates(currentWords, group.indices) : group.indices;
    for (const idx of expanded) out.push({ lineId: group.lineId, field: group.field, wordIndex: idx });
  }
  return out;
}

function applyExplicitTargetToLines(
  lines: LyricLine[],
  lineId: string,
  field: "words" | "backgroundWords",
  newWords: WordTiming[],
): LyricLine[] {
  const target = lines.find((l) => l.id === lineId);
  if (!target) return lines;
  const sourceBefore = target[field];
  const linkScope = getLinkScope(target);

  return lines.map((line) => {
    if (line.id === lineId) {
      return { ...line, [field]: newWords };
    }
    if (isLinkedSibling(line, linkScope)) {
      const propagated = applySiblingWords(newWords, sourceBefore, line[field]);
      if (propagated) return { ...line, [field]: propagated };
    }
    return line;
  });
}

function applyMoveToBg(line: LyricLine, wordIndices: number[], timeDelta: number, duration: number): LyricLine | null {
  if (!line.words) return null;
  const indexSet = new Set(wordIndices);
  const movedWords = line.words.flatMap((word, index) => {
    if (!indexSet.has(index)) return [];
    const dur = word.end - word.begin;
    const newBegin = Math.max(0, Math.min(duration - dur, word.begin + timeDelta));
    return [{ ...word, begin: newBegin, end: newBegin + dur }];
  });

  if (movedWords.length === 0) return null;

  const remainingMain = trimTrailingSpaceFromLast(line.words.filter((_, i) => !indexSet.has(i)));

  const prevBgLast = line.backgroundWords?.[line.backgroundWords.length - 1];
  const sortedBg = [...(line.backgroundWords ?? []), ...movedWords].sort((a, b) => a.begin - b.begin);
  const reconciledBg = prevBgLast ? addTrailingSpaceIfMissing(sortedBg, prevBgLast) : sortedBg;
  const mergedBg = trimTrailingSpaceFromLast(resolveOverlapsForward(reconciledBg, duration));

  return {
    ...line,
    words: remainingMain,
    backgroundWords: mergedBg,
  };
}

function applyMoveFromBg(
  line: LyricLine,
  wordIndices: number[],
  timeDelta: number,
  duration: number,
): LyricLine | null {
  if (!line.backgroundWords) return null;
  const indexSet = new Set(wordIndices);
  const movedWords = line.backgroundWords.flatMap((word, index) => {
    if (!indexSet.has(index)) return [];
    const dur = word.end - word.begin;
    const newBegin = Math.max(0, Math.min(duration - dur, word.begin + timeDelta));
    return [{ ...word, begin: newBegin, end: newBegin + dur }];
  });

  if (movedWords.length === 0) return null;

  const remainingBg = trimTrailingSpaceFromLast(line.backgroundWords.filter((_, i) => !indexSet.has(i)));

  const prevMainLast = line.words?.[line.words.length - 1];
  const sortedMain = [...(line.words ?? []), ...movedWords].sort((a, b) => a.begin - b.begin);
  const reconciledMain = prevMainLast ? addTrailingSpaceIfMissing(sortedMain, prevMainLast) : sortedMain;
  const mergedMain = trimTrailingSpaceFromLast(resolveOverlapsForward(reconciledMain, duration));

  const hasBg = remainingBg.length > 0;
  return reconcileLine({
    ...line,
    words: mergedMain,
    backgroundWords: hasBg ? remainingBg : undefined,
    backgroundText: hasBg ? line.backgroundText : undefined,
  });
}

// -- Exports ------------------------------------------------------------------

export { applyExplicitTargetToLines, applyMoveFromBg, applyMoveToBg, expandTargetsToSyllableGroups };
