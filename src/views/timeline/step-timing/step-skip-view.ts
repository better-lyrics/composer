import { firstFullyTimedInstance, sharedInstancesInLineOrder } from "insync/group-shared-timing";
import type { LinkGroup } from "insync/group";
import { instanceKey } from "insync/instance-key";
import { instanceName } from "insync/instance-name";
import { drawnLine } from "insync/line-drawn-track";
import type { LyricLine } from "insync/line";
import { stepSkippedLineIds } from "@/domain/step-timing/step-skip";
import { skippedSharedInstances } from "insync/sync-skipped-instances";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

interface StepSkipView {
  skippedLineIds: Set<string>;
  // Keyed by instanceKey: the name of the copy a skipped shared repeat follows.
  follows: Map<string, string>;
}

// -- Functions ----------------------------------------------------------------

function stepSkipView(
  storedLines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  collapsedInstances: Readonly<Record<string, boolean>>,
  cursorLine: LyricLine | null,
): StepSkipView {
  const lines = storedLines.map((value) => drawnLine(value, getSplitCharacter()));
  const isCollapsed = (groupId: string, instanceIdx: number) =>
    collapsedInstances[instanceKey(groupId, instanceIdx)] ?? false;
  const skippedLineIds = stepSkippedLineIds(lines, groups, isCollapsed, cursorLine, getSplitCharacter());
  const follows = new Map<string, string>();
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  for (const skipped of skippedSharedInstances(lines, groups, getSplitCharacter())) {
    const group = groupsById.get(skipped.groupId);
    if (!group || !skipped.lineIds.some((id) => skippedLineIds.has(id))) continue;
    const source = firstFullyTimedInstance(
      lines,
      group.id,
      sharedInstancesInLineOrder(lines, group),
      getSplitCharacter(),
    );
    if (source !== undefined)
      follows.set(instanceKey(group.id, skipped.instanceIdx), instanceName(lines, group, source));
  }
  return { skippedLineIds, follows };
}

// -- Exports ------------------------------------------------------------------

export type { StepSkipView };
export { stepSkipView };
