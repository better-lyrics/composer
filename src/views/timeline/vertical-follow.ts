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

interface FollowMemory {
  selection: readonly WordSelection[] | null;
  selectedLineIds: ReadonlySet<string> | null;
  layout: RowLayout | null;
  viewportHeight: number;
  heldRows: RowSpan | null;
  lineId: string | null;
  lineLayout: RowLayout | null;
  rowKey: string | null;
}

interface FollowInput {
  lines: readonly LyricLine[];
  time: number;
  selection: readonly WordSelection[] | null;
  layout: RowLayout;
  collapsedInstances: Record<string, boolean>;
  viewportHeight: number;
  coveredTop: number;
}

// -- Constants ----------------------------------------------------------------

const IDLE_FOLLOW: Readonly<FollowMemory> = {
  selection: null,
  selectedLineIds: null,
  layout: null,
  viewportHeight: 0,
  heldRows: null,
  lineId: null,
  lineLayout: null,
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

function lineAt(lines: readonly LyricLine[], time: number, lineIds: ReadonlySet<string> | null): LyricLine | null {
  for (const line of lines) {
    if (lineIds && !lineIds.has(line.id)) continue;
    const bounds = effectiveBounds(line);
    if (bounds !== null && time >= bounds.begin && time < bounds.end) return line;
  }
  return null;
}

function sameSpan(a: RowSpan | null, b: RowSpan | null): boolean {
  return a !== null && b !== null && a.top === b.top && a.height === b.height;
}

// -- Functions ----------------------------------------------------------------

function createFollowMemory(): FollowMemory {
  return { ...IDLE_FOLLOW };
}

function resetFollowMemory(memory: FollowMemory): void {
  Object.assign(memory, IDLE_FOLLOW);
}

function recheckSelection(memory: FollowMemory, input: FollowInput, selectedLineIds: ReadonlySet<string>) {
  const span = spanOfRows(input.lines, selectedLineIds, input.layout, input.collapsedInstances);
  const fits = span !== null && span.height <= input.viewportHeight - input.coveredTop;
  const unchanged = sameSpan(span, memory.heldRows) && input.viewportHeight === memory.viewportHeight;
  const wasHeld = memory.heldRows !== null;
  memory.layout = input.layout;
  memory.viewportHeight = input.viewportHeight;
  memory.heldRows = fits ? span : null;
  if (fits || wasHeld) {
    memory.lineId = null;
    memory.rowKey = null;
  }
  return fits && !unchanged ? span : null;
}

// Runs every playback frame and allocates only when the followed rows change.
// A played selection is kept in view as a whole when it fits, so a loop never drags the view between its lines.
function followStep(memory: FollowMemory, input: FollowInput): RowSpan | null {
  if (input.selection !== memory.selection) {
    resetFollowMemory(memory);
    memory.selection = input.selection;
    memory.selectedLineIds = input.selection ? new Set(input.selection.map((word) => word.lineId)) : null;
  }

  const selectedLineIds = memory.selectedLineIds;
  if (selectedLineIds && (input.layout !== memory.layout || input.viewportHeight !== memory.viewportHeight)) {
    const rows = recheckSelection(memory, input, selectedLineIds);
    if (memory.heldRows) return rows;
  }
  if (memory.heldRows) return null;

  const line = lineAt(input.lines, input.time, selectedLineIds);
  if (!line || (line.id === memory.lineId && input.layout === memory.lineLayout)) return null;
  memory.lineId = line.id;
  memory.lineLayout = input.layout;
  const rowKey = collapsedInstanceKey(line, input.collapsedInstances) ?? line.id;
  if (rowKey === memory.rowKey) return null;
  memory.rowKey = rowKey;
  return rowOf(line, input.layout, input.collapsedInstances) ?? null;
}

// The sticky waveform covers the top of the scroll container, so rows are centered in the space below it.
function followScrollTop(rows: RowSpan, input: FollowInput, scrollHeight: number): number {
  const centered = rows.top + rows.height / 2 - (input.coveredTop + input.viewportHeight) / 2;
  return Math.max(0, Math.min(scrollHeight - input.viewportHeight, centered));
}

// -- Exports ------------------------------------------------------------------

export { createFollowMemory, followScrollTop, followStep, resetFollowMemory };
export type { FollowInput, FollowMemory };
