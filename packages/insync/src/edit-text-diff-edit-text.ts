import { sameSharedContent } from "./group-carried-line";
import { withLineIds } from "./group-line-ids";
import { isLinked } from "./instance-predicates";
import type { LyricLine } from "./line";
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
function withMovedTextDetached(oldLines: readonly LyricLine[], newLines: LyricLine[]): MovedText {
  const oldById = new Map(oldLines.map((line) => [line.id, line]));
  const replacing = rowsTakingTheirPlace(oldLines, newLines);
  const detachedIds: string[] = [];
  const lines = newLines.map((line, index) => {
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
    isLinked(old) && !old.detached && !newIds.has(old.id) && !replacedIds.has(old.id) ? [old.id] : [],
  );
  return { lines: detachedIds.length ? lines : newLines, detachedIds, removedIds };
}

// -- Exports ------------------------------------------------------------------

export { diffEditTextChange, withMovedTextDetached };
