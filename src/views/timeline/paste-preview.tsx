import { type TimeRange, timeRangeResolver, wholeSongRange } from "@/domain/group/shared-timing";
import { effectiveTrackWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { boundsOverlap } from "@/domain/word/overlap";
import { useAudioStore } from "@/stores/audio";
import { openModalCount, useEscapeLayerStackStore } from "@/stores/escape-layer-stack";
import { useProjectStore } from "@/stores/project";
import { cn } from "@/utils/cn";
import { pasteOverlaps, pastedWordBounds } from "@/views/timeline/apply-paste-to-lines";
import { commitPasteAt } from "@/views/timeline/commit-paste";
import { GROUP_HEADER_HEIGHT } from "@/views/timeline/group-header-row";
import { bgTrackHeight, wordBlockWidth, wordInsetPx } from "@/views/timeline/row-geometry";
import type { ClipboardData } from "@/views/timeline/selection-types";
import { GUTTER_WIDTH, WAVEFORM_HEIGHT, useTimelineStore } from "@/views/timeline/timeline-store";
import { type RowLayout, computeRowLayout, getLineIndexAtY } from "@/views/timeline/utils";
import { type RefObject, useCallback, useEffect, useMemo, useState } from "react";

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
const ROWS_START_Y = WAVEFORM_HEIGHT + WAVEFORM_BORDER;
const BG_BORDER = 1;

// -- Component -----------------------------------------------------------------

const PastePreview: React.FC<PastePreviewProps> = ({ clipboard, scrollContainerRef }) => {
  const [mousePos, setMousePos] = useState<{ clientX: number; clientY: number } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ clientX: e.clientX, clientY: e.clientY });
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const commitPaste = useCallback(
    async (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      const container = scrollContainerRef.current;
      if (!container) return;

      const { zoom, rowHeights, defaultRowHeight, collapsedInstances, focusedGroup } = useTimelineStore.getState();
      const lines = useProjectStore.getState().lines;
      const layout = computeRowLayout({
        lines,
        rowHeights,
        defaultRowHeight,
        collapsedInstances,
        focusedGroup,
        waveformHeight: ROWS_START_Y,
        groupHeaderHeight: GROUP_HEADER_HEIGHT,
      });

      const containerRect = container.getBoundingClientRect();
      const cursorTime = (e.clientX - containerRect.left - GUTTER_WIDTH + container.scrollLeft) / zoom;

      const cursorY = e.clientY - containerRect.top + container.scrollTop;
      const hoveredLineIndex = getLineIndexAtY(cursorY, lines, layout);

      await commitPasteAt({ clipboard, cursorTime, lineIndex: hoveredLineIndex });
    },
    [clipboard, scrollContainerRef],
  );

  const modalCount = useEscapeLayerStackStore(openModalCount);

  // Reactive subscriptions BEFORE the early returns so the layout memo can run
  // every render. Mousemove updates mousePos but does not invalidate the layout
  // memo dependencies, so the layout stays stable across cursor moves.
  const zoom = useTimelineStore((s) => s.zoom);
  const rowHeights = useTimelineStore((s) => s.rowHeights);
  const defaultRowHeight = useTimelineStore((s) => s.defaultRowHeight);
  const collapsedInstances = useTimelineStore((s) => s.collapsedInstances);
  const focusedGroup = useTimelineStore((s) => s.focusedGroup);
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
        waveformHeight: ROWS_START_Y,
        groupHeaderHeight: GROUP_HEADER_HEIGHT,
      }),
    [lines, rowHeights, defaultRowHeight, collapsedInstances, focusedGroup],
  );

  const container = scrollContainerRef.current;
  if (!container || !mousePos || modalCount > 0) return null;

  const containerRect = container.getBoundingClientRect();
  const cursorTime = (mousePos.clientX - containerRect.left - GUTTER_WIDTH + container.scrollLeft) / zoom;
  const cursorY = mousePos.clientY - containerRect.top + container.scrollTop;
  const isInstancePaste = !!clipboard.sourceInstance;
  const hoveredLineIndex = getLineIndexAtY(cursorY, lines, layout);
  const targetLineIndex =
    hoveredLineIndex >= 0 ? hoveredLineIndex : isInstancePaste ? Math.max(0, lines.length - 1) : -1;

  if (targetLineIndex < 0) return null;

  const firstEntry = clipboard.entries[0];
  const timeDelta = cursorTime - firstEntry.word.begin;

  const hasOverlap = isInstancePaste ? false : pasteOverlaps(clipboard, targetLineIndex, timeDelta, lines, rangeOf);

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

  const scrollLeft = container.scrollLeft;
  const scrollTop = container.scrollTop;

  return (
    <div
      role="button"
      tabIndex={-1}
      aria-label="Place pasted content here"
      className={cn("absolute inset-0 z-55", hasOverlap ? "cursor-not-allowed" : "cursor-copy")}
      onClick={commitPaste}
      onKeyDown={() => {}}
    >
      {ghosts.map((ghost) => (
        <div
          key={`${ghost.left}-${ghost.trackTop}-${ghost.text}-${ghost.isBg ? "bg" : "w"}`}
          data-lane={ghost.isBg ? "bg" : "word"}
          className="word-face absolute flex items-center justify-center whitespace-nowrap pointer-events-none"
          style={{
            left: ghost.left - scrollLeft,
            top: ghost.trackTop - scrollTop + wordInsetPx(ghost.isBg ? "bg" : "word"),
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
