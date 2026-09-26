import { manualBackgroundWordEdit } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import type { WordSelection } from "@/domain/selection/model";
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

type SplitTarget = Pick<WordSelection, "lineId" | "type">;

function splitMultiWordWord(word: WordTiming): WordTiming[] {
  const asLine: { text: string; begin: number; end: number; words?: WordTiming[] } = {
    text: word.text.trimEnd(),
    begin: word.begin,
    end: word.end,
  };
  const parts = convertLineToWord(asLine).words;
  if (!parts || parts.length < 2) return [word];
  if (!word.text.endsWith(" ")) return parts;
  const last = parts[parts.length - 1];
  return [...parts.slice(0, -1), { ...last, text: `${last.text} ` }];
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

function splitTargetsForMenu(target: SplitTarget, selectedWords: WordSelection[]): SplitTarget[] {
  return selectedWords.some((w) => w.lineId === target.lineId) ? selectedWords : [target];
}

function computeSplitSelections(updates: LineWordsUpdate[], effectiveLines: LyricLine[]): WordSelection[] {
  const lineIndexById = new Map<string, number>();
  for (let i = 0; i < effectiveLines.length; i++) lineIndexById.set(effectiveLines[i].id, i);

  const selections: WordSelection[] = [];
  for (const update of updates) {
    const lineIndex = lineIndexById.get(update.id);
    if (lineIndex === undefined) continue;
    const tracks = [
      ["word", update.updates.words],
      ["bg", update.updates.backgroundWords],
    ] as const;
    for (const [type, words] of tracks) {
      for (let wi = 0; wi < (words?.length ?? 0); wi++) {
        selections.push({ lineId: update.id, lineIndex, wordIndex: wi, type });
      }
    }
  }
  return selections;
}

// -- Store-mutating operation --------------------------------------------------

function splitLinesIntoWords(targets: Iterable<SplitTarget>, effectiveLines: LyricLine[]): void {
  const projectState = useProjectStore.getState();
  const updates = computeSplitIntoWordsUpdates(targets, projectState.lines);

  if (updates.length === 1) {
    projectState.updateLineWithHistory(updates[0].id, updates[0].updates);
  } else if (updates.length > 1) {
    projectState.updateLinesWithHistory(updates);
  }

  const newSelections = computeSplitSelections(updates, effectiveLines);
  if (newSelections.length > 0) {
    useTimelineStore.getState().setSelectedWords(newSelections);
  }
}

// -- Exports -------------------------------------------------------------------

export { computeSplitIntoWordsUpdates, computeSplitSelections, splitLinesIntoWords, splitTargetsForMenu };
export type { SplitTarget };
