import { isInstanceFullyTimed, sharedInstancesInLineOrder } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";

// -- Functions ----------------------------------------------------------------

function templateSourceInstance(lines: readonly LyricLine[], group: LinkGroup | undefined, fallback: number): number {
  if (!group?.sharesTiming) return fallback;
  const shared = sharedInstancesInLineOrder(lines, group);
  return shared.find((instanceIdx) => isInstanceFullyTimed(lines, group.id, instanceIdx)) ?? shared[0] ?? fallback;
}

// -- Exports ------------------------------------------------------------------

export { templateSourceInstance };
