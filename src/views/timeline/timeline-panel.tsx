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
import { TimelinePreviewSidebar } from "@/views/timeline/timeline-preview-sidebar";
import {
  GUTTER_WIDTH,
  useTimelineStore,
} from "@/views/timeline/timeline-store";
import { distributeLinesTiming } from "@/views/timeline/utils";
import { Activity, useCallback, useEffect, useRef, useState } from "react";

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

const EmptyState: React.FC<{ message: string; hint: string }> = ({
  message,
  hint,
}) => (
  <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
    <p className="text-lg text-composer-text-secondary">{message}</p>
    <p className="text-sm text-composer-text-muted">{hint}</p>
  </div>
);

const DragGhost: React.FC<{ text: string; color: string }> = ({
  text,
  color,
}) => (
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
  const toggleFollow = useTimelineStore((s) => s.toggleFollow);
  const previewSidebarOpen = useTimelineStore((s) => s.previewSidebarOpen);
  const togglePreviewSidebar = useTimelineStore((s) => s.togglePreviewSidebar);

  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(400);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const lastDistributedDurationRef = useRef<number | null>(null);

  useEffect(() => {
    if (duration <= 0 || lines.length === 0) return;
    if (lastDistributedDurationRef.current === duration) return;

    const hasAnyTiming = lines.some(
      (l) => l.words?.length || (l.begin !== undefined && l.end !== undefined)
    );

    if (!hasAnyTiming) {
      const distributed = distributeLinesTiming(lines, duration);
      setLines(distributed);
    }
    lastDistributedDurationRef.current = duration;
  }, [duration, lines, setLines]);

  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContentHeight(entries[0].contentRect.height);
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  const handleSetWordTiming = useCallback(
    (edge: "begin" | "end") => {
      const selectedWord = useTimelineStore.getState().selectedWord;
      if (!selectedWord) return;

      const line = lines[selectedWord.lineIndex];
      if (!line) return;

      const wordsArray =
        selectedWord.type === "word" ? line.words : line.backgroundWords;
      if (!wordsArray) return;

      const audioEl = useAudioStore.getState().audioElement;
      const currentTime =
        audioEl?.currentTime ?? useAudioStore.getState().currentTime;

      const wordIndex = selectedWord.wordIndex;
      const word = wordsArray[wordIndex];
      if (!word) return;

      const updatedWords = [...wordsArray];

      if (edge === "begin") {
        const prevEnd = wordIndex > 0 ? wordsArray[wordIndex - 1].end : 0;
        const maxBegin = word.end - 0.05;
        const clampedBegin = Math.max(
          prevEnd,
          Math.min(maxBegin, Math.max(0, currentTime))
        );
        updatedWords[wordIndex] = { ...word, begin: clampedBegin };
      } else {
        const minEnd = word.begin + 0.05;
        const nextBegin =
          wordIndex < wordsArray.length - 1
            ? wordsArray[wordIndex + 1].begin
            : duration;
        const clampedEnd = Math.min(
          nextBegin,
          Math.max(minEnd, Math.min(duration, currentTime))
        );
        updatedWords[wordIndex] = { ...word, end: clampedEnd };
      }

      if (selectedWord.type === "word") {
        updateLineWithHistory(line.id, { words: updatedWords });
      } else {
        updateLineWithHistory(line.id, { backgroundWords: updatedWords });
      }
    },
    [lines, duration, updateLineWithHistory]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      } else if (e.key === "Escape") {
        setSelectedWord(null);
      } else if (e.key === "f" || e.key === "F") {
        toggleFollow();
      } else if (e.key === "p" || e.key === "P") {
        togglePreviewSidebar();
      } else if (e.key === "[") {
        e.preventDefault();
        handleSetWordTiming("begin");
      } else if (e.key === "]") {
        e.preventDefault();
        handleSetWordTiming("end");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isPlaying,
    setIsPlaying,
    setSelectedWord,
    toggleFollow,
    togglePreviewSidebar,
    handleSetWordTiming,
  ]);

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

      const movedDownToBg = delta.y > 30;
      const movedUpToMain = delta.y < -30;

      if (
        dropId.startsWith("bg-drop-") &&
        activeData.trackType === "word" &&
        movedDownToBg
      ) {
        moveWordToBg(activeData.lineId, activeData.wordIndex);
        return;
      }

      if (
        dropId.startsWith("main-drop-") &&
        activeData.trackType === "bg" &&
        movedUpToMain
      ) {
        moveWordFromBg(activeData.lineId, activeData.wordIndex);
        return;
      }

      if (Math.abs(delta.x) < 5) return;

      const wordsArray =
        activeData.trackType === "word" ? line.words : line.backgroundWords;
      if (!wordsArray) return;

      const wordIndex = activeData.wordIndex;
      const timeDelta = delta.x / zoom;
      const wordDuration = activeData.end - activeData.begin;
      const newBegin = Math.max(
        0,
        Math.min(duration - wordDuration, activeData.begin + timeDelta)
      );
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
    [moveWordToBg, moveWordFromBg, updateLineWithHistory, zoom, duration, lines]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setScrollLeft(e.currentTarget.scrollLeft);
    },
    [setScrollLeft]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();

      const container = scrollContainerRef.current;
      if (!container || duration <= 0) return;

      const rect = container.getBoundingClientRect();
      const cursorX =
        e.clientX - rect.left - GUTTER_WIDTH + container.scrollLeft;
      const cursorTime = cursorX / zoom;

      const delta = e.deltaY > 0 ? -20 : 20;
      const newZoom = Math.max(20, Math.min(500, zoom + delta));

      if (newZoom === zoom) return;

      const newCursorX = cursorTime * newZoom;
      const newScrollLeft = Math.max(
        0,
        newCursorX - (e.clientX - rect.left - GUTTER_WIDTH)
      );

      useTimelineStore.getState().setZoom(newZoom);
      container.scrollLeft = newScrollLeft;
    },
    [zoom, duration]
  );

  if (!source) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState
          message="No audio loaded"
          hint="Import audio in the Import tab first"
        />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState
          message="No lyrics to display"
          hint="Add lyrics in the Edit tab first"
        />
      </div>
    );
  }

  const dragColor = activeDrag
    ? getAgentColor(
        lines.find((l) => l.id === activeDrag.lineId)?.agentId ?? ""
      )
    : "#888";

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col flex-1 overflow-hidden select-none">
        <TimelineHeader />

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col flex-1 overflow-hidden">
            <div
              ref={contentRef}
              className="relative flex-1 flex flex-col overflow-hidden isolate"
            >
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-x-auto"
                onScroll={handleScroll}
                onWheel={handleWheel}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                  }
                }}
              >
                <div className="absolute grid place-items-center text-xs text-composer-text-muted top-0 left-0 z-100 w-12 h-20.25 border-b border-r-2 border-composer-border bg-composer-bg shadow-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-4"
                    viewBox="0 0 24 24"
                  >
                    <title>Music Icon</title>
                    <path
                      fill="currentColor"
                      d="M10 21q-1.65 0-2.825-1.175T6 17t1.175-2.825T10 13q.575 0 1.063.138t.937.412V4q0-.425.288-.712T13 3h4q.425 0 .713.288T18 4v2q0 .425-.288.713T17 7h-3v10q0 1.65-1.175 2.825T10 21"
                    />
                  </svg>
                </div>
                {/* Waveform content - lower z so playhead is visible over it */}
                <div className="sticky top-0 z-40 bg-composer-bg w-max border-b border-composer-border shadow-lg">
                  <TimelineWaveform />
                </div>

                <TimelineRows scrollContainerRef={scrollContainerRef} />
              </div>

              <TimelinePlayhead
                containerHeight={contentHeight}
                scrollContainerRef={scrollContainerRef}
              />
            </div>

            <TimelineInfoPanel />
          </div>

          <Activity mode={previewSidebarOpen ? "visible" : "hidden"}>
            <TimelinePreviewSidebar />
          </Activity>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag && <DragGhost text={activeDrag.text} color={dragColor} />}
      </DragOverlay>
    </DndContext>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelinePanel };
