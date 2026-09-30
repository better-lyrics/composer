import {
  attachedLinesOfInstance,
  endsAfter,
  hasNegativeTime,
  instanceOffset,
  isInstanceFullyTimed,
  offsetTimingFields,
  sharedInstancesInLineOrder,
  sharesTiming,
} from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { mainBounds } from "@/domain/line/bounds";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { isSyncableLine } from "@/domain/line/sync-progress";

// -- Helpers ------------------------------------------------------------------

function referenceInstance(lines: readonly LyricLine[], group: LinkGroup, excluding: number): number | null {
  const reference = sharedInstancesInLineOrder(lines, group).find(
    (instanceIdx) => instanceIdx !== excluding && isInstanceFullyTimed(lines, group.id, instanceIdx),
  );
  return reference ?? null;
}

function sharedGroup(groups: readonly LinkGroup[], groupId: string, instanceIdx: number): LinkGroup | null {
  const group = groups.find((candidate) => candidate.id === groupId);
  return group && sharesTiming(group, instanceIdx) ? group : null;
}

function copyInstanceTiming(
  lines: readonly LyricLine[],
  groupId: string,
  fromIdx: number,
  toIdx: number,
  offset: number,
): LineUpdate[] {
  const sourceByTemplateLine = new Map(
    attachedLinesOfInstance(lines, groupId, fromIdx).map((line) => [line.templateLineIdx, line]),
  );
  const updates = attachedLinesOfInstance(lines, groupId, toIdx).flatMap((target) => {
    const source = sourceByTemplateLine.get(target.templateLineIdx);
    return source ? [{ id: target.id, updates: offsetTimingFields(source, offset) }] : [];
  });
  return updates.some((update) => hasNegativeTime(update.updates)) ? [] : updates;
}

// -- Placing ------------------------------------------------------------------

// `anchorTime` is where the main vocal of the instance's first syncable line begins, the word a sync tap lands on.
function placeSharedInstance(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  groupId: string,
  instanceIdx: number,
  anchorTime: number,
  songEnd = Number.POSITIVE_INFINITY,
): LineUpdate[] {
  const group = sharedGroup(groups, groupId, instanceIdx);
  const reference = group ? referenceInstance(lines, group, instanceIdx) : null;
  if (reference === null) return [];
  const anchorLine = attachedLinesOfInstance(lines, groupId, instanceIdx).find(isSyncableLine);
  const referenceLine = attachedLinesOfInstance(lines, groupId, reference).find(
    (line) => line.templateLineIdx === anchorLine?.templateLineIdx,
  );
  const referenceTime = referenceLine ? mainBounds(referenceLine)?.begin : undefined;
  if (referenceTime === undefined) return [];
  const updates = copyInstanceTiming(lines, groupId, reference, instanceIdx, anchorTime - referenceTime);
  return updates.some((update) => endsAfter(update.updates, songEnd)) ? [] : updates;
}

function realignSharedInstance(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  groupId: string,
  instanceIdx: number,
): LineUpdate[] {
  const group = sharedGroup(groups, groupId, instanceIdx);
  const reference = group ? referenceInstance(lines, group, instanceIdx) : null;
  const offset = reference === null ? null : instanceOffset(lines, groupId, reference, instanceIdx);
  if (reference === null || offset === null) return [];
  return copyInstanceTiming(lines, groupId, reference, instanceIdx, offset);
}

// -- Exports ------------------------------------------------------------------

export { placeSharedInstance, realignSharedInstance };
