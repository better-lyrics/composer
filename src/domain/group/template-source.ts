import { firstFullyTimedInstance, sharedInstancesInLineOrder, sharesTiming } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";

// -- Functions ----------------------------------------------------------------

function templateSourceInstance(lines: readonly LyricLine[], group: LinkGroup | undefined, fallback: number): number {
  if (!group?.sharesTiming) return fallback;
  const shared = sharedInstancesInLineOrder(lines, group);
  return firstFullyTimedInstance(lines, group.id, shared) ?? shared[0] ?? fallback;
}

function pickedTemplateSource(lines: readonly LyricLine[], group: LinkGroup | undefined, picked: number): number {
  if (!group?.sharesTiming || sharesTiming(group, picked)) return picked;
  return templateSourceInstance(lines, group, picked);
}

// -- Exports ------------------------------------------------------------------

export { pickedTemplateSource, templateSourceInstance };
