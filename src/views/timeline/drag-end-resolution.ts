import type { LyricLine } from "@/domain/line/model";
import { GROUP_HEADER_HEIGHT } from "@/views/timeline/group-header-row";
import { GUTTER_WIDTH, useTimelineStore, WAVEFORM_HEIGHT } from "@/views/timeline/timeline-store";
import { computeRowLayout, getLineAndTrackAtY } from "@/views/timeline/utils";

// -- Constants -----------------------------------------------------------------

const WAVEFORM_BORDER = 1;
const ROWS_START_Y = WAVEFORM_HEIGHT + WAVEFORM_BORDER;
const BG_DROP_ZONE_HEIGHT = 24;

// -- Types ---------------------------------------------------------------------

interface DropTarget {
  targetLineIndex: number;
  targetTrack: "word" | "bg";
  cursorTime: number;
}

interface ResolveDropTargetInput {
  clientX: number;
  clientY: number;
  lines: LyricLine[];
}

// -- Helpers -------------------------------------------------------------------

// clientX/Y are viewport-relative live pointer coordinates (from a pointermove
// listener), not derived from dnd-kit's delta. dnd-kit's delta is already
// scroll-adjusted, so combining it with scrollTop double-counts auto-scroll.
// Live pointer coordinates already reflect any scroll-during-drag, so adding
// container.scrollTop here cleanly converts viewport to container-content
// coordinates without double-counting.
function resolveDropTarget({ clientX, clientY, lines }: ResolveDropTargetInput): DropTarget | null {
  const container = document.querySelector<HTMLDivElement>("[data-scroll-container]");
  if (!container) return null;

  const rect = container.getBoundingClientRect();
  const cursorX = clientX - rect.left + container.scrollLeft;
  const cursorY = clientY - rect.top + container.scrollTop;

  const { zoom, rowHeights, defaultRowHeight, collapsedInstances } = useTimelineStore.getState();
  const layout = computeRowLayout({
    lines,
    rowHeights,
    defaultRowHeight,
    collapsedInstances,
    waveformHeight: ROWS_START_Y,
    bgDropZoneHeight: BG_DROP_ZONE_HEIGHT,
    groupHeaderHeight: GROUP_HEADER_HEIGHT,
  });

  const hit = getLineAndTrackAtY(cursorY, lines, layout);
  if (!hit) return null;

  const cursorTime = (cursorX - GUTTER_WIDTH) / zoom;
  return { targetLineIndex: hit.lineIndex, targetTrack: hit.track, cursorTime };
}

// -- Exports -------------------------------------------------------------------

export { resolveDropTarget };
export type { DropTarget };
