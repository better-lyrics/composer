import { isLinked } from "@/domain/instance/predicates";
import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import type { WordSelection } from "@/domain/selection/model";
import type { RowLayout } from "@/views/timeline/utils";

// -- Types --------------------------------------------------------------------

interface RowSpan {
  top: number;
  height: number;
}

interface FollowViewport {
  height: number;
  coveredTop: number;
}

interface FollowMemory {
  selection: readonly WordSelection[] | null;
  selectedLineIds: ReadonlySet<string> | null;
  layout: RowLayout | null;
  viewportHeight: number;
  heldRows: RowSpan | null;
  rowKey: string | null;
}

interface FollowInput {
  lines: readonly LyricLine[];
  time: number;
  selection: readonly WordSelection[] | null;
  layout: RowLayout;
  collapsedInstances: Record<string, boolean>;
  viewport: FollowViewport;
}

interface FollowStep {
  memory: FollowMemory;
  rows: RowSpan | null;
}

// -- Constants ----------------------------------------------------------------

const IDLE_FOLLOW: FollowMemory = {
  selection: null,
  selectedLineIds: null,
  layout: null,
  viewportHeight: 0,
  heldRows: null,
  rowKey: null,
};

// -- Helpers ------------------------------------------------------------------

function collapsedInstanceKey(line: LyricLine, collapsedInstances: Record<string, boolean>): string | null {
  if (!isLinked(line)) return null;
  const key = `${line.groupId}:${line.instanceIdx}`;
  return collapsedInstances[key] ? key : null;
}

function rowOf(line: LyricLine, layout: RowLayout, collapsedInstances: Record<string, boolean>): RowSpan | undefined {
  const instanceKey = collapsedInstanceKey(line, collapsedInstances);
  return instanceKey ? layout.headerTops.get(instanceKey) : layout.lineTops.get(line.id);
}

function spanOfRows(
  lines: readonly LyricLine[],
  lineIds: ReadonlySet<string>,
  layout: RowLayout,
  collapsedInstances: Record<string, boolean>,
): RowSpan | null {
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const line of lines) {
    if (!lineIds.has(line.id)) continue;
    const row = rowOf(line, layout, collapsedInstances);
    if (!row) continue;
    top = Math.min(top, row.top);
    bottom = Math.max(bottom, row.top + row.height);
  }
  return bottom > top ? { top, height: bottom - top } : null;
}

function lineAt(lines: readonly LyricLine[], time: number, lineIds: ReadonlySet<string> | null): LyricLine | undefined {
  return lines.find((line) => {
    if (lineIds && !lineIds.has(line.id)) return false;
    const bounds = effectiveBounds(line);
    return bounds !== null && time >= bounds.begin && time < bounds.end;
  });
}

// -- Functions ----------------------------------------------------------------

function sameSpan(a: RowSpan | null, b: RowSpan | null): boolean {
  return a !== null && b !== null && a.top === b.top && a.height === b.height;
}

// A played selection is kept in view as a whole when it fits, so a loop never drags the view between its lines.
function followStep(memory: FollowMemory, input: FollowInput): FollowStep {
  const { lines, time, selection, layout, collapsedInstances, viewport } = input;
  let current = memory;

  if (selection !== memory.selection) {
    const selectedLineIds = selection ? new Set(selection.map((word) => word.lineId)) : null;
    current = { ...IDLE_FOLLOW, selection, selectedLineIds };
  }

  if (current.selectedLineIds && (layout !== current.layout || viewport.height !== current.viewportHeight)) {
    const span = spanOfRows(lines, current.selectedLineIds, layout, collapsedInstances);
    const heldRows = span && span.height <= viewport.height - viewport.coveredTop ? span : null;
    const previousHeld = current.heldRows;
    current = {
      ...current,
      layout,
      viewportHeight: viewport.height,
      heldRows,
      rowKey: heldRows ? null : current.rowKey,
    };
    if (heldRows) return { memory: current, rows: sameSpan(heldRows, previousHeld) ? null : heldRows };
    if (previousHeld) current = { ...current, rowKey: null };
  }

  if (current.heldRows) return { memory: current, rows: null };

  const line = lineAt(lines, time, current.selectedLineIds);
  if (!line) return { memory: current, rows: null };
  const rowKey = collapsedInstanceKey(line, collapsedInstances) ?? line.id;
  if (rowKey === current.rowKey) return { memory: current, rows: null };
  return { memory: { ...current, rowKey }, rows: rowOf(line, layout, collapsedInstances) ?? null };
}

// The sticky waveform covers the top of the scroll container, so rows are centered in the space below it.
function followScrollTop(rows: RowSpan, viewport: FollowViewport & { scrollHeight: number }): number {
  const centered = rows.top + rows.height / 2 - (viewport.coveredTop + viewport.height) / 2;
  return Math.max(0, Math.min(viewport.scrollHeight - viewport.height, centered));
}

// -- Exports ------------------------------------------------------------------

export { IDLE_FOLLOW, followScrollTop, followStep };
export type { FollowMemory };
