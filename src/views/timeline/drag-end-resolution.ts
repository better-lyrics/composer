import type { LyricLine } from "@/domain/line/model";
import { GROUP_HEADER_HEIGHT } from "@/views/timeline/group-header-row";
import { GUTTER_WIDTH, useTimelineStore, WAVEFORM_HEIGHT } from "@/views/timeline/timeline-store";
import { computeRowLayout, getLineAndTrackAtY } from "@/views/timeline/utils";
import type { DragEndEvent } from "@dnd-kit/core";

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

// -- Helpers -------------------------------------------------------------------

function resolveDropTarget(event: DragEndEvent, lines: LyricLine[]): DropTarget | null {
  const { activatorEvent, delta } = event;
  if (!(activatorEvent instanceof PointerEvent)) return null;

  const container = document.querySelector<HTMLDivElement>("[data-scroll-container]");
  if (!container) return null;

  const rect = container.getBoundingClientRect();
  const cursorClientX = activatorEvent.clientX + delta.x;
  const cursorClientY = activatorEvent.clientY + delta.y;
  const cursorX = cursorClientX - rect.left + container.scrollLeft;
  const cursorY = cursorClientY - rect.top + container.scrollTop;

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
