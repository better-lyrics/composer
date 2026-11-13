import { convertToWordTiming } from "@/domain/commands/line-timing";
import { withKeptSyllablePieces } from "@/domain/language/pieces";
import { manualBackgroundWordEdit } from "@/domain/line/lane-word-edits";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { convertLineToWord } from "@/domain/line/span-to-words";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import type { SyllableAddress } from "@/domain/selection/model";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { evenlyTimedWords } from "@/utils/sync-helpers";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

interface LineWordsUpdate {
  id: string;
  updates: Partial<LyricLine>;
}

// -- Pure computation ----------------------------------------------------------

type SplitTarget = Pick<SyllableAddress, "lineId" | "type">;

function splitMultiWordWord(word: WordTiming): WordTiming[] {
  const parts = evenlyTimedWords(word.text, word.begin, word.end);
  if (parts.length < 2) return [word];
  const { joinsNext, ...base } = word;
  const lastIndex = parts.length - 1;
  return parts.map((part, index) => ({
    ...base,
    ...part,
    id: index === 0 ? word.id : part.id,
    sep: index === lastIndex ? (word.sep.endsWith(" ") ? " " : "") : part.sep,
    ...(index === lastIndex && { joinsNext }),
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
    let lineUpdates: Partial<LyricLine> = {};
    if (tracks.has("word") && isLineSynced(realLine)) {
      const converted = convertLineToWord(realLine);
      if (converted !== realLine) lineUpdates = { tracks: converted.tracks };
    }
    const bgWords = timedSyllables(backgroundTrack(realLine));
    const splitBg = tracks.has("bg") ? splitMultiWordBgWords(bgWords) : null;
    if (splitBg) {
      lineUpdates = manualBackgroundWordEdit(realLine, splitBg, {
        ...lineUpdates,
        languages: withKeptSyllablePieces(realLine, "bg", bgWords, splitBg),
      });
    }
    if (Object.keys(lineUpdates).length > 0) updates.push({ id, updates: lineUpdates });
  }
  return updates;
}

function splitTargetsForMenu(target: SplitTarget, selectedWords: SyllableAddress[]): SplitTarget[] {
  return selectedWords.some((w) => w.lineId === target.lineId) ? [target, ...selectedWords] : [target];
}

function computeSplitSelections(updates: LineWordsUpdate[], lines: readonly LyricLine[]): SyllableAddress[] {
  const shownById = new Map(lines.map((line) => [line.id, line]));
  const selections: SyllableAddress[] = [];
  for (const update of updates) {
    const shown = shownById.get(update.id);
    if (!shown) continue;
    const written = { ...shown, ...update.updates };
    const tracks = [
      ["word", mainTrack(written) !== mainTrack(shown) ? timedSyllables(mainTrack(written)) : []],
      ["bg", backgroundTrack(written) !== backgroundTrack(shown) ? timedSyllables(backgroundTrack(written)) : []],
    ] as const;
    for (const [type, words] of tracks) {
      for (const word of words) selections.push({ lineId: update.id, type, syllableId: word.id });
    }
  }
  return selections;
}

// -- Store-mutating operation --------------------------------------------------

function splitLinesIntoWords(targets: Iterable<SplitTarget>, lines: readonly LyricLine[]): void {
  const projectState = useProjectStore.getState();
  const updates = computeSplitIntoWordsUpdates(targets, projectState.lines);

  if (updates.length > 0) projectState.commit(convertToWordTiming(updates));

  const newSelections = computeSplitSelections(updates, lines);
  if (newSelections.length > 0) {
    useTimelineStore.getState().setSelectedWords(newSelections);
  }
}

// -- Exports -------------------------------------------------------------------

export { computeSplitIntoWordsUpdates, computeSplitSelections, splitLinesIntoWords, splitTargetsForMenu };
