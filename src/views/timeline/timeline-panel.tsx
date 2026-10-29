import { FileDropZone } from "@/audio/file-drop-zone";
import { getAgentColor } from "@/domain/agent/colors";
import { AUDIO_FORMATS_PROSE } from "@/domain/audio-file/supported-formats";
import { getEffectiveLines } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { trackWords } from "@/domain/line/tracks";
import { isWordSelected } from "@/domain/selection/identity";
import { boundsOverlap } from "@/domain/word/overlap";
import { useLoadAudioFile } from "@/hooks/useLoadAudioFile";
import { useAudioStore } from "@/stores/audio";
import { useImportModal } from "@/stores/import-modal-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { BeatGridCorner } from "@/views/timeline/beat-grid/beat-grid-corner";
import { HoverSizedDragGhost, TimelineDragOverlay } from "@/views/timeline/drag-ghost";
import { dragGhostCells } from "@/views/timeline/drag-ghost-cells";
import { trackSnapModifier } from "@/views/timeline/drag-track-snap";
import { EmptyTimelineImport } from "@/views/timeline/empty-timeline-import";
import { GroupFocusBar } from "@/views/timeline/group-focus-bar";
import { forgetPointer, rememberPointer } from "@/views/timeline/last-pointer";
import { LoopRegionBar } from "@/views/timeline/loop-region-bar";
import { LoopRegionGuides } from "@/views/timeline/loop-region-guides";
import { LoopRegionReadout } from "@/views/timeline/loop-region-readout";
import { EditLoupe } from "@/views/timeline/loupe/edit-loupe";
import { MarqueeSelection } from "@/views/timeline/marquee-selection";
import { PastePreview } from "@/views/timeline/paste-preview";
import { SelectionPlaybackBar } from "@/views/timeline/selection-playback-bar";
import { selfKey } from "@/views/timeline/snap";
import { SnapGuideline } from "@/views/timeline/snap-guideline";
import { SnapMarkersOverlay } from "@/views/timeline/snap-markers-overlay";
import { TimelineContextMenu } from "@/views/timeline/timeline-context-menu";
import { TimelineHeader } from "@/views/timeline/timeline-header";
import { TimelineInfoPanel } from "@/views/timeline/timeline-info-panel";
import { TimelinePlayhead } from "@/views/timeline/timeline-playhead";
import { TimelinePreviewSidebar } from "@/views/timeline/timeline-preview-sidebar";
import { TimelineRows } from "@/views/timeline/timeline-rows";
import { TimelineRuler } from "@/views/timeline/timeline-ruler";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { TimelineSyllableSplitter } from "@/views/timeline/timeline-syllable-splitter";
import { TimelineWaveform } from "@/views/timeline/timeline-waveform";
import { useGestureInputReplay } from "@/views/timeline/use-gesture-input-replay";
import { useGroupFocusScroll } from "@/views/timeline/use-group-focus-scroll";
import { useGroupFocusShortcuts } from "@/views/timeline/use-group-focus-shortcuts";
import { useMarquee } from "@/views/timeline/use-marquee";
import { useResumeView } from "@/views/timeline/use-resume-view";
import { useSeekReveal } from "@/views/timeline/use-seek-reveal";
import { useSharedTimingPing } from "@/views/timeline/use-shared-timing-ping";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";
import { useTimelineFrameWake } from "@/views/timeline/use-timeline-frame-wake";
import { useTimelineKeyboard } from "@/views/timeline/use-timeline-keyboard";
import { useTimelinePan } from "@/views/timeline/use-timeline-pan";
import { useTimelineSnap } from "@/views/timeline/use-timeline-snap";
import { useTimelineWheel } from "@/views/timeline/use-timeline-wheel";
import { WordEditOverlay } from "@/views/timeline/word-edit-overlay";
import { DndContext } from "@dnd-kit/core";
import { IconMusic } from "@tabler/icons-react";
import { useOverlayScrollbars } from "overlayscrollbars-react";
import "overlayscrollbars/overlayscrollbars.css";
import { Activity, useCallback, useEffect, useMemo, useRef, useState } from "react";

// -- Helpers -------------------------------------------------------------------

function makeDragOverlapCheck(
  data: { lineId: string; wordIndex: number; trackType: "word" | "bg"; begin: number; end: number },
  lines: LyricLine[],
) {
  const line = lines.find((l) => l.id === data.lineId);
  if (!line) return () => true;
  const wordsArr = trackWords(line, data.trackType) ?? [];
  return (shift: number) => {
    const newBegin = data.begin + shift;
    const newEnd = data.end + shift;
    return !wordsArr.some((w, i) => {
      if (i === data.wordIndex) return false;
      return boundsOverlap({ begin: newBegin, end: newEnd }, w);
    });
  };
}

// -- Components ----------------------------------------------------------------

const TimelinePanel: React.FC = () => {
  const source = useAudioStore((s) => s.source);
  const duration = useAudioStore((s) => s.duration);
  const lines = useProjectStore((s) => s.lines);
  const setScrollLeft = useTimelineStore((s) => s.setScrollLeft);
  const setScrollTop = useTimelineStore((s) => s.setScrollTop);
  const previewSidebar = useSettingsStore((s) => s.previewSidebar);
  const pasteMode = useTimelineStore((s) => s.pasteMode);
  const editingWord = useTimelineStore((s) => s.editingWord);
  const ghostSnapped = useTimelineStore((s) => s.snappedBlockId !== null);

  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(400);
  const [rulerLane, setRulerLane] = useState<HTMLDivElement | null>(null);
  const [rulerMarkerHost, setRulerMarkerHost] = useState<HTMLDivElement | null>(null);
  const openImportModal = useImportModal();

  const effectiveLines = useMemo(() => getEffectiveLines(lines), [lines]);

  const [initOverlayScrollbars] = useOverlayScrollbars({
    defer: true,
    options: {
      scrollbars: {
        theme: "os-theme-light",
        autoHide: "scroll",
        autoHideDelay: 800,
      },
    },
  });

  useEffect(() => {
    const target = contentRef.current;
    const viewport = scrollContainerRef.current;
    if (!target || !viewport) return;
    initOverlayScrollbars({ target, elements: { viewport } });
  }, [initOverlayScrollbars]);

  const { handlePanMouseDown } = useTimelinePan(scrollContainerRef);
  const { sensors, activeDrag, handleDragStart, handleDragEnd, handleDragCancel } = useTimelineDnd(effectiveLines);
  const dragZoom = useTimelineStore((s) => (activeDrag ? s.zoom : null));
  const { dragSnapModifier, beginGesture, endGesture, syncDragSnap } = useTimelineSnap();
  const lastDragPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const getLastDragPointer = useCallback(() => lastDragPointerRef.current, []);
  useGestureInputReplay({ active: activeDrag !== null, getLastPointer: getLastDragPointer });
  useSharedTimingPing();

  useEffect(() => {
    if (!activeDrag) return;
    const onMove = (e: PointerEvent) => {
      lastDragPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [activeDrag]);

  const { marqueeRect, handleMarqueeMouseDown } = useMarquee(scrollContainerRef);
  const openLyricsModal = useCallback(() => openImportModal(), [openImportModal]);
  useTimelineKeyboard(scrollContainerRef, effectiveLines, duration, openLyricsModal);
  useGroupFocusShortcuts();
  useGroupFocusScroll(scrollContainerRef);
  const timelineShown = !!source && lines.length > 0;
  useTimelineWheel(scrollContainerRef, timelineShown);
  useSeekReveal(scrollContainerRef, timelineShown);
  useTimelineFrameWake(scrollContainerRef, contentRef, timelineShown);
  useResumeView(scrollContainerRef, timelineShown && duration > 0);

  useEffect(() => {
    const { selectedWords } = useTimelineStore.getState();
    if (selectedWords.length === 0) return;
    const valid = selectedWords.filter((sel) => {
      const line = effectiveLines[sel.lineIndex];
      if (!line || line.id !== sel.lineId) return false;
      return !!trackWords(line, sel.type)?.[sel.wordIndex];
    });
    if (valid.length < selectedWords.length) {
      useTimelineStore.getState().setSelectedWords(valid);
    }
  }, [effectiveLines]);

  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContentHeight(entries[0].contentRect.height);
    });
    // react-doctor-disable-next-line react-doctor/no-initialize-state
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setScrollLeft(e.currentTarget.scrollLeft);
      setScrollTop(e.currentTarget.scrollTop);
    },
    [setScrollLeft, setScrollTop],
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

  const handleAudioDrop = useLoadAudioFile();

  const dragColor = activeDrag
    ? getAgentColor(effectiveLines.find((l) => l.id === activeDrag.lineId)?.agentId ?? "")
    : "#888";

  const dragCells = useMemo(
    () => (activeDrag && dragZoom !== null ? dragGhostCells(activeDrag, dragZoom, effectiveLines) : null),
    [activeDrag, dragZoom, effectiveLines],
  );

  if (!source) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden select-none">
        <TimelineHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <FileDropZone accept="audio/*" onFileDrop={handleAudioDrop}>
            <IconMusic className="size-12 mb-4 opacity-50 text-composer-text" stroke={1.5} />
            <p className="text-composer-text-secondary">Drop audio file here</p>
            <p className="mt-1 text-sm text-composer-text-muted">or click to browse</p>
            <p className="mt-4 text-xs text-composer-text-muted">Supports {AUDIO_FORMATS_PROSE}</p>
          </FileDropZone>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden select-none">
        <TimelineHeader onImportLyrics={openLyricsModal} />
        <EmptyTimelineImport openLyricsModal={openLyricsModal} />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      modifiers={[trackSnapModifier, dragSnapModifier]}
      onDragMove={syncDragSnap}
      onDragStart={(e) => {
        handleDragStart(e);
        const data = e.active.data.current as
          | {
              lineId: string;
              wordIndex: number;
              trackType: "word" | "bg";
              begin: number;
              end: number;
              snap?: { edgesAtStart: number[] };
            }
          | undefined;
        if (!data?.snap) return;
        const { selectedWords } = useTimelineStore.getState();
        const lines = useProjectStore.getState().lines;
        const isLeaderInSelection = isWordSelected(selectedWords, data.lineId, data.wordIndex, data.trackType);
        const draggedSet =
          isLeaderInSelection && selectedWords.length > 0
            ? selectedWords
            : [{ lineId: data.lineId, lineIndex: 0, wordIndex: data.wordIndex, type: data.trackType }];
        const selfIds = new Set(draggedSet.map((s) => selfKey(s.lineId, s.wordIndex, s.type)));
        const leaderKey = selfKey(data.lineId, data.wordIndex, data.trackType);
        beginGesture({
          selfIds,
          leaderKey,
          overlapCheck: makeDragOverlapCheck(data, lines),
        });
      }}
      onDragEnd={(e) => {
        endGesture();
        handleDragEnd(e);
      }}
      onDragCancel={() => {
        endGesture();
        handleDragCancel();
      }}
    >
      {/* display: contents so the mask root adds a query anchor without a layout box. */}
      <div data-timeline-mask-root className="contents">
        <div data-tour="timeline-panel" className="flex flex-col flex-1 overflow-hidden select-none">
          <TimelineHeader onImportLyrics={openLyricsModal} scrollContainerRef={scrollContainerRef} />
          <GroupFocusBar />
          <SelectionPlaybackBar />
          <LoopRegionBar />

          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-col flex-1 overflow-hidden">
              <TimelineRuler
                scrollContainerRef={scrollContainerRef}
                laneRef={setRulerLane}
                markerHostRef={setRulerMarkerHost}
              />
              <div
                ref={contentRef}
                data-timeline-scroll-host
                onPointerMove={rememberPointer}
                onPointerLeave={forgetPointer}
                className="relative flex-1 flex flex-col overflow-hidden isolate"
              >
                <div
                  ref={scrollContainerRef}
                  role="application"
                  aria-label="Timeline"
                  data-scroll-container
                  className="flex-1 overflow-auto overscroll-none static! z-[unset] overflow-anchor-none paste-cursor"
                  onScroll={handleScroll}
                  onMouseDown={handleMouseDown}
                  onAuxClick={(e) => e.preventDefault()}
                  onKeyDown={(e) => {
                    const fromOwnContent = e.target instanceof Node && e.currentTarget.contains(e.target);
                    if (fromOwnContent && (e.key === " " || e.key === "Enter")) e.preventDefault();
                  }}
                >
                  <BeatGridCorner />
                  <TimelineWaveform />

                  <TimelineRows scrollContainerRef={scrollContainerRef} />
                </div>

                <TimelinePlayhead
                  containerHeight={contentHeight}
                  scrollContainerRef={scrollContainerRef}
                  capHost={rulerLane}
                />

                <SnapGuideline />

                <LoopRegionGuides />
                <LoopRegionReadout host={rulerLane} />

                <SnapMarkersOverlay scrollContainerRef={scrollContainerRef} headHost={rulerMarkerHost} />

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

                <EditLoupe scrollContainerRef={scrollContainerRef} />
              </div>

              <TimelineInfoPanel />
            </div>

            <Activity mode={previewSidebar ? "visible" : "hidden"}>
              <TimelinePreviewSidebar />
            </Activity>
          </div>
        </div>

        <TimelineDragOverlay>
          {activeDrag && dragCells && (
            <HoverSizedDragGhost
              lines={effectiveLines}
              cells={dragCells.cells}
              anchorWidth={dragCells.anchorWidth}
              anchorHeight={dragCells.anchorHeight}
              color={dragColor}
              isSnapped={ghostSnapped}
            />
          )}
        </TimelineDragOverlay>
      </div>

      <TimelineContextMenu />
      <TimelineSyllableSplitter />
    </DndContext>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelinePanel };
