import { type RefObject, useEffect, useMemo, useReducer, useState } from "react";
import { timeRangeResolver } from "@/domain/group/shared-timing";
import { useAudioStore } from "@/stores/audio";
import { isAnyModalOpen, openModalCount, useEscapeLayerStackStore } from "@/stores/escape-layer-stack";
import { useProjectStore } from "@/stores/project";
import { clipboardInLane, pasteOverlaps } from "@/views/timeline/apply-paste-to-lines";
import { commitPasteAt } from "@/views/timeline/commit-paste";
import { GROUP_HEADER_HEIGHT } from "@/views/timeline/group-header-row";
import { instancePasteClipboard } from "@/views/timeline/instance-paste-template";
import { lastKnownPointer } from "@/views/timeline/last-pointer";
import { currentOverviewBandHeight, useOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { computeGhosts } from "@/views/timeline/paste-ghosts";
import { snappedPasteTime } from "@/views/timeline/paste-snap";
import { wordInsetPx } from "@/views/timeline/row-geometry";
import type { ClipboardData } from "@/views/timeline/selection-types";
import { holdsSnapBypass, syncSnapBypass } from "@/views/timeline/snap-bypass-key";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { computeRowLayout, getLineAndTrackAtY } from "@/views/timeline/utils";

// -- Types ---------------------------------------------------------------------

interface PastePreviewProps {
  clipboard: ClipboardData;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

// -- Constants -----------------------------------------------------------------

const WAVEFORM_BORDER = 1;

// -- Component -----------------------------------------------------------------

const PastePreview: React.FC<PastePreviewProps> = ({ clipboard, scrollContainerRef }) => {
  const [mousePos, setMousePos] = useState(lastKnownPointer);
  const [, redrawOnScroll] = useReducer((tick: number) => tick + 1, 0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ clientX: e.clientX, clientY: e.clientY });
      syncSnapBypass(e);
    };
    const handleModifierChange = (e: KeyboardEvent) => syncSnapBypass(e);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("keydown", handleModifierChange);
    document.addEventListener("keyup", handleModifierChange);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("keydown", handleModifierChange);
      document.removeEventListener("keyup", handleModifierChange);
      useTimelineStore.getState().setIsBypassing(false);
    };
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const isPlacingPress = (e: MouseEvent) => e.button === 0 && !isAnyModalOpen();
    const holdPress = (e: MouseEvent) => {
      if (!isPlacingPress(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const placePaste = (e: MouseEvent) => {
      if (!isPlacingPress(e)) return;
      e.stopPropagation();
      void commitPaste(clipboard, container, e);
    };

    // The playhead and other overlays sit beside the scroll container, so presses are caught on their shared host.
    const host = container.parentElement ?? container;
    host.addEventListener("pointerdown", holdPress, true);
    host.addEventListener("mousedown", holdPress, true);
    host.addEventListener("click", placePaste, true);
    container.addEventListener("scroll", redrawOnScroll, { passive: true });
    return () => {
      host.removeEventListener("pointerdown", holdPress, true);
      host.removeEventListener("mousedown", holdPress, true);
      host.removeEventListener("click", placePaste, true);
      container.removeEventListener("scroll", redrawOnScroll);
    };
  }, [clipboard, scrollContainerRef]);

  const modalCount = useEscapeLayerStackStore(openModalCount);
  const bypassSnap = useTimelineStore((s) => s.isBypassing);

  const zoom = useTimelineStore((s) => s.zoom);
  const rowHeights = useTimelineStore((s) => s.rowHeights);
  const defaultRowHeight = useTimelineStore((s) => s.defaultRowHeight);
  const collapsedInstances = useTimelineStore((s) => s.collapsedInstances);
  const focusedGroup = useTimelineStore((s) => s.focusedGroup);
  const bandHeight = useOverviewBandHeight();
  const lines = useProjectStore((s) => s.lines);
  const groups = useProjectStore((s) => s.groups);
  const duration = useAudioStore((s) => s.duration);
  useAudioStore((s) => (s.isPlaying ? null : s.currentTime));
  const rangeOf = useMemo(() => timeRangeResolver(lines, groups, duration), [lines, groups, duration]);

  const layout = useMemo(
    () =>
      computeRowLayout({
        lines,
        rowHeights,
        defaultRowHeight,
        collapsedInstances,
        focusedGroup,
        waveformHeight: bandHeight + WAVEFORM_BORDER,
        groupHeaderHeight: GROUP_HEADER_HEIGHT,
      }),
    [lines, rowHeights, defaultRowHeight, collapsedInstances, focusedGroup, bandHeight],
  );

  const container = scrollContainerRef.current;
  const isInstancePaste = !!clipboard.sourceInstance;
  const pointer = container && mousePos && modalCount === 0 ? pointerInTimeline(container, mousePos, zoom) : null;
  const hovered = pointer ? getLineAndTrackAtY(pointer.y, lines, layout) : null;
  const targetLineIndex = hovered ? hovered.lineIndex : isInstancePaste ? Math.max(0, lines.length - 1) : -1;
  const hoveredTrack = hovered?.track;
  const placed = useMemo(() => instancePasteClipboard(lines, groups, clipboard), [lines, groups, clipboard]);
  const pasted = useMemo(
    () => (hoveredTrack && !isInstancePaste ? clipboardInLane(placed, hoveredTrack) : placed),
    [placed, hoveredTrack, isInstancePaste],
  );
  const snap =
    pointer && hovered
      ? snappedPasteTime(placed, pointer.time, { lineIndex: targetLineIndex, lane: hovered.track, bypass: bypassSnap })
      : null;
  const timeDelta = pointer ? (snap?.time ?? pointer.time) - placed.entries[0].word.begin : 0;
  const snappedAnchorTime = snap?.anchorTime ?? null;
  const hasOverlap =
    !isInstancePaste && targetLineIndex >= 0 && pasteOverlaps(pasted, targetLineIndex, timeDelta, lines, rangeOf);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.dataset.pasteCursor = hasOverlap ? "blocked" : "copy";
    return () => {
      delete container.dataset.pasteCursor;
    };
  }, [hasOverlap, scrollContainerRef]);

  useEffect(() => {
    useTimelineStore.getState().setSnappedAnchorTime(snappedAnchorTime);
  }, [snappedAnchorTime]);

  useEffect(() => () => useTimelineStore.getState().setSnappedAnchorTime(null), []);

  if (!container || !pointer || targetLineIndex < 0) return null;

  const ghosts = computeGhosts(
    pasted,
    targetLineIndex,
    timeDelta,
    lines,
    zoom,
    duration,
    rangeOf,
    layout,
    defaultRowHeight,
  );

  return (
    <div className="absolute inset-0 z-55 pointer-events-none">
      {ghosts.map((ghost) => (
        <div
          key={`${ghost.left}-${ghost.trackTop}-${ghost.text}-${ghost.isBg ? "bg" : "w"}`}
          data-lane={ghost.isBg ? "bg" : "word"}
          className="word-face absolute flex items-center justify-center whitespace-nowrap pointer-events-none"
          style={{
            left: ghost.left - pointer.scrollLeft,
            top: ghost.trackTop - pointer.scrollTop + wordInsetPx(ghost.isBg ? "bg" : "word"),
            width: ghost.width,
            height: ghost.trackHeight - wordInsetPx(ghost.isBg ? "bg" : "word") * 2,
            "--agent":
              ghost.overlaps || ghost.outOfBounds ? "var(--color-composer-error)" : "var(--color-composer-accent)",
          }}
        >
          <span className="min-w-0 overflow-hidden whitespace-nowrap [text-overflow:inherit] opacity-70">
            {ghost.text}
          </span>
        </div>
      ))}
    </div>
  );
};

// -- Helpers -------------------------------------------------------------------

function pointerInTimeline(container: HTMLElement, pointer: { clientX: number; clientY: number }, zoom: number) {
  const containerRect = container.getBoundingClientRect();
  const { scrollLeft, scrollTop } = container;
  return {
    time: (pointer.clientX - containerRect.left - GUTTER_WIDTH + scrollLeft) / zoom,
    y: pointer.clientY - containerRect.top + scrollTop,
    scrollLeft,
    scrollTop,
  };
}

async function commitPaste(clipboard: ClipboardData, container: HTMLElement, e: MouseEvent): Promise<void> {
  const { zoom, rowHeights, defaultRowHeight, collapsedInstances, focusedGroup } = useTimelineStore.getState();
  const { lines, groups } = useProjectStore.getState();
  const layout = computeRowLayout({
    lines,
    rowHeights,
    defaultRowHeight,
    collapsedInstances,
    focusedGroup,
    waveformHeight: currentOverviewBandHeight() + WAVEFORM_BORDER,
    groupHeaderHeight: GROUP_HEADER_HEIGHT,
  });
  const pointer = pointerInTimeline(container, e, zoom);
  const hovered = getLineAndTrackAtY(pointer.y, lines, layout);
  const lineIndex = hovered?.lineIndex ?? -1;
  const lane = hovered?.track ?? "word";
  const placed = instancePasteClipboard(lines, groups, clipboard);
  const time = hovered
    ? snappedPasteTime(placed, pointer.time, { lineIndex, lane, bypass: holdsSnapBypass(e) }).time
    : pointer.time;
  const instanceStart = clipboard.sourceInstance ? time - placed.entries[0].word.begin : time;
  await commitPasteAt({ clipboard, cursorTime: instanceStart, lineIndex, lane });
}

// -- Exports -------------------------------------------------------------------

export { PastePreview };
