import { firstFullyTimedInstance, sharedInstancesInLineOrder } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { instanceKey } from "@/domain/instance/key";
import { instanceName } from "@/domain/instance/name";
import type { LyricLine } from "@/domain/line/model";
import { stepSkippedLineIds } from "@/domain/step-timing/step-skip";
import { skippedSharedInstances } from "@/domain/sync/skipped-instances";

// -- Types --------------------------------------------------------------------

interface StepSkipView {
  skippedLineIds: Set<string>;
  // Keyed by instanceKey: the name of the copy a skipped shared repeat follows.
  follows: Map<string, string>;
}

// -- Functions ----------------------------------------------------------------

function stepSkipView(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  collapsedInstances: Readonly<Record<string, boolean>>,
  cursorLine: LyricLine | null,
): StepSkipView {
  const isCollapsed = (groupId: string, instanceIdx: number) =>
    collapsedInstances[instanceKey(groupId, instanceIdx)] ?? false;
  const skippedLineIds = stepSkippedLineIds(lines, groups, isCollapsed, cursorLine);
  const follows = new Map<string, string>();
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  for (const skipped of skippedSharedInstances(lines, groups)) {
    const group = groupsById.get(skipped.groupId);
    if (!group || !skipped.lineIds.some((id) => skippedLineIds.has(id))) continue;
    const source = firstFullyTimedInstance(lines, group.id, sharedInstancesInLineOrder(lines, group));
    if (source !== undefined)
      follows.set(instanceKey(group.id, skipped.instanceIdx), instanceName(lines, group, source));
  }
  return { skippedLineIds, follows };
}

// -- Exports ------------------------------------------------------------------

export type { StepSkipView };
export { stepSkipView };
