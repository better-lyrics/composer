import type { LinkGroup } from "insync/group";
import { instanceBounds } from "insync/instance-bounds";
import { instanceKey } from "insync/instance-key";
import { isAttachedToInstance, isLinked } from "insync/instance-predicates";
import { bgBounds, mainBounds } from "insync/line-bounds";
import type { LyricLine } from "insync/line";
import { isWordSynced } from "insync/line-predicates";
import { roleWords } from "insync/line-track";
import { isLineFullyTimed, isSyncableLine } from "@/domain/line/sync-progress";
import { withoutWordIds } from "insync/word-id";
import { isStructurallyEqual } from "insync/structural-equal";
import { songEndOrUnbounded } from "@/utils/timing/song-end";

// -- Types --------------------------------------------------------------------

interface TimeRange {
  min: number;
  max: number;
}

// -- Constants ----------------------------------------------------------------

const UNBOUNDED_TIME_RANGE: TimeRange = { min: 0, max: Number.POSITIVE_INFINITY };

// -- Predicates ---------------------------------------------------------------

function sharesTiming(group: LinkGroup | undefined, instanceIdx: number | undefined): boolean {
  if (!group?.sharesTiming || instanceIdx === undefined) return false;
  return !group.ownTimingInstances?.includes(instanceIdx);
}

function keepsOwnTiming(group: LinkGroup, instanceIdx: number): boolean {
  return group.sharesTiming === true && !sharesTiming(group, instanceIdx);
}

function isSharedLine(line: LyricLine, groupsById: ReadonlyMap<string, LinkGroup>): boolean {
  return isLinked(line) && !line.detached && sharesTiming(groupsById.get(line.groupId), line.instanceIdx);
}

// -- Instances ----------------------------------------------------------------

function instancesInLineOrder(lines: readonly LyricLine[], groupId: string): number[] {
  const order = new Set<number>();
  for (const line of lines) {
    if (isLinked(line) && line.groupId === groupId && !line.detached) order.add(line.instanceIdx);
  }
  return [...order];
}

function sharedInstancesInLineOrder(lines: readonly LyricLine[], group: LinkGroup): number[] {
  return instancesInLineOrder(lines, group.id).filter((instanceIdx) => sharesTiming(group, instanceIdx));
}

function attachedLinesOfInstance(lines: readonly LyricLine[], groupId: string, instanceIdx: number): LyricLine[] {
  return lines.filter((line) => isAttachedToInstance(line, groupId, instanceIdx));
}

function instanceStart(lines: readonly LyricLine[], groupId: string, instanceIdx: number): number | null {
  return instanceBounds(attachedLinesOfInstance(lines, groupId, instanceIdx))?.begin ?? null;
}

function isInstanceFullyTimed(
  lines: readonly LyricLine[],
  groupId: string,
  instanceIdx: number,
  splitChar: string,
): boolean {
  const syncable = attachedLinesOfInstance(lines, groupId, instanceIdx).filter((value) =>
    isSyncableLine(value, splitChar),
  );
  return syncable.length > 0 && syncable.every((value) => isLineFullyTimed(value, splitChar));
}

function isInstanceWordSynced(
  lines: readonly LyricLine[],
  groupId: string,
  instanceIdx: number,
  splitChar: string,
): boolean {
  return attachedLinesOfInstance(lines, groupId, instanceIdx)
    .filter((value) => isSyncableLine(value, splitChar))
    .every(isWordSynced);
}

// The instance that holds the timing to copy from: the first fully timed one among the candidates, preferring one synced
// word by word so copying never drops word timing.
function firstFullyTimedInstance(
  lines: readonly LyricLine[],
  groupId: string,
  candidates: readonly number[],
  splitChar: string,
): number | undefined {
  const fullyTimed = candidates.filter((instanceIdx) => isInstanceFullyTimed(lines, groupId, instanceIdx, splitChar));
  return (
    fullyTimed.find((instanceIdx) => isInstanceWordSynced(lines, groupId, instanceIdx, splitChar)) ?? fullyTimed[0]
  );
}

// Offset between two instances, measured only over template lines timed in both, so a line missing from one
// instance never shifts the anchor.
function instanceOffset(lines: readonly LyricLine[], groupId: string, from: number, to: number): number | null {
  const toByTemplateLine = new Map(
    attachedLinesOfInstance(lines, groupId, to).map((line) => [line.templateLineIdx, line]),
  );
  const fromCommon: LyricLine[] = [];
  const toCommon: LyricLine[] = [];
  for (const line of attachedLinesOfInstance(lines, groupId, from)) {
    const match = toByTemplateLine.get(line.templateLineIdx);
    if (!match || !instanceBounds([line]) || !instanceBounds([match])) continue;
    fromCommon.push(line);
    toCommon.push(match);
  }
  const fromStart = instanceBounds(fromCommon)?.begin;
  const toStart = instanceBounds(toCommon)?.begin;
  return fromStart === undefined || toStart === undefined ? null : toStart - fromStart;
}

// -- Timing -------------------------------------------------------------------

function timingChanged(before: LyricLine | undefined, after: LyricLine): boolean {
  if (!before) return false;
  return (
    !isStructurallyEqual(mainBounds(before), mainBounds(after)) ||
    !isStructurallyEqual(bgBounds(before), bgBounds(after)) ||
    !isStructurallyEqual(withoutWordIds(roleWords(before, "main")), withoutWordIds(roleWords(after, "main"))) ||
    !isStructurallyEqual(withoutWordIds(roleWords(before, "bg")), withoutWordIds(roleWords(after, "bg")))
  );
}

// -- Time range ---------------------------------------------------------------

function sharedTimeRange(
  lines: readonly LyricLine[],
  group: LinkGroup,
  instanceIdx: number,
  duration: number,
): TimeRange {
  const range = { min: 0, max: duration };
  for (const otherIdx of sharedInstancesInLineOrder(lines, group)) {
    const offset = otherIdx === instanceIdx ? null : instanceOffset(lines, group.id, instanceIdx, otherIdx);
    if (offset === null) continue;
    range.min = Math.max(range.min, -offset);
    range.max = Math.min(range.max, duration - offset);
  }
  return range;
}

function wholeSongRange(duration: number): TimeRange {
  return { min: 0, max: songEndOrUnbounded(duration) };
}

function timeRangeResolver(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  duration: number,
): (line: LyricLine) => TimeRange {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const rangeByInstance = new Map<string, TimeRange>();
  const wholeSong = wholeSongRange(duration);
  return (line) => {
    if (!isLinked(line) || !isSharedLine(line, groupsById)) return wholeSong;
    const key = instanceKey(line.groupId, line.instanceIdx);
    let range = rangeByInstance.get(key);
    const group = groupsById.get(line.groupId);
    if (!range && group) {
      range = sharedTimeRange(lines, group, line.instanceIdx, wholeSong.max);
      rangeByInstance.set(key, range);
    }
    return range ?? wholeSong;
  };
}

// -- Exports ------------------------------------------------------------------

export {
  attachedLinesOfInstance,
  firstFullyTimedInstance,
  instanceOffset,
  instanceStart,
  instancesInLineOrder,
  isInstanceFullyTimed,
  isSharedLine,
  keepsOwnTiming,
  sharedInstancesInLineOrder,
  sharesTiming,
  timeRangeResolver,
  timingChanged,
  UNBOUNDED_TIME_RANGE,
  wholeSongRange,
};
export type { TimeRange };
