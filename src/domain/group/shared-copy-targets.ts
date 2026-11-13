import { instanceKey } from "@/domain/instance/key";
import { type LinkedLine, isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";

// -- Types --------------------------------------------------------------------

interface SharedCopyTarget {
  target: LyricLine;
  offset: number;
}

type InstanceOffset = (groupId: string, from: number, to: number) => number | null;

type CopyTargetFinder = (source: LinkedLine, instanceOrder: readonly number[]) => SharedCopyTarget[];

// -- Functions ----------------------------------------------------------------

const templateSlotKey = (groupId: string, instanceIdx: number, templateLineIdx: number | undefined) =>
  `${instanceKey(groupId, instanceIdx)}:${templateLineIdx}`;

// The lines a timing edit on a source is copied to: its template line in every other instance with a known
// offset. Lines and offsets are indexed once, so a batch of sources never rescans the song per source.
function sharedCopyTargetFinder(lines: readonly LyricLine[], offsetOf: InstanceOffset): CopyTargetFinder {
  const attachedBySlot = new Map<string, LyricLine>();
  for (const line of lines) {
    if (!isLinked(line) || line.detached) continue;
    const key = templateSlotKey(line.groupId, line.instanceIdx, line.templateLineIdx);
    if (!attachedBySlot.has(key)) attachedBySlot.set(key, line);
  }
  const offsets = new Map<string, number | null>();
  const offsetBetween = (groupId: string, from: number, to: number) => {
    const key = `${groupId}:${from}:${to}`;
    if (!offsets.has(key)) offsets.set(key, offsetOf(groupId, from, to));
    return offsets.get(key) ?? null;
  };
  return (source, instanceOrder) => {
    const targets: SharedCopyTarget[] = [];
    for (const targetIdx of instanceOrder) {
      if (targetIdx === source.instanceIdx) continue;
      const offset = offsetBetween(source.groupId, source.instanceIdx, targetIdx);
      if (offset === null) continue;
      const target = attachedBySlot.get(templateSlotKey(source.groupId, targetIdx, source.templateLineIdx));
      if (target) targets.push({ target, offset });
    }
    return targets;
  };
}

// -- Exports ------------------------------------------------------------------

export { sharedCopyTargetFinder };
