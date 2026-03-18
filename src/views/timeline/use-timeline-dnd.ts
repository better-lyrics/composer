import { useAudioStore } from "@/stores/audio";
import { type LyricLine, useProjectStore } from "@/stores/project";
import { isWordSelected, useTimelineStore } from "@/views/timeline/timeline-store";
import { type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useCallback, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface DragData {
  lineId: string;
  lineIndex: number;
  wordIndex: number;
  trackType: "word" | "bg";
  text: string;
  begin: number;
  end: number;
}

// -- Constants -----------------------------------------------------------------

const DRAG_TRACK_SWITCH_THRESHOLD = 30;
const DRAG_X_MIN_THRESHOLD = 5;

// -- Helpers -------------------------------------------------------------------

function handleAltDuplicate(event: DragEndEvent, lines: LyricLine[], zoom: number, duration: number) {
  const { active, delta } = event;
  const activeData = active.data.current as DragData | undefined;
  if (!activeData) return;
  if (Math.abs(delta.x) < DRAG_X_MIN_THRESHOLD) return;

  const { selectedWords } = useTimelineStore.getState();
  const isDraggedWordSelected = isWordSelected(
    selectedWords,
    activeData.lineId,
    activeData.wordIndex,
    activeData.trackType,
  );

  const wordsToDuplicate =
    isDraggedWordSelected && selectedWords.length > 0
      ? selectedWords
      : [
          {
            lineId: activeData.lineId,
            lineIndex: activeData.lineIndex,
            wordIndex: activeData.wordIndex,
            type: activeData.trackType,
          },
        ];

  const timeDelta = delta.x / zoom;
  const updates: Array<{ id: string; updates: Partial<LyricLine> }> = [];

  const grouped = new Map<string, typeof wordsToDuplicate>();
  for (const sel of wordsToDuplicate) {
    const arr = grouped.get(sel.lineId) ?? [];
    arr.push(sel);
    grouped.set(sel.lineId, arr);
  }

  for (const [lineId, selections] of grouped) {
    const line = lines.find((l) => l.id === lineId);
    if (!line) continue;

    const wordDups: Array<{ text: string; begin: number; end: number }> = [];
    const bgDups: Array<{ text: string; begin: number; end: number }> = [];

    for (const sel of selections) {
      const wordsArray = sel.type === "word" ? line.words : line.backgroundWords;
      const word = wordsArray?.[sel.wordIndex];
      if (!word) continue;

      const newBegin = Math.max(0, word.begin + timeDelta);
      const newEnd = Math.min(duration, word.end + timeDelta);
      if (newEnd <= newBegin) continue;

      const dup = { text: word.text, begin: newBegin, end: newEnd };
      if (sel.type === "word") wordDups.push(dup);
      else bgDups.push(dup);
    }

    const lineUpdates: Partial<LyricLine> = {};

    if (wordDups.length > 0) {
      const existing = line.words ?? [];
      const hasOverlap = wordDups.some((dup) => existing.some((w) => dup.begin < w.end && dup.end > w.begin));
      if (!hasOverlap) {
        lineUpdates.words = [...existing, ...wordDups].sort((a, b) => a.begin - b.begin);
      }
    }

    if (bgDups.length > 0) {
      const existing = line.backgroundWords ?? [];
      const hasOverlap = bgDups.some((dup) => existing.some((w) => dup.begin < w.end && dup.end > w.begin));
      if (!hasOverlap) {
        const merged = [...existing, ...bgDups].sort((a, b) => a.begin - b.begin);
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
      setActiveDrag(data);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);

      const { active, over, delta, activatorEvent } = event;
      const isAltDrag = activatorEvent instanceof PointerEvent && activatorEvent.altKey;

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
      if (targetLineId !== activeData.lineId) return;

      const line = lines.find((l) => l.id === activeData.lineId);
      if (!line) return;

      const movedDownToBg = delta.y > DRAG_TRACK_SWITCH_THRESHOLD;
      const movedUpToMain = delta.y < -DRAG_TRACK_SWITCH_THRESHOLD;

      if (dropId.startsWith("bg-drop-") && activeData.trackType === "word" && movedDownToBg) {
        moveWordToBg(activeData.lineId, activeData.wordIndex);
        return;
      }

      if (dropId.startsWith("main-drop-") && activeData.trackType === "bg" && movedUpToMain) {
        moveWordFromBg(activeData.lineId, activeData.wordIndex);
        return;
      }

      if (Math.abs(delta.x) < DRAG_X_MIN_THRESHOLD) return;

      const wordsArray = activeData.trackType === "word" ? line.words : line.backgroundWords;
      if (!wordsArray) return;

      const wordIndex = activeData.wordIndex;
      const timeDelta = delta.x / zoom;
      const wordDuration = activeData.end - activeData.begin;
      const newBegin = Math.max(0, Math.min(duration - wordDuration, activeData.begin + timeDelta));
      const newEnd = newBegin + wordDuration;

      const words = [...wordsArray];
      words[wordIndex] = { ...words[wordIndex], begin: newBegin, end: newEnd };
      words.sort((a, b) => a.begin - b.begin);

      for (let i = 1; i < words.length; i++) {
        if (words[i].begin < words[i - 1].end) {
          const overlap = words[i - 1].end - words[i].begin;
          words[i] = {
            ...words[i],
            begin: words[i].begin + overlap,
            end: words[i].end + overlap,
          };
        }
      }

      const lastWord = words[words.length - 1];
      if (lastWord.end > duration) {
        const overflow = lastWord.end - duration;
        words[words.length - 1] = {
          ...lastWord,
          begin: lastWord.begin - overflow,
          end: duration,
        };
      }

      if (activeData.trackType === "word") {
        updateLineWithHistory(activeData.lineId, { words });
      } else {
        updateLineWithHistory(activeData.lineId, { backgroundWords: words });
      }
    },
    [moveWordToBg, moveWordFromBg, updateLineWithHistory, zoom, duration, lines],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  return { sensors, activeDrag, handleDragStart, handleDragEnd, handleDragCancel };
}

// -- Exports -------------------------------------------------------------------

export { useTimelineDnd };
export type { DragData };
