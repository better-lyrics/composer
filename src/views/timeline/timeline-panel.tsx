import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import { useAudioStore } from "@/stores/audio";
import { getAgentColor, useProjectStore } from "@/stores/project";
import { TimelineHeader } from "@/views/timeline/timeline-header";
import { TimelineWaveform } from "@/views/timeline/timeline-waveform";
import { TimelineRows } from "@/views/timeline/timeline-rows";
import { TimelinePlayhead } from "@/views/timeline/timeline-playhead";
import { TimelineInfoPanel } from "@/views/timeline/timeline-info-panel";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { distributeLinesTiming } from "@/views/timeline/utils";
import { useCallback, useEffect, useRef, useState } from "react";

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

// -- Components ----------------------------------------------------------------

const EmptyState: React.FC<{ message: string; hint: string }> = ({ message, hint }) => (
  <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
    <p className="text-lg text-composer-text-secondary">{message}</p>
    <p className="text-sm text-composer-text-muted">{hint}</p>
  </div>
);

const DragGhost: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <div
    className="px-3 py-1 text-xs text-white rounded-xl border cursor-grabbing shadow-lg"
    style={{
      backgroundColor: `${color}80`,
      borderColor: color,
    }}
  >
    {text}
  </div>
);

const TimelinePanel: React.FC = () => {
  const source = useAudioStore((s) => s.source);
  const duration = useAudioStore((s) => s.duration);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);

  const lines = useProjectStore((s) => s.lines);
  const setLines = useProjectStore((s) => s.setLines);
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
  const moveWordToBg = useProjectStore((s) => s.moveWordToBg);
  const moveWordFromBg = useProjectStore((s) => s.moveWordFromBg);

  const zoom = useTimelineStore((s) => s.zoom);
  const setSelectedWord = useTimelineStore((s) => s.setSelectedWord);
  const setScrollLeft = useTimelineStore((s) => s.setScrollLeft);

  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(400);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  // Initialize timing if lines have no timing
  useEffect(() => {
    if (duration <= 0 || lines.length === 0) return;

    const hasAnyTiming = lines.some((l) => l.words?.length || (l.begin !== undefined && l.end !== undefined));

    if (!hasAnyTiming) {
      const distributed = distributeLinesTiming(lines, duration);
      setLines(distributed);
    }
  }, [duration, lines, setLines]);

  // Track content height for playhead
  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContentHeight(entries[0].contentRect.height);
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      } else if (e.key === "Escape") {
        setSelectedWord(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, setIsPlaying, setSelectedWord]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (data) {
      setActiveDrag(data);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);

      const { active, over, delta } = event;
      if (!over) return;

      const dropId = String(over.id);
      const activeData = active.data.current as DragData | undefined;
      if (!activeData) return;

      const targetLineId = over.data.current?.lineId;
      if (targetLineId !== activeData.lineId) return;

      const line = lines.find((l) => l.id === activeData.lineId);
      if (!line) return;

      // Check for track transfer (significant vertical movement)
      const movedDownToBg = delta.y > 30;
      const movedUpToMain = delta.y < -30;

      if (dropId.startsWith("bg-drop-") && activeData.trackType === "word" && movedDownToBg) {
        moveWordToBg(activeData.lineId, activeData.wordIndex);
        return;
      }

      if (dropId.startsWith("main-drop-") && activeData.trackType === "bg" && movedUpToMain) {
        moveWordFromBg(activeData.lineId, activeData.wordIndex);
        return;
      }

      // Horizontal repositioning / reordering
      if (Math.abs(delta.x) < 5) return;

      const wordsArray = activeData.trackType === "word" ? line.words : line.backgroundWords;
      if (!wordsArray) return;

      const wordIndex = activeData.wordIndex;
      const timeDelta = delta.x / zoom;
      const wordDuration = activeData.end - activeData.begin;

      // Calculate new position, clamped to valid range
      const newBegin = Math.max(0, Math.min(duration - wordDuration, activeData.begin + timeDelta));
      const newEnd = newBegin + wordDuration;

      // Update the word's timing
      const words = [...wordsArray];
      words[wordIndex] = { ...words[wordIndex], begin: newBegin, end: newEnd };

      // Re-sort by begin time to handle reordering
      words.sort((a, b) => a.begin - b.begin);

      // Check for overlaps and push words apart
      for (let i = 1; i < words.length; i++) {
        if (words[i].begin < words[i - 1].end) {
          const overlap = words[i - 1].end - words[i].begin;
          words[i] = { ...words[i], begin: words[i].begin + overlap, end: words[i].end + overlap };
        }
      }

      // Clamp last word to duration
      const lastWord = words[words.length - 1];
      if (lastWord.end > duration) {
        const overflow = lastWord.end - duration;
        words[words.length - 1] = { ...lastWord, begin: lastWord.begin - overflow, end: duration };
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

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setScrollLeft(e.currentTarget.scrollLeft);
    },
    [setScrollLeft],
  );

  if (!source) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No audio loaded" hint="Import audio in the Import tab first" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No lyrics to display" hint="Add lyrics in the Edit tab first" />
      </div>
    );
  }

  const dragColor = activeDrag ? getAgentColor(lines.find((l) => l.id === activeDrag.lineId)?.agentId ?? "") : "#888";

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col flex-1 overflow-hidden select-none">
        <TimelineHeader />

        <div ref={contentRef} className="relative flex-1 flex flex-col overflow-hidden">
          {/* Shared scroll container for waveform and rows */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-auto"
            onScroll={handleScroll}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
              }
            }}
          >
            {/* Sticky waveform */}
            <div className="sticky top-0 z-10 border-b border-composer-border bg-composer-bg w-max">
              <TimelineWaveform />
            </div>

            {/* Rows */}
            <TimelineRows />
          </div>

          {/* Playhead overlay */}
          <TimelinePlayhead containerHeight={contentHeight} />
        </div>

        <TimelineInfoPanel />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag && <DragGhost text={activeDrag.text} color={dragColor} />}
      </DragOverlay>
    </DndContext>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelinePanel };
