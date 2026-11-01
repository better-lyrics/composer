import { type LinkedLine, belongsToInstance, isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";

// -- Types --------------------------------------------------------------------

interface InstancePosition {
  ordinal: number;
  count: number;
}

// -- Functions ----------------------------------------------------------------

function linesOfInstance(lines: ReadonlyArray<LyricLine>, groupId: string, instanceIdx: number): LyricLine[] {
  return lines.filter((line) => belongsToInstance(line, groupId, instanceIdx));
}

function sortedIndices(indices: Set<number>): number[] {
  return Array.from(indices).toSorted((a, b) => a - b);
}

function ordinalAmong(sortedInstanceIndices: readonly number[], instanceIdx: number): number {
  return sortedInstanceIndices.indexOf(instanceIdx) + 1;
}

function instanceIndicesOf(lines: ReadonlyArray<LyricLine>, groupId: string): number[] {
  const indices = new Set<number>();
  for (const line of lines) {
    if (line.groupId === groupId && line.instanceIdx !== undefined) indices.add(line.instanceIdx);
  }
  return sortedIndices(indices);
}

function instanceOrdinal(lines: ReadonlyArray<LyricLine>, groupId: string, instanceIdx: number): number {
  return ordinalAmong(instanceIndicesOf(lines, groupId), instanceIdx);
}

function instancePositionsByLineId(lines: ReadonlyArray<LyricLine>): Map<string, InstancePosition> {
  const linkedByGroup = new Map<string, { indices: Set<number>; lines: LinkedLine[] }>();
  for (const line of lines) {
    if (!isLinked(line)) continue;
    const group = linkedByGroup.get(line.groupId) ?? { indices: new Set<number>(), lines: [] };
    group.indices.add(line.instanceIdx);
    group.lines.push(line);
    linkedByGroup.set(line.groupId, group);
  }
  const positions = new Map<string, InstancePosition>();
  for (const group of linkedByGroup.values()) {
    const sorted = sortedIndices(group.indices);
    for (const line of group.lines) {
      positions.set(line.id, { ordinal: ordinalAmong(sorted, line.instanceIdx), count: sorted.length });
    }
  }
  return positions;
}

function instanceCount(lines: ReadonlyArray<LyricLine>, groupId: string): number {
  return instanceIndicesOf(lines, groupId).length;
}

function nextInstanceIdx(lines: ReadonlyArray<LyricLine>, groupId: string): number {
  let instanceIdx = 0;
  for (const used of instanceIndicesOf(lines, groupId)) {
    if (used > instanceIdx) break;
    if (used === instanceIdx) instanceIdx++;
  }
  return instanceIdx;
}

// -- Exports ------------------------------------------------------------------

export {
  instanceCount,
  instanceIndicesOf,
  instanceOrdinal,
  instancePositionsByLineId,
  linesOfInstance,
  nextInstanceIdx,
};
