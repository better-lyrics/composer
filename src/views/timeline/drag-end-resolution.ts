import type { LyricLine } from "@/domain/line/model";
import { GROUP_HEADER_HEIGHT } from "@/views/timeline/group-header-row";
import { type TrackHit, useTimelineStore, WAVEFORM_HEIGHT } from "@/views/timeline/timeline-store";
import { computeRowLayout, getLineAndTrackAtY } from "@/views/timeline/utils";

// -- Constants -----------------------------------------------------------------

const WAVEFORM_BORDER = 1;
const ROWS_START_Y = WAVEFORM_HEIGHT + WAVEFORM_BORDER;
const TRACK_SELECTOR = "[data-line-index][data-track]";

// -- Types ---------------------------------------------------------------------

interface DropTarget {
  targetLineIndex: number;
  targetTrack: "word" | "bg";
}

interface ResolveDropTargetInput {
  clientX: number;
  clientY: number;
  lines: LyricLine[];
}

// -- Helpers -------------------------------------------------------------------

// The rendered rows are the single source of truth for row geometry, and they
// live in the same coordinate frame as the pointer, so hit-testing them is
// correct under any browser/OS scale. Each track tags itself with
// data-line-index + data-track (line-row.tsx). Walking up from whatever paints
// under the cursor finds the row the user is visually over.
function trackElementAt(clientX: number, clientY: number): HTMLElement | null {
  const hit = document.elementFromPoint(clientX, clientY);
  const track = hit?.closest<HTMLElement>(TRACK_SELECTOR);
  if (track) return track;
  const row = hit?.closest<HTMLElement>("[data-timeline-row]");
  return row ? nearestTrackByY(row, clientY) : null;
}

// The gutter and resize strip sit over a row but outside its tracks, so resolve them by height.
function nearestTrackByY(row: HTMLElement, clientY: number): HTMLElement | null {
  let nearest: HTMLElement | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const track of row.querySelectorAll<HTMLElement>(TRACK_SELECTOR)) {
    const { top, bottom } = track.getBoundingClientRect();
    const distance = clientY < top ? top - clientY : clientY >= bottom ? clientY - bottom : 0;
    if (distance < nearestDistance) {
      nearest = track;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function hasRenderedTracks(): boolean {
  return document.querySelector(TRACK_SELECTOR) !== null;
}

function hitTestTrack(clientX: number, clientY: number): TrackHit | null {
  const el = trackElementAt(clientX, clientY);
  if (!el) return null;
  const lineIndex = Number(el.dataset.lineIndex);
  const track = el.dataset.track;
  if (!Number.isInteger(lineIndex) || (track !== "word" && track !== "bg")) return null;
  return { lineIndex, track };
}

// Fallback for environments where the tagged rows are not in the DOM (unit
// harness). Reconstructs row geometry from the layout constants; because those
// are unscaled CSS px, this path drifts under a scaled frame, which is why the
// DOM hit-test above is preferred whenever a row is under the cursor.
function resolveViaLayoutModel(
  clientY: number,
  lines: LyricLine[],
): { lineIndex: number; track: "word" | "bg" } | null {
  const container = document.querySelector<HTMLDivElement>("[data-scroll-container]");
  if (!container) return null;
  const rect = container.getBoundingClientRect();
  const cursorY = clientY - rect.top + container.scrollTop;

  const { rowHeights, defaultRowHeight, collapsedInstances } = useTimelineStore.getState();
  const layout = computeRowLayout({
    lines,
    rowHeights,
    defaultRowHeight,
    collapsedInstances,
    waveformHeight: ROWS_START_Y,
    groupHeaderHeight: GROUP_HEADER_HEIGHT,
  });
  return getLineAndTrackAtY(cursorY, lines, layout);
}

function resolveDropTarget({ clientX, clientY, lines }: ResolveDropTargetInput): DropTarget | null {
  const hit = hasRenderedTracks() ? hitTestTrack(clientX, clientY) : resolveViaLayoutModel(clientY, lines);
  if (!hit || hit.lineIndex < 0 || hit.lineIndex >= lines.length) return null;
  return { targetLineIndex: hit.lineIndex, targetTrack: hit.track };
}

// -- Exports -------------------------------------------------------------------

export { hitTestTrack, resolveDropTarget, trackElementAt };
