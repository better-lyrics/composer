import type { LinkGroup } from "@/domain/group/template";
import { instanceBounds } from "@/domain/instance/bounds";
import { linesOfInstance } from "@/domain/instance/enumerate";
import { isLinked } from "@/domain/instance/predicates";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { isLineFullyTimed, isSyncableLine } from "@/domain/line/sync-progress";
import type { WordTiming } from "@/domain/word/timing";

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
  const order: number[] = [];
  for (const line of lines) {
    if (line.groupId !== group.id || line.detached || line.instanceIdx === undefined) continue;
    if (!sharesTiming(group, line.instanceIdx) || order.includes(line.instanceIdx)) continue;
    order.push(line.instanceIdx);
  }
  return order;
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

function referenceInstance(lines: readonly LyricLine[], group: LinkGroup, excluding: number): number | null {
  const reference = sharedInstancesInLineOrder(lines, group).find(
    (instanceIdx) => instanceIdx !== excluding && isInstanceFullyTimed(lines, group.id, instanceIdx),
  );
  return reference ?? null;
}

// -- Timing fields ------------------------------------------------------------

function offsetWords(words: readonly WordTiming[] | undefined, offset: number): WordTiming[] | undefined {
  return words?.map((word) => ({ ...word, begin: word.begin + offset, end: word.end + offset }));
}

function offsetTimingFields(source: LyricLine, offset: number): LineUpdate["updates"] {
  const backgroundWords = offsetWords(source.backgroundWords, offset);
  if (source.words) return { words: offsetWords(source.words, offset), backgroundWords, begin: undefined, end: undefined };
  if (source.begin !== undefined) {
    return { begin: source.begin + offset, end: source.end + offset, backgroundWords, words: undefined };
  }
  return { words: undefined, begin: undefined, end: undefined, backgroundWords };
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
  return attachedLinesOfInstance(lines, groupId, toIdx).flatMap((target) => {
    const source = sourceByTemplateLine.get(target.templateLineIdx);
    return source ? [{ id: target.id, updates: offsetTimingFields(source, offset) }] : [];
  });
}

// -- Placing ------------------------------------------------------------------

function placeSharedInstance(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  groupId: string,
  instanceIdx: number,
  start: number,
): LineUpdate[] {
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group || !sharesTiming(group, instanceIdx)) return [];
  const reference = referenceInstance(lines, group, instanceIdx);
  const referenceStart = reference === null ? null : instanceStart(lines, groupId, reference);
  if (reference === null || referenceStart === null) return [];
  return copyInstanceTiming(lines, groupId, reference, instanceIdx, start - referenceStart);
}

// -- Exports ------------------------------------------------------------------

export {
  isSharedLine,
  placeSharedInstance,
  sharedInstancesInLineOrder,
  sharesTiming,
};
