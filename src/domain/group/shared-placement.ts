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
import { isWordSynced } from "@/domain/line/predicates";
import { isSyncableLine } from "@/domain/line/sync-progress";

// -- Types --------------------------------------------------------------------

type RealignRefusal =
  | "no-fully-synced-instance"
  | "no-common-timed-line"
  | "before-song-start"
  | "past-song-end"
  | "would-lose-word-timing";

type Realignment = { updates: LineUpdate[] } | { refusal: RealignRefusal };

interface KeptOwnTiming {
  instanceIdx: number;
  refusal: RealignRefusal;
}

interface SharingOutcome {
  keptOwnTiming: KeptOwnTiming[];
  realigned: number[];
}

interface RealignedInstances extends SharingOutcome {
  lines: LyricLine[];
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

function dropsWordTiming(lines: readonly LyricLine[], updates: readonly LineUpdate[]): boolean {
  const byId = new Map(lines.map((line) => [line.id, line]));
  return updates.some(({ id, updates: copied }) => {
    const target = byId.get(id);
    if (!target) return false;
    const dropsMain = isWordSynced(target) && !copied.words?.length;
    return dropsMain || (!!target.backgroundWords?.length && !copied.backgroundWords?.length);
  });
}

function runsPastSong(updates: readonly LineUpdate[], songEnd: number): boolean {
  return updates.some((update) => endsAfter(update.updates, songEnd));
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
  return startsBeforeSong(updates) || runsPastSong(updates, songEnd) ? [] : updates;
}

// An instance with no timing has nothing to realign (no updates); a timed one that cannot take the shared timing is refused.
function realignSharedInstance(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  groupId: string,
  instanceIdx: number,
  songEnd = Number.POSITIVE_INFINITY,
): Realignment {
  if (instanceStart(lines, groupId, instanceIdx) === null) return { updates: [] };
  const group = sharedGroup(groups, groupId, instanceIdx);
  const reference = group ? referenceInstance(lines, group, instanceIdx) : null;
  if (reference === null) return { refusal: "no-fully-synced-instance" };
  const offset = instanceOffset(lines, groupId, reference, instanceIdx);
  if (offset === null) return { refusal: "no-common-timed-line" };
  const updates = copyInstanceTiming(lines, groupId, reference, instanceIdx, offset);
  if (dropsWordTiming(attachedLinesOfInstance(lines, groupId, instanceIdx), updates)) {
    return { refusal: "would-lose-word-timing" };
  }
  if (startsBeforeSong(updates)) return { refusal: "before-song-start" };
  if (runsPastSong(updates, songEnd)) return { refusal: "past-song-end" };
  return { updates };
}

function realignSharedInstances(
  lines: LyricLine[],
  groups: readonly LinkGroup[],
  groupId: string,
  instanceIdxs: readonly number[],
  songEnd = Number.POSITIVE_INFINITY,
): RealignedInstances {
  let nextLines = lines;
  const keptOwnTiming: KeptOwnTiming[] = [];
  const realigned: number[] = [];
  for (const instanceIdx of instanceIdxs) {
    const realignment = realignSharedInstance(nextLines, groups, groupId, instanceIdx, songEnd);
    if ("refusal" in realignment) keptOwnTiming.push({ instanceIdx, refusal: realignment.refusal });
    else if (realignment.updates.length) {
      nextLines = applyLineUpdates(nextLines, realignment.updates);
      realigned.push(instanceIdx);
    }
  }
  return { lines: nextLines, keptOwnTiming, realigned };
}

// -- Exports ------------------------------------------------------------------

export { placeSharedInstance, realignSharedInstance, realignSharedInstances };
export type { KeptOwnTiming, RealignRefusal, SharingOutcome };
