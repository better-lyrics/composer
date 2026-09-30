import type { LinkGroup } from "@/domain/group/template";
import { isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";

// -- Predicates ---------------------------------------------------------------

function sharesTiming(group: LinkGroup | undefined, instanceIdx: number | undefined): boolean {
  if (!group?.sharesTiming || instanceIdx === undefined) return false;
  return !group.ownTimingInstances?.includes(instanceIdx);
}

function isSharedLine(line: LyricLine, groupsById: ReadonlyMap<string, LinkGroup>): boolean {
  return isLinked(line) && !line.detached && sharesTiming(groupsById.get(line.groupId), line.instanceIdx);
}

// -- Instances ----------------------------------------------------------------

function sharedInstancesInLineOrder(lines: readonly LyricLine[], group: LinkGroup): number[] {
  const order: number[] = [];
  for (const line of lines) {
    if (line.groupId !== group.id || line.detached || line.instanceIdx === undefined) continue;
    if (!sharesTiming(group, line.instanceIdx) || order.includes(line.instanceIdx)) continue;
    order.push(line.instanceIdx);
  }
  return order;
}

// -- Exports ------------------------------------------------------------------

export { isSharedLine, sharedInstancesInLineOrder, sharesTiming };
