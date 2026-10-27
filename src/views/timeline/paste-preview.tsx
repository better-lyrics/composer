import { type TimeRange, timeRangeResolver, wholeSongRange } from "@/domain/group/shared-timing";
import { effectiveTrackWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { boundsOverlap } from "@/domain/word/overlap";
import { useAudioStore } from "@/stores/audio";
import { isAnyModalOpen, openModalCount, useEscapeLayerStackStore } from "@/stores/escape-layer-stack";
import { useProjectStore } from "@/stores/project";
import { pasteOverlaps, pastedWordBounds } from "@/views/timeline/apply-paste-to-lines";
import { commitPasteAt } from "@/views/timeline/commit-paste";
import { GROUP_HEADER_HEIGHT } from "@/views/timeline/group-header-row";
import { lastKnownPointer } from "@/views/timeline/last-pointer";
import { currentOverviewBandHeight, useOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { bgTrackHeight, wordBlockWidth, wordInsetPx } from "@/views/timeline/row-geometry";
import type { ClipboardData } from "@/views/timeline/selection-types";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { type RowLayout, computeRowLayout, getLineIndexAtY } from "@/views/timeline/utils";
import { type RefObject, useEffect, useMemo, useReducer, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface PastePreviewProps {
  clipboard: ClipboardData;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

interface GhostWord {
  text: string;
  left: number;
  width: number;
  trackTop: number;
  trackHeight: number;
  overlaps: boolean;
  outOfBounds: boolean;
  isBg: boolean;
}

// -- Constants -----------------------------------------------------------------

const WAVEFORM_BORDER = 1;
const BG_BORDER = 1;

// -- Component -----------------------------------------------------------------

const PastePreview: React.FC<PastePreviewProps> = ({ clipboard, scrollContainerRef }) => {
  const [mousePos, setMousePos] = useState(lastKnownPointer);
  const [, redrawOnScroll] = useReducer((tick: number) => tick + 1, 0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ clientX: e.clientX, clientY: e.clientY });
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
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

  const zoom = useTimelineStore((s) => s.zoom);
  const rowHeights = useTimelineStore((s) => s.rowHeights);
  const defaultRowHeight = useTimelineStore((s) => s.defaultRowHeight);
  const collapsedInstances = useTimelineStore((s) => s.collapsedInstances);
  const focusedGroup = useTimelineStore((s) => s.focusedGroup);
  const bandHeight = useOverviewBandHeight();
  const lines = useProjectStore((s) => s.lines);
  const groups = useProjectStore((s) => s.groups);
  const duration = useAudioStore((s) => s.duration);
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
  const hoveredLineIndex = pointer ? getLineIndexAtY(pointer.y, lines, layout) : -1;
  const targetLineIndex =
    hoveredLineIndex >= 0 ? hoveredLineIndex : isInstancePaste ? Math.max(0, lines.length - 1) : -1;
  const timeDelta = pointer ? pointer.time - clipboard.entries[0].word.begin : 0;
  const hasOverlap =
    !isInstancePaste && targetLineIndex >= 0 && pasteOverlaps(clipboard, targetLineIndex, timeDelta, lines, rangeOf);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.dataset.pasteCursor = hasOverlap ? "blocked" : "copy";
    return () => {
      delete container.dataset.pasteCursor;
    };
  }, [hasOverlap, scrollContainerRef]);

  if (!container || !pointer || targetLineIndex < 0) return null;

  const ghosts = computeGhosts(
    clipboard,
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
  const lines = useProjectStore.getState().lines;
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
  await commitPasteAt({ clipboard, cursorTime: pointer.time, lineIndex: getLineIndexAtY(pointer.y, lines, layout) });
}

function computeGhosts(
  clipboard: ClipboardData,
  targetLineIndex: number,
  timeDelta: number,
  lines: LyricLine[],
  zoom: number,
  duration: number,
  rangeOf: (line: LyricLine) => TimeRange,
  layout: RowLayout,
  defaultRowHeight: number,
): GhostWord[] {
  const ghosts: GhostWord[] = [];

  let layoutEnd = 0;
  for (const pos of layout.lineTops.values()) layoutEnd = Math.max(layoutEnd, pos.top + pos.height);
  for (const pos of layout.headerTops.values()) layoutEnd = Math.max(layoutEnd, pos.top + pos.height);

  for (const entry of clipboard.entries) {
    const lineIdx = targetLineIndex + entry.lineOffset;
    const inRange = lineIdx >= 0 && lineIdx < lines.length;
    const targetLine = inRange ? lines[lineIdx] : null;
    const targetPos = targetLine ? layout.lineTops.get(targetLine.id) : null;
    const outOfBounds = !targetLine || !targetPos;
    const isBg = entry.trackType === "bg";

    const pasted = pastedWordBounds(entry.word, timeDelta, targetLine ? rangeOf(targetLine) : wholeSongRange(duration));

    const left = GUTTER_WIDTH + pasted.begin * zoom;
    const width = wordBlockWidth(pasted.begin, pasted.end, zoom);

    let overlaps = outOfBounds;
    if (targetLine && !outOfBounds) {
      const existingWords = effectiveTrackWords(targetLine, isBg ? "bg" : "word") ?? [];
      overlaps = existingWords.some((existing) => boundsOverlap(pasted, existing));
    }

    let trackTop: number;
    let trackHeight: number;

    if (!targetPos || !targetLine) {
      trackTop = layoutEnd;
      trackHeight = defaultRowHeight;
    } else {
      const mainHeight = targetPos.mainBottom - targetPos.top;
      const bgHeight = bgTrackHeight(targetLine, mainHeight);
      if (isBg) {
        trackTop = targetPos.top + mainHeight + BG_BORDER;
        trackHeight = bgHeight;
      } else {
        trackTop = targetPos.top;
        trackHeight = mainHeight;
      }
    }

    ghosts.push({
      text: entry.word.text,
      left,
      width,
      trackTop,
      trackHeight,
      overlaps,
      outOfBounds,
      isBg,
    });
  }

  return ghosts;
}

// -- Exports -------------------------------------------------------------------

export { PastePreview };
