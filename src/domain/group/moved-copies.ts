import { sharedCopyTargetFinder } from "@/domain/group/shared-copy-targets";
import { instanceOffset, isSharedLine, sharedInstancesInLineOrder } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { instanceKey } from "@/domain/instance/key";
import { instanceName } from "@/domain/instance/name";
import { isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import { proseList } from "@/utils/prose-list";

// -- Types --------------------------------------------------------------------

interface MovedCopies {
  names: string[];
  lineIdsBySource: Map<string, string[]>;
}

// -- Constants ----------------------------------------------------------------

const MAX_NAMED_COPIES = 3;

// -- Functions ----------------------------------------------------------------

function copiesMovedWith(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  sourceLineIds: readonly string[],
): MovedCopies {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const linesById = new Map(lines.map((line) => [line.id, line]));
  const sources = new Set(sourceLineIds);
  const namesByInstance = new Map<string, string>();
  const lineIdsBySource = new Map<string, string[]>();
  const instancesByGroup = new Map<string, ReturnType<typeof sharedInstancesInLineOrder>>();
  const copyTargets = sharedCopyTargetFinder(lines, (groupId, from, to) => instanceOffset(lines, groupId, from, to));
  for (const sourceId of sources) {
    const source = linesById.get(sourceId);
    if (!source || !isLinked(source) || !isSharedLine(source, groupsById)) continue;
    const group = groupsById.get(source.groupId);
    if (!group) continue;
    let instances = instancesByGroup.get(group.id);
    if (!instances) {
      instances = sharedInstancesInLineOrder(lines, group);
      instancesByGroup.set(group.id, instances);
    }
    const targets = copyTargets(source, instances)
      .map(({ target }) => target)
      .filter((target) => !sources.has(target.id));
    if (targets.length === 0) continue;
    lineIdsBySource.set(
      sourceId,
      targets.map((target) => target.id),
    );
    for (const target of targets) {
      if (target.instanceIdx === undefined) continue;
      const key = instanceKey(group.id, target.instanceIdx);
      if (!namesByInstance.has(key)) namesByInstance.set(key, instanceName(lines, group, target.instanceIdx));
    }
  }
  return { names: [...namesByInstance.values()], lineIdsBySource };
}

function alsoMovesLabel(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  if (names.length > MAX_NAMED_COPIES) return `Also moves ${names.length} other copies`;
  return `Also moves ${proseList(names)}`;
}

// -- Exports ------------------------------------------------------------------

export { alsoMovesLabel, copiesMovedWith };
