import type { LinkGroup } from "@/domain/group/template";
import { belongsToInstance, isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import { skippedSharedInstances } from "@/domain/sync/skipped-instances";

// -- Types --------------------------------------------------------------------

type InstanceCollapsed = (groupId: string, instanceIdx: number) => boolean;

// -- Functions ----------------------------------------------------------------

// Lines the timing keys walk past: shared repeats that follow a timed copy, as in Sync, and collapsed groups.
// The instance the cursor is in is always walked, so a word clicked there can be retimed in place.
function stepSkippedLineIds(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  isCollapsed: InstanceCollapsed,
  cursorLine: LyricLine | null,
): Set<string> {
  const inCursorInstance = (line: LyricLine) =>
    cursorLine !== null && isLinked(cursorLine) && belongsToInstance(line, cursorLine.groupId, cursorLine.instanceIdx);
  const shared = skippedSharedInstances(lines, groups).flatMap((instance) => instance.lineIds);
  const collapsed = lines.filter((line) => isLinked(line) && isCollapsed(line.groupId, line.instanceIdx));
  const skipped = new Set([...shared, ...collapsed.map((line) => line.id)]);
  for (const line of lines) if (inCursorInstance(line)) skipped.delete(line.id);
  return skipped;
}

// -- Exports ------------------------------------------------------------------

export type { InstanceCollapsed };
export { stepSkippedLineIds };
