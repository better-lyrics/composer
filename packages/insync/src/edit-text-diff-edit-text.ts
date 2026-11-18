import { sameSharedContent } from "./group-carried-line";
import { withLineIds } from "./group-line-ids";
import { isLinked, isSlotLine } from "./instance-predicates";
import type { LyricLine } from "./line";
import { backgroundText, lineText } from "./line-text";
import { isStructurallyEqual } from "./structural-equal";

// -- Types --------------------------------------------------------------------

interface ContentUpdate {
  id: string;
  updates: Partial<LyricLine>;
}

interface MovedText {
  lines: LyricLine[];
  detachedIds: string[];
  // Group lines the edit removed with nothing in their place: their instance no longer has them.
  removedIds: string[];
  // Group lines back at the text they had when the run of typing began, which their other instances take again.
  restoredIds: string[];
}

// The lines when the current run of typing began, read with the split character the text was written with.
interface RunStart {
  lines: readonly LyricLine[];
  splitChar: string;
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

// Where a group line that left the text stood, a new row in its place is that line with the text it now has.
function rowsTakingTheirPlace(oldLines: readonly LyricLine[], newLines: readonly LyricLine[]): Map<number, LyricLine> {
  const newIndexById = new Map(newLines.map((line, index) => [line.id, index]));
  const oldIds = new Set(oldLines.map((line) => line.id));
  const taken = new Map<number, LyricLine>();
  let nextIndex = 0;
  for (const old of oldLines) {
    const kept = newIndexById.get(old.id);
    if (kept !== undefined) {
      nextIndex = kept + 1;
      continue;
    }
    const row = newLines[nextIndex];
    if (!isLinked(old) || old.detached || !row || oldIds.has(row.id) || isLinked(row) || taken.has(nextIndex)) continue;
    taken.set(nextIndex, old);
    nextIndex++;
  }
  return taken;
}

// A structural edit moves text between lines: a group line whose text it changed now differs from its template, so
// it becomes that instance's own line, and a group line it removed is gone from that instance only. Its other
// instances and every other line stay as they were.
// A group line Enter broke into the text it had when this run of typing began and text typed in the run: the row
// showing the run's start text is that line again, unchanged, and the typed text is a row of its own.
function rowsBackAtRunStart(
  oldLines: readonly LyricLine[],
  newLines: readonly LyricLine[],
  replacing: ReadonlyMap<number, LyricLine>,
  runStart: RunStart | undefined,
): Map<number, LyricLine> {
  const restored = new Map<number, LyricLine>();
  if (!runStart) return restored;
  const oldIds = new Set(oldLines.map((line) => line.id));
  const startById = new Map(runStart.lines.map((line) => [line.id, line]));
  const shows = (line: LyricLine) =>
    `${lineText(line, runStart.splitChar)}\u0000${backgroundText(line, runStart.splitChar) ?? ""}`;
  for (const [index, replaced] of replacing) {
    const start = startById.get(replaced.id);
    if (!isSlotLine(start) || start.detached || shows(start) === shows(replaced)) continue;
    const at = [index + 1, index - 1].find((row) => {
      const line = newLines[row];
      return line && !oldIds.has(line.id) && !isLinked(line) && !replacing.has(row) && shows(line) === shows(start);
    });
    if (at !== undefined && !restored.has(at)) restored.set(at, start);
  }
  return restored;
}

function withMovedTextDetached(oldLines: readonly LyricLine[], newLines: LyricLine[], runStart?: RunStart): MovedText {
  const oldById = new Map(oldLines.map((line) => [line.id, line]));
  const taking = rowsTakingTheirPlace(oldLines, newLines);
  const restored = rowsBackAtRunStart(oldLines, newLines, taking, runStart);
  const restoredIds = new Set([...restored.values()].map((line) => line.id));
  const replacing = new Map([...taking].filter(([, line]) => !restoredIds.has(line.id)));
  const detachedIds: string[] = [];
  const lines = newLines.map((line, index) => {
    const back = restored.get(index);
    if (back) return back;
    const replaced = replacing.get(index);
    if (replaced && isLinked(replaced)) {
      detachedIds.push(replaced.id);
      const { groupId, instanceIdx, templateLineIdx } = replaced;
      return { ...withLineIds(line, replaced.id, {}), groupId, instanceIdx, templateLineIdx, detached: true };
    }
    const old = oldById.get(line.id);
    if (!old || !isLinked(line) || line.detached || !isLinked(old) || sameSharedContent(old, line)) return line;
    detachedIds.push(line.id);
    return { ...line, detached: true };
  });
  const newIds = new Set(newLines.map((line) => line.id));
  const replacedIds = new Set([...replacing.values()].map((line) => line.id));
  const removedIds = oldLines.flatMap((old) =>
    isLinked(old) && !old.detached && !newIds.has(old.id) && !replacedIds.has(old.id) && !restoredIds.has(old.id)
      ? [old.id]
      : [],
  );
  return {
    lines: detachedIds.length || restored.size ? lines : newLines,
    detachedIds,
    removedIds,
    restoredIds: [...restoredIds],
  };
}

// -- Exports ------------------------------------------------------------------

export type { RunStart };
export { diffEditTextChange, withMovedTextDetached };
