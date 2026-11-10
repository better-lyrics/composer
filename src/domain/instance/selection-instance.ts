import { isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";

// -- Functions ----------------------------------------------------------------

// The one instance every selected word sits in, or null when they span several or none.
function currentInstanceFromSelection(
  lines: LyricLine[],
  selectedWords: ReadonlyArray<{ lineId: string }>,
): { groupId: string; instanceIdx: number } | null {
  if (selectedWords.length === 0) return null;
  const linesById = new Map<string, LyricLine>();
  for (const l of lines) linesById.set(l.id, l);
  let groupId: string | null = null;
  let instanceIdx: number | null = null;
  for (const sel of selectedWords) {
    const line = linesById.get(sel.lineId);
    if (!line || !isLinked(line)) return null;
    if (groupId === null) {
      groupId = line.groupId;
      instanceIdx = line.instanceIdx;
    } else if (line.groupId !== groupId || line.instanceIdx !== instanceIdx) {
      return null;
    }
  }
  if (groupId === null || instanceIdx === null) return null;
  return { groupId, instanceIdx };
}

// -- Exports ------------------------------------------------------------------

export { currentInstanceFromSelection };
