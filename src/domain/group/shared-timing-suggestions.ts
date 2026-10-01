import { instanceStart, instancesInLineOrder, isInstanceFullyTimed } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { instanceName } from "@/domain/instance/name";
import type { LyricLine } from "@/domain/line/model";

// -- Types --------------------------------------------------------------------

interface SharedTimingSuggestion {
  fingerprint: string;
  groupId: string;
  label: string;
  sourceName: string;
  untimedCount: number;
}

// -- Functions ----------------------------------------------------------------

function sharedTimingSuggestion(lines: readonly LyricLine[], group: LinkGroup): SharedTimingSuggestion | null {
  if (group.sharesTiming) return null;
  const order = instancesInLineOrder(lines, group.id);
  const source = order.find((instanceIdx) => isInstanceFullyTimed(lines, group.id, instanceIdx));
  if (source === undefined) return null;
  const untimedCount = order.filter((instanceIdx) => instanceStart(lines, group.id, instanceIdx) === null).length;
  if (untimedCount === 0) return null;
  return {
    fingerprint: `shared-timing:${group.id}`,
    groupId: group.id,
    label: group.label,
    sourceName: instanceName(lines, group, source),
    untimedCount,
  };
}

function sharedTimingSuggestions(lines: readonly LyricLine[], groups: readonly LinkGroup[]): SharedTimingSuggestion[] {
  return groups.flatMap((group) => sharedTimingSuggestion(lines, group) ?? []);
}

// -- Exports ------------------------------------------------------------------

export { sharedTimingSuggestions };
export type { SharedTimingSuggestion };
