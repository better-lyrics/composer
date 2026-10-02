import {
  attachedLinesOfInstance,
  endsAfter,
  firstFullyTimedInstance,
  hasNegativeTime,
  instanceOffset,
  instanceStart,
  offsetTimingFields,
  sharedInstancesInLineOrder,
  sharesTiming,
} from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { applyLineUpdates } from "@/domain/line/apply-line-updates";
import { mainBounds } from "@/domain/line/bounds";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { isSyncableLine } from "@/domain/line/sync-progress";

// -- Types --------------------------------------------------------------------

type RealignRefusal = "no-fully-synced-instance" | "no-common-timed-line" | "before-song-start";

type Realignment = { updates: LineUpdate[] } | { refusal: RealignRefusal };

interface KeptOwnTiming {
  instanceIdx: number;
  refusal: RealignRefusal;
}

interface RealignedInstances {
  lines: LyricLine[];
  keptOwnTiming: KeptOwnTiming[];
}

// -- Helpers ------------------------------------------------------------------

function referenceInstance(lines: readonly LyricLine[], group: LinkGroup, excluding: number): number | null {
  const others = sharedInstancesInLineOrder(lines, group).filter((instanceIdx) => instanceIdx !== excluding);
  return firstFullyTimedInstance(lines, group.id, others) ?? null;
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
  return updates;
}

function startsBeforeSong(updates: readonly LineUpdate[]): boolean {
  return updates.some((update) => hasNegativeTime(update.updates));
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
  if (startsBeforeSong(updates)) return [];
  return updates.some((update) => endsAfter(update.updates, songEnd)) ? [] : updates;
}

// An instance with no timing has nothing to realign (no updates); a timed one that cannot take the shared timing is refused.
function realignSharedInstance(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  groupId: string,
  instanceIdx: number,
): Realignment {
  if (instanceStart(lines, groupId, instanceIdx) === null) return { updates: [] };
  const group = sharedGroup(groups, groupId, instanceIdx);
  const reference = group ? referenceInstance(lines, group, instanceIdx) : null;
  if (reference === null) return { refusal: "no-fully-synced-instance" };
  const offset = instanceOffset(lines, groupId, reference, instanceIdx);
  if (offset === null) return { refusal: "no-common-timed-line" };
  const updates = copyInstanceTiming(lines, groupId, reference, instanceIdx, offset);
  if (startsBeforeSong(updates)) return { refusal: "before-song-start" };
  return { updates };
}

function realignSharedInstances(
  lines: LyricLine[],
  groups: readonly LinkGroup[],
  groupId: string,
  instanceIdxs: readonly number[],
): RealignedInstances {
  let realigned = lines;
  const keptOwnTiming: KeptOwnTiming[] = [];
  for (const instanceIdx of instanceIdxs) {
    const realignment = realignSharedInstance(realigned, groups, groupId, instanceIdx);
    if ("refusal" in realignment) keptOwnTiming.push({ instanceIdx, refusal: realignment.refusal });
    else if (realignment.updates.length) realigned = applyLineUpdates(realigned, realignment.updates);
  }
  return { lines: realigned, keptOwnTiming };
}

// -- Exports ------------------------------------------------------------------

export { placeSharedInstance, realignSharedInstance, realignSharedInstances };
export type { KeptOwnTiming, RealignRefusal };
