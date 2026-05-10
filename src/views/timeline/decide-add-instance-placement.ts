import type { LineTemplate, LyricLine } from "@/stores/project";
import { instanceTimingBounds } from "@/views/timeline/utils";

// -- Types --------------------------------------------------------------------

interface PlacementInsert {
  kind: "insert";
  instanceStart: number;
  insertAtIndex: number;
}

interface PlacementFallback {
  kind: "fallback";
  reason: "playhead-inside-line" | "gap-too-small" | "past-last-line";
}

type Placement = PlacementInsert | PlacementFallback;

// -- Pure helpers --------------------------------------------------------------

function templateDuration(template: LineTemplate[]): number {
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const tpl of template) {
    if (tpl.words?.length) {
      for (const w of tpl.words) {
        if (w.relativeBegin < start) start = w.relativeBegin;
        if (w.relativeEnd > end) end = w.relativeEnd;
      }
    }
    if (tpl.backgroundWords?.length) {
      for (const w of tpl.backgroundWords) {
        if (w.relativeBegin < start) start = w.relativeBegin;
        if (w.relativeEnd > end) end = w.relativeEnd;
      }
    }
    if (tpl.relativeBegin !== undefined && tpl.relativeBegin < start) start = tpl.relativeBegin;
    if (tpl.relativeEnd !== undefined && tpl.relativeEnd > end) end = tpl.relativeEnd;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, end - start);
}

function lineTimeRange(line: LyricLine): { begin: number; end: number } | null {
  const bounds = instanceTimingBounds([line]);
  if (!Number.isFinite(bounds.start) || !Number.isFinite(bounds.end)) return null;
  if (bounds.start === 0 && bounds.end === 0) {
    // Truly untimed line (no words, no bg words, no begin/end)
    return null;
  }
  return { begin: bounds.start, end: bounds.end };
}

// Decide where an Add-Instance-At-Playhead action should land.
//
// Rules:
//   - Find the line whose time range immediately precedes / contains the playhead.
//   - If the playhead falls inside an existing line's time range → fallback (no room without overlap).
//   - If the playhead falls in a gap and the gap is large enough to fit the
//     source instance's duration → insert. List position lands after the gap's
//     prev line (so the visual order matches time order).
//   - If the playhead falls past the last line's end → fallback (don't silently
//     append at end-of-list which is non-visible).
//   - Untimed lines are skipped when computing neighbor ranges.
function decideAddInstancePlacement(
  lines: ReadonlyArray<LyricLine>,
  template: LineTemplate[],
  playheadTime: number,
): Placement {
  const duration = templateDuration(template);

  // Build a list of timed-line entries with their original list index, sorted by time
  const timed: Array<{ index: number; begin: number; end: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const range = lineTimeRange(lines[i]);
    if (!range) continue;
    timed.push({ index: i, begin: range.begin, end: range.end });
  }
  timed.sort((a, b) => a.begin - b.begin);

  // Empty project: insert at the start of the list, no gap constraint
  if (timed.length === 0) {
    return { kind: "insert", instanceStart: playheadTime, insertAtIndex: 0 };
  }

  // Playhead inside any existing line's time range → fallback
  for (const t of timed) {
    if (playheadTime >= t.begin && playheadTime <= t.end) {
      return { kind: "fallback", reason: "playhead-inside-line" };
    }
  }

  // Playhead past the last timed line's end → fallback (don't silently land at end-of-list)
  const lastTimed = timed[timed.length - 1];
  if (playheadTime > lastTimed.end) {
    return { kind: "fallback", reason: "past-last-line" };
  }

  // Playhead is in a gap. Find the gap's prev and next line entries.
  // prev = last timed line whose end <= playhead; next = first timed line whose begin >= playhead.
  let prev: { index: number; begin: number; end: number } | null = null;
  let next: { index: number; begin: number; end: number } | null = null;
  for (const t of timed) {
    if (t.end <= playheadTime) prev = t;
    if (t.begin >= playheadTime && next === null) {
      next = t;
      break;
    }
  }

  const gapEnd = next ? next.begin : Number.POSITIVE_INFINITY;
  const fitsInGap = playheadTime + duration <= gapEnd;
  if (!fitsInGap) {
    return { kind: "fallback", reason: "gap-too-small" };
  }

  // Insert after prev's list-position. If no prev (playhead before first line), insert at index 0.
  const insertAtIndex = prev !== null ? prev.index + 1 : 0;
  return { kind: "insert", instanceStart: playheadTime, insertAtIndex };
}

// -- Exports ------------------------------------------------------------------

export { decideAddInstancePlacement, templateDuration };
export type { Placement, PlacementInsert, PlacementFallback };
