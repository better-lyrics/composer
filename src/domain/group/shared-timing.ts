import type { LinkGroup } from "@/domain/group/template";
import { instanceBounds } from "@/domain/instance/bounds";
import { linesOfInstance } from "@/domain/instance/enumerate";
import { type LinkedLine, isLinked } from "@/domain/instance/predicates";
import { type LineUpdate, type LyricLine, reconcileLine } from "@/domain/line/model";
import { isLineFullyTimed, isSyncableLine } from "@/domain/line/sync-progress";
import type { WordTiming } from "@/domain/word/timing";
import { isStructurallyEqual } from "@/utils/structural-equal";

// -- Types --------------------------------------------------------------------

interface SharedTimingFanOut {
  lines: LyricLine[];
  rejected: boolean;
  touchedGroupIds: string[];
}

interface TimeRange {
  min: number;
  max: number;
}

interface FanOutSource {
  line: LinkedLine;
  group: LinkGroup;
  instanceOrder: number[];
}

// -- Constants ----------------------------------------------------------------

const UNBOUNDED_TIME_RANGE: TimeRange = { min: 0, max: Number.POSITIVE_INFINITY };

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
  const order = new Set<number>();
  for (const line of lines) {
    if (line.groupId !== group.id || line.detached || line.instanceIdx === undefined) continue;
    if (sharesTiming(group, line.instanceIdx)) order.add(line.instanceIdx);
  }
  return [...order];
}

function attachedLinesOfInstance(lines: readonly LyricLine[], groupId: string, instanceIdx: number): LyricLine[] {
  return linesOfInstance(lines, groupId, instanceIdx).filter((line) => !line.detached);
}

function instanceStart(lines: readonly LyricLine[], groupId: string, instanceIdx: number): number | null {
  return instanceBounds(attachedLinesOfInstance(lines, groupId, instanceIdx))?.begin ?? null;
}

function isInstanceFullyTimed(lines: readonly LyricLine[], groupId: string, instanceIdx: number): boolean {
  const syncable = attachedLinesOfInstance(lines, groupId, instanceIdx).filter(isSyncableLine);
  return syncable.length > 0 && syncable.every(isLineFullyTimed);
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

// -- Timing fields ------------------------------------------------------------

function offsetWords(words: readonly WordTiming[] | undefined, offset: number): WordTiming[] | undefined {
  return words?.map((word) => ({ ...word, begin: word.begin + offset, end: word.end + offset }));
}

function offsetTimingFields(source: LyricLine, offset: number): LineUpdate["updates"] {
  const backgroundWords = offsetWords(source.backgroundWords, offset);
  if (source.words)
    return { words: offsetWords(source.words, offset), backgroundWords, begin: undefined, end: undefined };
  if (source.begin !== undefined) {
    return { begin: source.begin + offset, end: source.end + offset, backgroundWords, words: undefined };
  }
  return { words: undefined, begin: undefined, end: undefined, backgroundWords };
}

// -- Fan out ------------------------------------------------------------------

function timingChanged(before: LyricLine | undefined, after: LyricLine): boolean {
  if (!before) return false;
  return (
    before.begin !== after.begin ||
    before.end !== after.end ||
    !isStructurallyEqual(before.words, after.words) ||
    !isStructurallyEqual(before.backgroundWords, after.backgroundWords)
  );
}

function hasNegativeTime(updates: LineUpdate["updates"]): boolean {
  if (updates.begin !== undefined && updates.begin < 0) return true;
  return [...(updates.words ?? []), ...(updates.backgroundWords ?? [])].some((word) => word.begin < 0);
}

function endsAfter(updates: LineUpdate["updates"], songEnd: number): boolean {
  if (updates.end !== undefined && updates.end > songEnd) return true;
  return [...(updates.words ?? []), ...(updates.backgroundWords ?? [])].some((word) => word.end > songEnd);
}

function fanOutSources(
  before: readonly LyricLine[],
  after: readonly LyricLine[],
  groups: readonly LinkGroup[],
  changedIds: readonly string[],
): FanOutSource[] {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const beforeById = new Map(before.map((line) => [line.id, line]));
  const afterById = new Map(after.map((line) => [line.id, line]));
  const instanceOrderByGroup = new Map<string, number[]>();
  const sources: FanOutSource[] = [];
  for (const id of new Set(changedIds)) {
    const line = afterById.get(id);
    if (!line || !isLinked(line) || line.detached || !timingChanged(beforeById.get(id), line)) continue;
    const group = groupsById.get(line.groupId);
    if (!group || !sharesTiming(group, line.instanceIdx)) continue;
    let instanceOrder = instanceOrderByGroup.get(group.id);
    if (!instanceOrder) {
      instanceOrder = sharedInstancesInLineOrder(before, group);
      instanceOrderByGroup.set(group.id, instanceOrder);
    }
    sources.push({ line, group, instanceOrder });
  }
  return sources.toSorted(
    (a, b) => a.instanceOrder.indexOf(a.line.instanceIdx) - b.instanceOrder.indexOf(b.line.instanceIdx),
  );
}

function sharedTimingFanOut(
  before: readonly LyricLine[],
  after: LyricLine[],
  groups: readonly LinkGroup[],
  changedIds: readonly string[],
): SharedTimingFanOut {
  const unchanged: SharedTimingFanOut = { lines: after, rejected: false, touchedGroupIds: [] };
  if (!groups.some((group) => group.sharesTiming)) return unchanged;
  const sources = fanOutSources(before, after, groups, changedIds);
  if (sources.length === 0) return unchanged;

  const indexById = new Map(after.map((line, index) => [line.id, index]));
  const claimedTemplateLines = new Set<string>();
  const touchedGroupIds = new Set<string>();
  const offsets = new Map<string, number | null>();
  const offsetBefore = (groupId: string, from: number, to: number) => {
    const key = `${groupId}:${from}:${to}`;
    if (!offsets.has(key)) offsets.set(key, instanceOffset(before, groupId, from, to));
    return offsets.get(key) ?? null;
  };
  let lines = after;

  for (const { line: source, group, instanceOrder } of sources) {
    const claimKey = `${group.id}:${source.templateLineIdx}`;
    if (claimedTemplateLines.has(claimKey)) continue;
    claimedTemplateLines.add(claimKey);
    for (const targetIdx of instanceOrder) {
      const offset = targetIdx === source.instanceIdx ? null : offsetBefore(group.id, source.instanceIdx, targetIdx);
      if (offset === null) continue;
      const target = attachedLinesOfInstance(after, group.id, targetIdx).find(
        (line) => line.templateLineIdx === source.templateLineIdx,
      );
      if (!target) continue;
      const updates = offsetTimingFields(source, offset);
      if (hasNegativeTime(updates)) return { ...unchanged, rejected: true };
      const copied = reconcileLine({ ...target, ...updates });
      if (!timingChanged(target, copied)) continue;
      const targetIndex = indexById.get(target.id);
      if (targetIndex === undefined) continue;
      if (lines === after) lines = [...after];
      lines[targetIndex] = copied;
      touchedGroupIds.add(group.id);
    }
  }
  return lines === after ? unchanged : { lines, rejected: false, touchedGroupIds: [...touchedGroupIds] };
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

function timeRangeResolver(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  duration: number,
): (line: LyricLine) => TimeRange {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const rangeByInstance = new Map<string, TimeRange>();
  const wholeSong: TimeRange = { min: 0, max: duration };
  return (line) => {
    if (!isLinked(line) || !isSharedLine(line, groupsById)) return wholeSong;
    const key = `${line.groupId}:${line.instanceIdx}`;
    let range = rangeByInstance.get(key);
    const group = groupsById.get(line.groupId);
    if (!range && group) {
      range = sharedTimeRange(lines, group, line.instanceIdx, duration);
      rangeByInstance.set(key, range);
    }
    return range ?? wholeSong;
  };
}

// -- Exports ------------------------------------------------------------------

export {
  attachedLinesOfInstance,
  endsAfter,
  hasNegativeTime,
  instanceOffset,
  instanceStart,
  isInstanceFullyTimed,
  isSharedLine,
  offsetTimingFields,
  sharedInstancesInLineOrder,
  sharedTimingFanOut,
  sharesTiming,
  timeRangeResolver,
  UNBOUNDED_TIME_RANGE,
};
export type { TimeRange };
