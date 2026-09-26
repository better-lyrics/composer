import { belongsToInstance } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";

// -- Functions ----------------------------------------------------------------

function linesOfInstance(lines: ReadonlyArray<LyricLine>, groupId: string, instanceIdx: number): LyricLine[] {
  return lines.filter((line) => belongsToInstance(line, groupId, instanceIdx));
}

function instanceIndicesOf(lines: ReadonlyArray<LyricLine>, groupId: string): number[] {
  const indices = new Set<number>();
  for (const line of lines) {
    if (line.groupId === groupId && line.instanceIdx !== undefined) indices.add(line.instanceIdx);
  }
  return Array.from(indices).toSorted((a, b) => a - b);
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

export { instanceIndicesOf, linesOfInstance, nextInstanceIdx };
