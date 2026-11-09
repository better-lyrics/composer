import { effectiveTrackWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import type { WordSelection } from "@/domain/selection/model";

// -- Functions ----------------------------------------------------------------

// A selection names its line by id; the index is only a hint that goes stale when lines are added or removed.
function resolveSelections(lines: readonly LyricLine[], selections: readonly WordSelection[]): WordSelection[] {
  const indexById = new Map(lines.map((line, index) => [line.id, index]));
  return selections.flatMap((selection) => {
    const lineIndex = indexById.get(selection.lineId);
    if (lineIndex === undefined) return [];
    const words = effectiveTrackWords(lines[lineIndex], selection.type);
    if (!words?.[selection.wordIndex]) return [];
    return lineIndex === selection.lineIndex ? [selection] : [{ ...selection, lineIndex }];
  });
}

// -- Exports ------------------------------------------------------------------

export { resolveSelections };
