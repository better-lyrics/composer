import { updatedLinkedSibling } from "@/domain/group/linked-sibling";
import { getLinkScope, isLinkedSibling, unlinkLines } from "@/domain/group/linking";
import { instanceKey, parseInstanceKey } from "@/domain/instance/key";
import { isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import { isStructurallyEqual } from "@/utils/structural-equal";

// -- Types --------------------------------------------------------------------

interface ContentUpdate {
  id: string;
  updates: Partial<LyricLine>;
}

interface DiffResult {
  contentUpdates: ContentUpdate[];
  hasStructuralChange: boolean;
}

// -- Helpers ------------------------------------------------------------------

function diffEditTextChange(oldLines: LyricLine[], newLines: LyricLine[]): DiffResult {
  if (oldLines.length !== newLines.length) {
    return { contentUpdates: [], hasStructuralChange: true };
  }

  for (let i = 0; i < oldLines.length; i++) {
    if (oldLines[i].id !== newLines[i].id) {
      return { contentUpdates: [], hasStructuralChange: true };
    }
  }

  const contentUpdates: ContentUpdate[] = [];
  for (let i = 0; i < oldLines.length; i++) {
    const { tracks } = newLines[i];
    if (tracks !== oldLines[i].tracks && !isStructurallyEqual(tracks, oldLines[i].tracks)) {
      contentUpdates.push({ id: oldLines[i].id, updates: { tracks } });
    }
  }

  return { contentUpdates, hasStructuralChange: false };
}

interface ImpactedInstance {
  groupId: string;
  instanceIdx: number;
}

function instancesByKey(lines: LyricLine[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const line of lines) {
    if (!isLinked(line)) continue;
    const key = instanceKey(line.groupId, line.instanceIdx);
    let bucket = out.get(key);
    if (!bucket) {
      bucket = new Set();
      out.set(key, bucket);
    }
    bucket.add(line.id);
  }
  return out;
}

function findStructurallyImpactedInstances(oldLines: LyricLine[], newLines: LyricLine[]): ImpactedInstance[] {
  const oldByKey = instancesByKey(oldLines);
  const newByKey = instancesByKey(newLines);

  const seen = new Set<string>();
  const impacted: ImpactedInstance[] = [];

  const push = (groupId: string, instanceIdx: number) => {
    const key = instanceKey(groupId, instanceIdx);
    if (seen.has(key)) return;
    seen.add(key);
    impacted.push({ groupId, instanceIdx });
  };

  // Detection 1: an instance gained or lost line ids between old and new.
  for (const [key, oldIds] of oldByKey) {
    const newIds = newByKey.get(key) ?? new Set<string>();
    let differs = oldIds.size !== newIds.size;
    if (!differs) {
      for (const id of oldIds) {
        if (!newIds.has(id)) {
          differs = true;
          break;
        }
      }
    }
    if (differs) {
      const { groupId, instanceIdx } = parseInstanceKey(key);
      push(groupId, instanceIdx);
    }
  }

  // Detection 2: a non-grouped line was inserted positionally between two
  // grouped lines from the same instance. The id-set check above misses this
  // when textToLyricLines preserved every existing id and only added a fresh
  // ungrouped row in the middle of an instance.
  for (let i = 1; i < newLines.length - 1; i++) {
    const middle = newLines[i];
    if (middle.groupId !== undefined) continue;
    const prev = newLines[i - 1];
    const next = newLines[i + 1];
    if (prev.groupId === undefined || next.groupId === undefined) continue;
    if (prev.groupId !== next.groupId) continue;
    if (prev.instanceIdx === undefined || prev.instanceIdx !== next.instanceIdx) continue;
    push(prev.groupId, prev.instanceIdx);
  }

  return impacted;
}

function detachInstancesFromLines(lines: LyricLine[], instances: ImpactedInstance[]): LyricLine[] {
  const impactedKeys = new Set(instances.map((i) => instanceKey(i.groupId, i.instanceIdx)));
  return unlinkLines(lines, (line) => isLinked(line) && impactedKeys.has(instanceKey(line.groupId, line.instanceIdx)));
}

function propagateContentUpdates(
  oldLines: LyricLine[],
  newLines: LyricLine[],
  contentUpdates: ContentUpdate[],
): LyricLine[] {
  if (contentUpdates.length === 0) return newLines;
  const oldById = new Map(oldLines.map((line) => [line.id, line]));
  const updatedIds = new Set(contentUpdates.map((update) => update.id));
  const sources = contentUpdates.flatMap((update) => {
    const source = oldById.get(update.id);
    const scope = source && getLinkScope(source);
    return source && scope ? [{ source, scope, updates: update.updates }] : [];
  });
  if (sources.length === 0) return newLines;

  return newLines.map((line) => {
    if (updatedIds.has(line.id)) return line;
    let next = line;
    for (const { source, scope, updates } of sources) {
      if (isLinkedSibling(next, scope)) next = updatedLinkedSibling(next, source, updates);
    }
    return next;
  });
}

// -- Exports ------------------------------------------------------------------

export { detachInstancesFromLines, diffEditTextChange, findStructurallyImpactedInstances, propagateContentUpdates };
export type { ImpactedInstance };
