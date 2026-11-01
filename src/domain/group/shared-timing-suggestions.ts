import { initialGroupSharing } from "@/domain/group/initial-sharing";
import {
  attachedLinesOfInstance,
  firstFullyTimedInstance,
  instanceStart,
  instancesInLineOrder,
} from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { instanceName } from "@/domain/instance/name";
import type { LyricLine } from "@/domain/line/model";

// -- Types --------------------------------------------------------------------

interface SharedTimingSuggestion {
  fingerprint: string;
  groupId: string;
  label: string;
  sourceName: string;
  changingCount: number;
  replacedCount: number;
}

// -- Functions ----------------------------------------------------------------

function sharedTimingSuggestion(lines: LyricLine[], group: LinkGroup, songEnd: number): SharedTimingSuggestion | null {
  if (group.sharesTiming) return null;
  const order = instancesInLineOrder(lines, group.id);
  const source = firstFullyTimedInstance(lines, group.id, order);
  if (source === undefined) return null;
  const untimedCount = order.filter((instanceIdx) => instanceStart(lines, group.id, instanceIdx) === null).length;
  if (untimedCount === 0) return null;
  const sharing = initialGroupSharing(lines, group, true, songEnd);
  const changedIds = new Set(sharing.lines.filter((line, index) => line !== lines[index]).map((line) => line.id));
  const writtenCount = order.filter((instanceIdx) =>
    attachedLinesOfInstance(lines, group.id, instanceIdx).some((line) => changedIds.has(line.id)),
  ).length;
  const replacedCount = sharing.replaced.length;
  return {
    fingerprint: `shared-timing:${group.id}`,
    groupId: group.id,
    label: group.label,
    sourceName: instanceName(lines, group, source),
    changingCount: untimedCount + writtenCount,
    replacedCount,
  };
}

function sharedTimingSuggestions(
  lines: LyricLine[],
  groups: readonly LinkGroup[],
  songEnd = Number.POSITIVE_INFINITY,
): SharedTimingSuggestion[] {
  return groups.flatMap((group) => sharedTimingSuggestion(lines, group, songEnd) ?? []);
}

// -- Exports ------------------------------------------------------------------

export { sharedTimingSuggestions };
export type { SharedTimingSuggestion };
