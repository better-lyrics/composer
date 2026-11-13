import { convertToWordTiming } from "@/domain/commands/line-timing";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import type { ReadableLine } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import type { SyllableAddress } from "@/domain/selection/model";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { convertLineToWord } from "@/utils/sync-helpers";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

interface LineWordsUpdate {
  id: string;
  updates: Partial<LyricLine>;
}

// -- Pure computation ----------------------------------------------------------

type SplitTarget = Pick<SyllableAddress, "lineId" | "type">;

function splitMultiWordWord(word: WordTiming): WordTiming[] {
  const asLine: { text: string; begin: number; end: number; words?: WordTiming[] } = {
    text: word.text,
    begin: word.begin,
    end: word.end,
  };
  const parts = convertLineToWord(asLine).words;
  if (!parts || parts.length < 2) return [word];
  const { syllableGroupId: _drop, transliteration: _t, transliterationJoinerAfter: _j, ...base } = word;
  const lastIndex = parts.length - 1;
  return parts.map((part, index) => ({
    ...base,
    ...part,
    id: index === 0 ? word.id : part.id,
    sep: index === lastIndex ? (word.sep.endsWith(" ") ? " " : "") : part.sep,
  }));
}

function splitMultiWordBgWords(bgWords: WordTiming[]): WordTiming[] | null {
  const split = bgWords.flatMap(splitMultiWordWord);
  return split.length > bgWords.length ? split : null;
}

function computeSplitIntoWordsUpdates(targets: Iterable<SplitTarget>, rawLines: LyricLine[]): LineWordsUpdate[] {
  const tracksByLine = new Map<string, Set<SplitTarget["type"]>>();
  for (const { lineId, type } of targets) {
    const tracks = tracksByLine.get(lineId) ?? new Set();
    tracks.add(type);
    tracksByLine.set(lineId, tracks);
  }

  const rawLinesById = new Map<string, LyricLine>();
  for (const line of rawLines) rawLinesById.set(line.id, line);

  const updates: LineWordsUpdate[] = [];
  for (const [id, tracks] of tracksByLine) {
    const realLine = rawLinesById.get(id);
    if (!realLine) continue;
    const lineUpdates: Partial<LyricLine> = {};
    if (tracks.has("word") && isLineSynced(realLine)) {
      const converted = convertLineToWord(realLine);
      if (converted.words) Object.assign(lineUpdates, { words: converted.words, begin: undefined, end: undefined });
    }
    const splitBg =
      tracks.has("bg") && realLine.backgroundWords ? splitMultiWordBgWords(realLine.backgroundWords) : null;
    if (splitBg) Object.assign(lineUpdates, manualBackgroundWordEdit(splitBg));
    if (Object.keys(lineUpdates).length > 0) updates.push({ id, updates: lineUpdates });
  }
  return updates;
}

function splitTargetsForMenu(target: SplitTarget, selectedWords: SyllableAddress[]): SplitTarget[] {
  return selectedWords.some((w) => w.lineId === target.lineId) ? [target, ...selectedWords] : [target];
}

function computeSplitSelections(
  updates: LineWordsUpdate[],
  effectiveLines: readonly ReadableLine[],
): SyllableAddress[] {
  const shownLineIds = new Set(effectiveLines.map((line) => line.id));
  const selections: SyllableAddress[] = [];
  for (const update of updates) {
    if (!shownLineIds.has(update.id)) continue;
    const tracks = [
      ["word", update.updates.words],
      ["bg", update.updates.backgroundWords],
    ] as const;
    for (const [type, words] of tracks) {
      for (const word of words ?? []) selections.push({ lineId: update.id, type, syllableId: word.id });
    }
  }
  return selections;
}

// -- Store-mutating operation --------------------------------------------------

function splitLinesIntoWords(targets: Iterable<SplitTarget>, effectiveLines: readonly ReadableLine[]): void {
  const projectState = useProjectStore.getState();
  const updates = computeSplitIntoWordsUpdates(targets, projectState.lines);

  if (updates.length > 0) projectState.commit(convertToWordTiming(updates));

  const newSelections = computeSplitSelections(updates, effectiveLines);
  if (newSelections.length > 0) {
    useTimelineStore.getState().setSelectedWords(newSelections);
  }
}

// -- Exports -------------------------------------------------------------------

export { computeSplitIntoWordsUpdates, computeSplitSelections, splitLinesIntoWords, splitTargetsForMenu };
