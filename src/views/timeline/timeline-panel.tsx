import { FileDropZone } from "@/audio/file-drop-zone";
import { useAudioStore } from "@/stores/audio";
import { getAgentColor, useProjectStore } from "@/stores/project";
import { LyricsImportModal } from "@/views/timeline/lyrics-import-modal";
import { MarqueeSelection } from "@/views/timeline/marquee-selection";
import { PastePreview } from "@/views/timeline/paste-preview";
import { TimelineContextMenu } from "@/views/timeline/timeline-context-menu";
import { TimelineSyllableSplitter } from "@/views/timeline/timeline-syllable-splitter";
import { WordEditOverlay } from "@/views/timeline/word-edit-overlay";
import { TimelineHeader } from "@/views/timeline/timeline-header";
import { TimelineInfoPanel } from "@/views/timeline/timeline-info-panel";
import { TimelinePlayhead } from "@/views/timeline/timeline-playhead";
import { TimelinePreviewSidebar } from "@/views/timeline/timeline-preview-sidebar";
import { TimelineRows } from "@/views/timeline/timeline-rows";
import { GUTTER_WIDTH, MAX_ZOOM, MIN_ZOOM, useTimelineStore } from "@/views/timeline/timeline-store";
import { TimelineWaveform } from "@/views/timeline/timeline-waveform";
import { useMarquee } from "@/views/timeline/use-marquee";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";
import { useTimelineKeyboard } from "@/views/timeline/use-timeline-keyboard";
import { useTimelinePan } from "@/views/timeline/use-timeline-pan";
import { distributeLinesTiming } from "@/views/timeline/utils";
import { Button } from "@/ui/button";
import { IconFileImport, IconFileMusic, IconMusic } from "@tabler/icons-react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { Activity, useCallback, useEffect, useRef, useState } from "react";

// -- Components ----------------------------------------------------------------

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
  const lines = useProjectStore((s) => s.lines);
  const setLines = useProjectStore((s) => s.setLines);
  const zoom = useTimelineStore((s) => s.zoom);
  const setScrollLeft = useTimelineStore((s) => s.setScrollLeft);
  const previewSidebarOpen = useTimelineStore((s) => s.previewSidebarOpen);
  const pasteMode = useTimelineStore((s) => s.pasteMode);
  const editingWord = useTimelineStore((s) => s.editingWord);

  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(400);
  const [lyricsModalOpen, setLyricsModalOpen] = useState(false);

  const { handlePanMouseDown } = useTimelinePan(scrollContainerRef);
  const { sensors, activeDrag, handleDragStart, handleDragEnd, handleDragCancel } = useTimelineDnd(lines);
  const { marqueeRect, handleMarqueeMouseDown } = useMarquee(scrollContainerRef);
  const openLyricsModal = useCallback(() => setLyricsModalOpen(true), []);
  useTimelineKeyboard(scrollContainerRef, lines, duration, openLyricsModal);

  const lastDistributedDurationRef = useRef<number | null>(null);

  useEffect(() => {
    if (duration <= 0 || lines.length === 0) return;
    if (lastDistributedDurationRef.current === duration) return;

    const hasAnyTiming = lines.some((l) => l.words?.length || (l.begin !== undefined && l.end !== undefined));

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

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setScrollLeft(e.currentTarget.scrollLeft);
    },
    [setScrollLeft],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();

      const container = scrollContainerRef.current;
      if (!container || duration <= 0) return;

      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left - GUTTER_WIDTH + container.scrollLeft;
      const cursorTime = cursorX / zoom;

      const delta = e.deltaY > 0 ? -20 : 20;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));

      if (newZoom === zoom) return;

      const newCursorX = cursorTime * newZoom;
      const newScrollLeft = Math.max(0, newCursorX - (e.clientX - rect.left - GUTTER_WIDTH));

      useTimelineStore.getState().setZoom(newZoom);
      container.scrollLeft = newScrollLeft;
    },
    [zoom, duration],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handlePanMouseDown(e);
      if (e.button === 0 && pasteMode.status !== "preview") {
        handleMarqueeMouseDown(e);
      }
    },
    [handlePanMouseDown, handleMarqueeMouseDown, pasteMode],
  );

  const handleAudioDrop = useCallback((file: File) => {
    useAudioStore.getState().setSource({ type: "file", file });
  }, []);

  if (!source) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden select-none">
        <TimelineHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <FileDropZone accept="audio/*" onFileDrop={handleAudioDrop}>
            <IconMusic className="w-12 h-12 mb-4 opacity-50 text-composer-text" stroke={1.5} />
            <p className="text-composer-text-secondary">Drop audio file here</p>
            <p className="mt-1 text-sm text-composer-text-muted">or click to browse</p>
            <p className="mt-4 text-xs text-composer-text-muted">Supports MP3, WAV, M4A, OGG, FLAC</p>
          </FileDropZone>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden select-none">
        <TimelineHeader onImportLyrics={() => setLyricsModalOpen(true)} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <IconFileMusic className="w-12 h-12 text-composer-text-muted" />
          <p className="text-lg text-composer-text-secondary">No lyrics loaded</p>
          <p className="text-sm text-composer-text-muted">Paste lyrics or import a file</p>
          <Button variant="primary" hasIcon onClick={() => setLyricsModalOpen(true)} className="mt-2">
            <IconFileImport size={16} />
            Import Lyrics
          </Button>
        </div>
        <LyricsImportModal isOpen={lyricsModalOpen} onClose={() => setLyricsModalOpen(false)} />
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
      <div data-tour="timeline-panel" className="flex flex-col flex-1 overflow-hidden select-none">
        <TimelineHeader onImportLyrics={() => setLyricsModalOpen(true)} />

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col flex-1 overflow-hidden">
            <div ref={contentRef} className="relative flex-1 flex flex-col overflow-hidden isolate">
              <div
                ref={scrollContainerRef}
                data-scroll-container
                className="flex-1 overflow-auto"
                onScroll={handleScroll}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onAuxClick={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                  }
                }}
              >
                <div className="absolute grid place-items-center text-xs text-composer-text-muted top-0 left-0 z-100 w-12 h-20.25 border-b border-r-2 border-composer-border bg-composer-bg shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24">
                    <title>Music Icon</title>
                    <path
                      fill="currentColor"
                      d="M10 21q-1.65 0-2.825-1.175T6 17t1.175-2.825T10 13q.575 0 1.063.138t.937.412V4q0-.425.288-.712T13 3h4q.425 0 .713.288T18 4v2q0 .425-.288.713T17 7h-3v10q0 1.65-1.175 2.825T10 21"
                    />
                  </svg>
                </div>
                <div className="sticky ml-12 top-0 z-40 bg-composer-bg w-max border-b border-composer-border shadow-lg">
                  <TimelineWaveform />
                </div>

                <TimelineRows scrollContainerRef={scrollContainerRef} />
              </div>

              <TimelinePlayhead containerHeight={contentHeight} scrollContainerRef={scrollContainerRef} />

              {marqueeRect && <MarqueeSelection rect={marqueeRect} scrollContainerRef={scrollContainerRef} />}

              {pasteMode.status === "preview" && (
                <PastePreview clipboard={pasteMode.clipboard} scrollContainerRef={scrollContainerRef} />
              )}

              {editingWord && (
                <WordEditOverlay
                  lineId={editingWord.lineId}
                  wordIndex={editingWord.wordIndex}
                  type={editingWord.type}
                  scrollContainerRef={scrollContainerRef}
                />
              )}
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

      <TimelineContextMenu />
      <TimelineSyllableSplitter />
      <LyricsImportModal isOpen={lyricsModalOpen} onClose={() => setLyricsModalOpen(false)} />
    </DndContext>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelinePanel };
