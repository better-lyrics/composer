import { firstFullyTimedInstance, sharedInstancesInLineOrder, sharesTiming } from "./group-shared-timing";
import type { LinkGroup } from "./group";
import type { LyricLine } from "./line";

// -- Functions ----------------------------------------------------------------

function templateSourceInstance(
  lines: readonly LyricLine[],
  group: LinkGroup | undefined,
  fallback: number,
  splitChar: string,
): number {
  if (!group?.sharesTiming) return fallback;
  const shared = sharedInstancesInLineOrder(lines, group);
  return firstFullyTimedInstance(lines, group.id, shared, splitChar) ?? shared[0] ?? fallback;
}

function pickedTemplateSource(
  lines: readonly LyricLine[],
  group: LinkGroup | undefined,
  picked: number,
  splitChar: string,
): number {
  if (!group?.sharesTiming || sharesTiming(group, picked)) return picked;
  return templateSourceInstance(lines, group, picked, splitChar);
}

// -- Exports ------------------------------------------------------------------

export { pickedTemplateSource, templateSourceInstance };
