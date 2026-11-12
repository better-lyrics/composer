import { type LinkedLine, isAttachedToInstance } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";

// -- Types --------------------------------------------------------------------

interface SharedCopyTarget {
  target: LyricLine;
  offset: number;
}

// -- Functions ----------------------------------------------------------------

// The lines a timing edit on `source` is copied to: its template line in every other instance with a known offset.
function sharedCopyTargets(
  lines: readonly LyricLine[],
  source: LinkedLine,
  instanceOrder: readonly number[],
  offsetTo: (targetIdx: number) => number | null,
): SharedCopyTarget[] {
  const targets: SharedCopyTarget[] = [];
  for (const targetIdx of instanceOrder) {
    const offset = targetIdx === source.instanceIdx ? null : offsetTo(targetIdx);
    if (offset === null) continue;
    const target = lines.find(
      (line) =>
        isAttachedToInstance(line, source.groupId, targetIdx) && line.templateLineIdx === source.templateLineIdx,
    );
    if (target) targets.push({ target, offset });
  }
  return targets;
}

// -- Exports ------------------------------------------------------------------

export { sharedCopyTargets };
