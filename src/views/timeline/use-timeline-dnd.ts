import { useAudioStore } from "@/stores/audio";
import { type LyricLine, type WordTiming, useProjectStore } from "@/stores/project";
import { closeIntraGroupGaps, expandSelectionToGroupmates } from "@/utils/syllable-groups";
import { cloneWord } from "@/utils/word-timing";
import { addTrailingSpaceIfMissing, trimTrailingSpaceFromLast } from "@/utils/word-spaces";
import { wouldDropCrossInstance } from "@/views/timeline/dnd-group-guard";
import { type WordSelection, isWordSelected, useTimelineStore } from "@/views/timeline/timeline-store";
import { type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// -- Types ---------------------------------------------------------------------

interface DragData {
  lineId: string;
  lineIndex: number;
  wordIndex: number;
  trackType: "word" | "bg";
  text: string;
  begin: number;
  end: number;
  initialShiftKey?: boolean;
}

// -- Constants -----------------------------------------------------------------

const DRAG_TRACK_SWITCH_THRESHOLD = 30;
const DRAG_X_MIN_THRESHOLD = 5;

// -- Helpers -------------------------------------------------------------------

function resolveWordsToOperate(activeData: DragData, selectedWords: WordSelection[]): WordSelection[] {
  const isDraggedWordSelected = isWordSelected(
    selectedWords,
    activeData.lineId,
    activeData.wordIndex,
    activeData.trackType,
  );
  if (isDraggedWordSelected && selectedWords.length > 0) return selectedWords;
  return [
    {
      lineId: activeData.lineId,
      lineIndex: activeData.lineIndex,
      wordIndex: activeData.wordIndex,
      type: activeData.trackType,
    },
  ];
}

function expandSelectionsAcrossLines(lines: LyricLine[], selections: WordSelection[]): WordSelection[] {
  const linesById = new Map<string, LyricLine>();
  for (const l of lines) linesById.set(l.id, l);
  const seen = new Set<string>();
  const result: WordSelection[] = [];
  for (const sel of selections) {
    const line = linesById.get(sel.lineId);
    if (!line) continue;
    const words = sel.type === "word" ? line.words : line.backgroundWords;
    if (!words) continue;
    const expanded = expandSelectionToGroupmates(words, [sel.wordIndex]);
    for (const idx of expanded) {
      const key = `${sel.lineId}:${sel.type}:${idx}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ lineId: sel.lineId, lineIndex: sel.lineIndex, wordIndex: idx, type: sel.type });
    }
  }
  return result;
}

function groupSelectionsByLine(selections: WordSelection[]): Map<string, WordSelection[]> {
  const grouped = new Map<string, WordSelection[]>();
  for (const sel of selections) {
    const arr = grouped.get(sel.lineId) ?? [];
    arr.push(sel);
    grouped.set(sel.lineId, arr);
  }
  return grouped;
}

function handleAltDuplicate(event: DragEndEvent, lines: LyricLine[], zoom: number, duration: number) {
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

  for (const [lineId, selections] of grouped) {
    const line = linesById.get(lineId);
    if (!line) continue;

    const newGroupIdBySource = new Map<string, string>();
    const getNewGroupId = (oldId: string | undefined): string | undefined => {
      if (oldId === undefined) return undefined;
      let nid = newGroupIdBySource.get(oldId);
      if (!nid) {
        nid = nanoid(8);
        newGroupIdBySource.set(oldId, nid);
      }
      return nid;
    };

    const wordDups: WordTiming[] = [];
    const bgDups: WordTiming[] = [];

    for (const sel of selections) {
      const wordsArray = sel.type === "word" ? line.words : line.backgroundWords;
      const word = wordsArray?.[sel.wordIndex];
      if (!word) continue;

      const newBegin = Math.max(0, word.begin + timeDelta);
      const newEnd = Math.min(duration, word.end + timeDelta);
      if (newEnd <= newBegin) continue;

      const dup = cloneWord(word, { begin: newBegin, end: newEnd });
      dup.syllableGroupId = getNewGroupId(word.syllableGroupId);
      if (sel.type === "word") wordDups.push(dup);
      else bgDups.push(dup);
    }

    const lineUpdates: Partial<LyricLine> = {};

    if (wordDups.length > 0) {
      const existing = line.words ?? [];
      const hasOverlap = wordDups.some((dup) => existing.some((w) => dup.begin < w.end && dup.end > w.begin));
      if (!hasOverlap) {
        const prevLast = existing[existing.length - 1];
        const sorted = [...existing, ...wordDups].sort((a, b) => a.begin - b.begin);
        const reconciled = prevLast ? addTrailingSpaceIfMissing(sorted, prevLast) : sorted;
        lineUpdates.words = closeIntraGroupGaps(trimTrailingSpaceFromLast(reconciled));
      }
    }

    if (bgDups.length > 0) {
      const existing = line.backgroundWords ?? [];
      const hasOverlap = bgDups.some((dup) => existing.some((w) => dup.begin < w.end && dup.end > w.begin));
      if (!hasOverlap) {
        const prevLast = existing[existing.length - 1];
        const sorted = [...existing, ...bgDups].sort((a, b) => a.begin - b.begin);
        const reconciled = prevLast ? addTrailingSpaceIfMissing(sorted, prevLast) : sorted;
        const merged = closeIntraGroupGaps(trimTrailingSpaceFromLast(reconciled));
        lineUpdates.backgroundWords = merged;
        lineUpdates.backgroundText = merged.map((w) => w.text).join("");
      }
    }

    if (Object.keys(lineUpdates).length > 0) {
      updates.push({ id: lineId, updates: lineUpdates });
    }
  }

  if (updates.length > 0) {
    useProjectStore.getState().updateLinesWithHistory(updates);
  }
}

// -- Hook ----------------------------------------------------------------------

function useTimelineDnd(lines: LyricLine[]) {
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
  const moveWordToBg = useProjectStore((s) => s.moveWordToBg);
  const moveWordFromBg = useProjectStore((s) => s.moveWordFromBg);
  const duration = useAudioStore((s) => s.duration);
  const zoom = useTimelineStore((s) => s.zoom);

  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [dragShiftPressed, setDragShiftPressed] = useState(false);
  const dragShiftRef = useRef(false);

  useEffect(() => {
    if (!activeDrag) {
      dragShiftRef.current = false;
      setDragShiftPressed(false);
      return;
    }
    const initial = activeDrag.initialShiftKey ?? false;
    dragShiftRef.current = initial;
    setDragShiftPressed(initial);
    const update = (pressed: boolean) => {
      dragShiftRef.current = pressed;
      setDragShiftPressed(pressed);
    };
    const onPointer = (e: PointerEvent) => update(e.shiftKey);
    const onKey = (e: KeyboardEvent) => update(e.shiftKey);
    window.addEventListener("pointermove", onPointer);
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKey);
    };
  }, [activeDrag]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (data) {
      const initialShiftKey = event.activatorEvent instanceof PointerEvent ? event.activatorEvent.shiftKey : false;
      setActiveDrag({ ...data, initialShiftKey });
      document.body.style.cursor = "grabbing";
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      document.body.style.cursor = "";

      const { active, over, delta, activatorEvent } = event;
      const isAltDrag = activatorEvent instanceof PointerEvent && activatorEvent.altKey;
      const isShiftDrag = dragShiftRef.current;

      if (!over) {
        if (isAltDrag) handleAltDuplicate(event, lines, zoom, duration);
        return;
      }

      const dropId = String(over.id);
      const activeData = active.data.current as DragData | undefined;
      if (!activeData) return;

      if (isAltDrag) {
        handleAltDuplicate(event, lines, zoom, duration);
        return;
      }

      const targetLineId = over.data.current?.lineId;
      if (targetLineId !== activeData.lineId) {
        // Today every drop is scoped to the source line; surface a toast if a
        // cross-line drop would have crossed an instance boundary so future
        // code paths that allow cross-line moves get user feedback for free.
        const sourceLineForGuard = lines.find((l) => l.id === activeData.lineId);
        const targetLineForGuard = lines.find((l) => l.id === targetLineId);
        if (
          sourceLineForGuard &&
          targetLineForGuard &&
          wouldDropCrossInstance(sourceLineForGuard, targetLineForGuard)
        ) {
          toast.error("Detach the line first to move it out of the group");
        }
        return;
      }

      const line = lines.find((l) => l.id === activeData.lineId);
      if (!line) return;

      const movedDownToBg = delta.y > DRAG_TRACK_SWITCH_THRESHOLD;
      const movedUpToMain = delta.y < -DRAG_TRACK_SWITCH_THRESHOLD;

      const { selectedWords } = useTimelineStore.getState();
      const draggedOnly: WordSelection[] = [
        {
          lineId: activeData.lineId,
          lineIndex: activeData.lineIndex,
          wordIndex: activeData.wordIndex,
          type: activeData.trackType,
        },
      ];
      const wordsToMove = expandSelectionsAcrossLines(
        lines,
        isShiftDrag ? draggedOnly : resolveWordsToOperate(activeData, selectedWords),
      );
      const timeDelta = delta.x / zoom;

      if (dropId.startsWith("bg-drop-") && activeData.trackType === "word" && movedDownToBg) {
        const indices = wordsToMove.flatMap((s) =>
          s.lineId === activeData.lineId && s.type === "word" ? [s.wordIndex] : [],
        );
        moveWordToBg(activeData.lineId, indices, timeDelta, duration);
        return;
      }

      if (dropId.startsWith("main-drop-") && activeData.trackType === "bg" && movedUpToMain) {
        const indices = wordsToMove.flatMap((s) =>
          s.lineId === activeData.lineId && s.type === "bg" ? [s.wordIndex] : [],
        );
        moveWordFromBg(activeData.lineId, indices, timeDelta, duration);
        return;
      }

      if (Math.abs(delta.x) < DRAG_X_MIN_THRESHOLD) return;

      if (wordsToMove.length > 1) {
        const grouped = groupSelectionsByLine(wordsToMove);
        const updates: Array<{ id: string; updates: Partial<LyricLine> }> = [];
        const moveLinesById = new Map<string, LyricLine>();
        for (const l of lines) moveLinesById.set(l.id, l);

        for (const [lineId, selections] of grouped) {
          const moveLine = moveLinesById.get(lineId);
          if (!moveLine) continue;

          const lineUpdates: Partial<LyricLine> = {};
          const wordIndices = new Set(selections.flatMap((s) => (s.type === "word" ? [s.wordIndex] : [])));
          const bgIndices = new Set(selections.flatMap((s) => (s.type === "bg" ? [s.wordIndex] : [])));

          for (const [indices, trackKey] of [
            [wordIndices, "words"],
            [bgIndices, "backgroundWords"],
          ] as const) {
            if (indices.size === 0) continue;
            const source = moveLine[trackKey];
            if (!source) continue;

            const words = source.map((w, i) => {
              if (!indices.has(i)) return { ...w };
              const wordDur = w.end - w.begin;
              const newBegin = Math.max(0, Math.min(duration - wordDur, w.begin + timeDelta));
              return { ...w, begin: newBegin, end: newBegin + wordDur };
            });
            words.sort((a, b) => a.begin - b.begin);

            for (let i = 1; i < words.length; i++) {
              if (words[i].begin < words[i - 1].end) {
                const overlap = words[i - 1].end - words[i].begin;
                words[i] = { ...words[i], begin: words[i].begin + overlap, end: words[i].end + overlap };
              }
            }
            const last = words[words.length - 1];
            if (last.end > duration) {
              const overflow = last.end - duration;
              words[words.length - 1] = { ...last, begin: last.begin - overflow, end: duration };
            }

            const normalized = closeIntraGroupGaps(trimTrailingSpaceFromLast(words));
            lineUpdates[trackKey] = normalized;
            if (trackKey === "backgroundWords") {
              lineUpdates.backgroundText = normalized.map((w) => w.text).join("");
            }
          }

          if (Object.keys(lineUpdates).length > 0) {
            updates.push({ id: lineId, updates: lineUpdates });
          }
        }

        if (updates.length > 0) {
          useProjectStore.getState().updateLinesWithHistory(updates);
        }
      } else {
        const wordsArray = activeData.trackType === "word" ? line.words : line.backgroundWords;
        if (!wordsArray) return;

        const wordIndex = activeData.wordIndex;
        if (wordIndex < 0 || wordIndex >= wordsArray.length) return;
        const wordDuration = activeData.end - activeData.begin;
        const newBegin = Math.max(0, Math.min(duration - wordDuration, activeData.begin + timeDelta));
        const newEnd = newBegin + wordDuration;

        const words: WordTiming[] = wordsArray.map((w, i) => {
          if (i === wordIndex) return { ...w, begin: newBegin, end: newEnd };
          return { ...w };
        });
        words.sort((a, b) => a.begin - b.begin);

        for (let i = 1; i < words.length; i++) {
          if (words[i].begin < words[i - 1].end) {
            const overlap = words[i - 1].end - words[i].begin;
            words[i] = { ...words[i], begin: words[i].begin + overlap, end: words[i].end + overlap };
          }
        }

        const lastWord = words[words.length - 1];
        if (lastWord.end > duration) {
          const overflow = lastWord.end - duration;
          words[words.length - 1] = { ...lastWord, begin: lastWord.begin - overflow, end: duration };
        }

        const normalized = closeIntraGroupGaps(trimTrailingSpaceFromLast(words));
        if (activeData.trackType === "word") {
          updateLineWithHistory(activeData.lineId, { words: normalized });
        } else {
          updateLineWithHistory(activeData.lineId, {
            backgroundWords: normalized,
            backgroundText: normalized.map((w) => w.text).join(""),
          });
        }
      }
    },
    [moveWordToBg, moveWordFromBg, updateLineWithHistory, zoom, duration, lines],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
    document.body.style.cursor = "";
  }, []);

  return { sensors, activeDrag, dragShiftPressed, handleDragStart, handleDragEnd, handleDragCancel };
}

// -- Exports -------------------------------------------------------------------

export { useTimelineDnd };
