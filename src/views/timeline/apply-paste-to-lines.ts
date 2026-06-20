import { manualBackgroundWordEdit } from "@/domain/line/background";
import { mainWordEditFields } from "@/domain/line/main-words";
import type { LooseLine, LyricLine } from "@/domain/line/model";
import { bgWords, mainWords } from "@/domain/line/voices";
import { mergeWordsIntoTrack } from "@/domain/word/merge-track";
import type { WordTiming } from "@/domain/word/timing";
import type { ClipboardData, ClipboardEntry } from "@/views/timeline/selection-types";

// -- Types --------------------------------------------------------------------

interface PasteInput {
  lines: LyricLine[];
  clipboard: ClipboardData;
  targetLineIndex: number;
  timeDelta: number;
  duration: number;
}

interface LineUpdate {
  id: string;
  updates: Partial<LooseLine>;
}

// -- Functions ----------------------------------------------------------------

function applyPasteToLines({
  lines,
  clipboard,
  targetLineIndex,
  timeDelta,
  duration,
}: PasteInput): LineUpdate[] | null {
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
    const newWords: WordTiming[] = [];
    const newBgWords: WordTiming[] = [];

    for (const entry of entries) {
      const newBegin = Math.max(0, entry.word.begin + timeDelta);
      const newEnd = Math.min(duration, entry.word.end + timeDelta);
      const newWord = { ...entry.word, begin: newBegin, end: newEnd };
      if (entry.trackType === "word") newWords.push(newWord);
      else newBgWords.push(newWord);
    }

    const lineUpdates: Partial<LooseLine> = {};
    if (newWords.length > 0) {
      Object.assign(lineUpdates, mainWordEditFields(mergeWordsIntoTrack(mainWords(line) ?? [], newWords)));
    }
    if (newBgWords.length > 0) {
      Object.assign(lineUpdates, manualBackgroundWordEdit(mergeWordsIntoTrack(bgWords(line) ?? [], newBgWords)));
    }

    updates.push({ id: line.id, updates: lineUpdates });
  }

  return updates;
}

// -- Exports ------------------------------------------------------------------

export { applyPasteToLines };
export type { LineUpdate, PasteInput };
