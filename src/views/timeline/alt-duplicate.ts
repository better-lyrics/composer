import { manualBackgroundWordEdit } from "@/domain/line/background";
import { type ReadableLine, effectiveMainWordEdit } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { trackWords } from "@/domain/line/tracks";
import { mergeWordsIntoTrack } from "@/domain/word/merge-track";
import { boundsOverlap } from "@/domain/word/overlap";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { cloneWord } from "@/utils/word-timing";
import {
  DRAG_X_MIN_THRESHOLD,
  type DragData,
  LINE_SYNCED_REJECT_MESSAGE,
  expandSelectionsAcrossLines,
  groupSelectionsByLine,
  resolveWordsToOperate,
} from "@/views/timeline/drag-handlers";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";

// -- Alt duplicate -------------------------------------------------------------

function handleAltDuplicate(event: DragEndEvent, lines: readonly ReadableLine[], zoom: number, duration: number) {
  const { active, delta } = event;
  const activeData = active.data.current as DragData | undefined;
  if (!activeData) return;
  if (Math.abs(delta.x) < DRAG_X_MIN_THRESHOLD) return;

  const { selectedWords } = useTimelineStore.getState();
  const wordsToDuplicate = expandSelectionsAcrossLines(lines, resolveWordsToOperate(activeData, selectedWords));

  const timeDelta = delta.x / zoom;
  const updates: Array<{ id: string; updates: Partial<LyricLine> }> = [];

  const grouped = groupSelectionsByLine(wordsToDuplicate);
  const linesById = new Map<string, LyricLine>();
  for (const l of lines) linesById.set(l.id, l);
  let rejectedLineSynced = false;

  for (const [lineId, selections] of grouped) {
    const line = linesById.get(lineId);
    if (!line) continue;

    const wordDups: WordTiming[] = [];
    const bgDups: WordTiming[] = [];

    for (const sel of selections) {
      const wordsArray = trackWords(line, sel.type);
      const word = wordsArray?.[sel.wordIndex];
      if (!word) continue;

      const newBegin = Math.max(0, word.begin + timeDelta);
      const newEnd = Math.min(duration, word.end + timeDelta);
      if (newEnd <= newBegin) continue;

      const dup = cloneWord(word, { begin: newBegin, end: newEnd });
      if (sel.type === "word") wordDups.push(dup);
      else bgDups.push(dup);
    }

    const lineUpdates: Partial<LyricLine> = {};

    if (wordDups.length > 0) {
      const existing = line.words ?? [];
      const hasOverlap = wordDups.some((dup) => existing.some((w) => boundsOverlap(dup, w)));
      if (!hasOverlap) {
        const edit = effectiveMainWordEdit(line, mergeWordsIntoTrack(existing, wordDups));
        if (edit) Object.assign(lineUpdates, edit);
        else rejectedLineSynced = true;
      }
    }

    if (bgDups.length > 0) {
      const existing = line.backgroundWords ?? [];
      const hasOverlap = bgDups.some((dup) => existing.some((w) => boundsOverlap(dup, w)));
      if (!hasOverlap) Object.assign(lineUpdates, manualBackgroundWordEdit(mergeWordsIntoTrack(existing, bgDups)));
    }

    if (Object.keys(lineUpdates).length > 0) {
      updates.push({ id: lineId, updates: lineUpdates });
    }
  }

  if (rejectedLineSynced) toast.error(LINE_SYNCED_REJECT_MESSAGE);
  if (updates.length > 0) {
    useProjectStore.getState().updateLinesWithHistory(updates, { propagateToSiblings: false });
  }
}

// -- Exports -------------------------------------------------------------------

export { handleAltDuplicate };
