import type { TimeRange } from "@/domain/group/shared-timing";
import type { LanguagePiece } from "@/domain/language/model";
import { withAddedPieces } from "@/domain/language/pieces";
import { drawnSyllables } from "@/domain/line/drawn-track";
import { manualBackgroundWordEdit } from "@/domain/line/lane-word-edits";
import type { LyricLine, MainTrack } from "@/domain/line/model";
import { type WordTrack, isSpanTimed, mainTrack, trackRole, untimedSyllablesOf } from "@/domain/line/track";
import { withMainTrack, withTrackSyllables, withTrackWords } from "@/domain/line/track-writes";
import { withNewId } from "@/domain/word/id";
import { mergeWordsIntoTrack } from "@/domain/word/merge-track";
import { boundsOverlap } from "@/domain/word/overlap";
import type { WordTiming } from "@/domain/word/timing";
import type { ClipboardData, ClipboardEntry } from "@/views/timeline/selection-types";

// -- Types --------------------------------------------------------------------

interface PasteInput {
  lines: readonly LyricLine[];
  clipboard: ClipboardData;
  targetLineIndex: number;
  timeDelta: number;
  rangeOf: (line: LyricLine) => TimeRange;
}

interface LineUpdate {
  id: string;
  updates: Partial<LyricLine>;
}

// -- Functions ----------------------------------------------------------------

function clipboardInLane(clipboard: ClipboardData, lane: WordTrack): ClipboardData {
  const lanes = new Set(clipboard.entries.map((entry) => entry.trackType));
  if (lanes.size !== 1 || lanes.has(lane)) return clipboard;
  return { ...clipboard, entries: clipboard.entries.map((entry) => ({ ...entry, trackType: lane })) };
}

function pastedWordBounds(word: WordTiming, timeDelta: number, range: TimeRange): { begin: number; end: number } {
  return { begin: Math.max(range.min, word.begin + timeDelta), end: Math.min(range.max, word.end + timeDelta) };
}

function pasteOverlaps(
  clipboard: ClipboardData,
  targetLineIndex: number,
  timeDelta: number,
  lines: readonly LyricLine[],
  rangeOf: (line: LyricLine) => TimeRange,
): boolean {
  for (const entry of clipboard.entries) {
    const lineIdx = targetLineIndex + entry.lineOffset;
    if (lineIdx < 0 || lineIdx >= lines.length) return true;

    const pasted = pastedWordBounds(entry.word, timeDelta, rangeOf(lines[lineIdx]));
    if (pasted.end <= pasted.begin) return true;

    const existingWords = drawnSyllables(lines[lineIdx], trackRole(entry.trackType));
    if (existingWords.some((existing) => boundsOverlap(pasted, existing))) return true;
  }
  return false;
}

// Pasting into a line-synced line writes the words over its whole track: its one drawn block stood for all of it.
function convertedMainTrack(line: LyricLine, words: readonly WordTiming[]): MainTrack {
  const main = mainTrack(line);
  return isSpanTimed(main) ? withTrackSyllables(main, words) : withTrackWords(main, words);
}

function applyPasteToLines({ lines, clipboard, targetLineIndex, timeDelta, rangeOf }: PasteInput): LineUpdate[] | null {
  const grouped = new Map<number, ClipboardEntry[]>();
  for (const entry of clipboard.entries) {
    const lineIdx = targetLineIndex + entry.lineOffset;
    if (lineIdx < 0 || lineIdx >= lines.length) return null;
    const arr = grouped.get(lineIdx) ?? [];
    arr.push(entry);
    grouped.set(lineIdx, arr);
  }

  const updates: LineUpdate[] = [];

  for (const [lineIdx, entries] of grouped) {
    const line = lines[lineIdx];
    const range = rangeOf(line);
    const newWords: WordTiming[] = [];
    const newBgWords: WordTiming[] = [];
    const mainPieces: Record<string, LanguagePiece> = {};
    const bgPieces: Record<string, LanguagePiece> = {};

    for (const entry of entries) {
      const newWord = withNewId({ ...entry.word, ...pastedWordBounds(entry.word, timeDelta, range) });
      if (entry.trackType === "word") newWords.push(newWord);
      else newBgWords.push(newWord);
      if (entry.piece) (entry.trackType === "word" ? mainPieces : bgPieces)[newWord.id] = entry.piece;
    }

    let lineUpdates: Partial<LyricLine> = {};
    if (newWords.length > 0) {
      const merged = mergeWordsIntoTrack(drawnSyllables(line, "main"), newWords, untimedSyllablesOf(line, "main"));
      lineUpdates = { tracks: withMainTrack(line, convertedMainTrack(line, merged)).tracks };
    }
    if (newBgWords.length > 0) {
      const merged = mergeWordsIntoTrack(drawnSyllables(line, "bg"), newBgWords, untimedSyllablesOf(line, "bg"));
      lineUpdates = manualBackgroundWordEdit(line, merged, lineUpdates);
    }

    const languages = withAddedPieces(withAddedPieces(line.languages, "main", mainPieces), "bg", bgPieces);
    if (languages !== line.languages) lineUpdates.languages = languages;

    updates.push({ id: line.id, updates: lineUpdates });
  }

  return updates;
}

// -- Exports ------------------------------------------------------------------

export { applyPasteToLines, clipboardInLane, pastedWordBounds, pasteOverlaps };
