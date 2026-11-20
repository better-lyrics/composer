import type { TimeRange } from "@/domain/group/shared-timing";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import { trackWords } from "@/domain/line/tracks";
import { expandSelectionToGroupmates } from "@/domain/word/syllable-groups";

// -- Types --------------------------------------------------------------------

interface NudgeSelection {
  lineId: string;
  type: "word" | "bg";
  wordIndex: number;
}

interface NudgeUpdate {
  id: string;
  updates: Partial<LyricLine>;
}

interface NudgeResult {
  appliedDelta: number;
  updates: NudgeUpdate[];
}

interface PartitionedSelections {
  wordSynced: NudgeSelection[];
  lineSynced: NudgeSelection[];
}

// -- Functions ----------------------------------------------------------------

function partitionNudgeSelections(
  rawLines: LyricLine[],
  selections: ReadonlyArray<NudgeSelection>,
): PartitionedSelections {
  const linesById = new Map<string, LyricLine>();
  for (const l of rawLines) linesById.set(l.id, l);
  const wordSyncedSeen = new Set<string>();
  const wordSynced: NudgeSelection[] = [];
  const lineSynced: NudgeSelection[] = [];
  const seenLineSyncedIds = new Set<string>();

  const pushWordSynced = (sel: NudgeSelection, line: LyricLine) => {
    const wordsArray = trackWords(line, sel.type);
    if (!wordsArray) return;
    const expanded = expandSelectionToGroupmates(wordsArray, [sel.wordIndex]);
    for (const idx of expanded) {
      const key = `${sel.lineId}:${sel.type}:${idx}`;
      if (wordSyncedSeen.has(key)) continue;
      wordSyncedSeen.add(key);
      wordSynced.push({ lineId: sel.lineId, type: sel.type, wordIndex: idx });
    }
  };

  for (const sel of selections) {
    const line = linesById.get(sel.lineId);
    if (!line) continue;
    if (sel.type === "bg") {
      pushWordSynced(sel, line);
      continue;
    }
    if (isWordSynced(line)) {
      pushWordSynced(sel, line);
    } else if (isLineSynced(line)) {
      if (seenLineSyncedIds.has(sel.lineId)) continue;
      seenLineSyncedIds.add(sel.lineId);
      lineSynced.push(sel);
    }
  }
  return { wordSynced, lineSynced };
}

// Runs both nudgeSelectedWords and shiftLineSyncedRows under a single shared
// clamp so that mixed instances (some line-synced rows + some word-synced rows
// in the same selection) move uniformly. Without this, the two helpers would
// each compute their own clamp and could apply different deltas, producing
// asymmetric instance shifts that stretch the group banner.
function shiftSelectionsTogether(
  rawLines: LyricLine[],
  partitioned: PartitionedSelections,
  requestedDelta: number,
  rangeOf: (line: LyricLine) => TimeRange,
): NudgeResult {
  if (requestedDelta === 0) return { appliedDelta: 0, updates: [] };
  const wordHasSelection = partitioned.wordSynced.length > 0;
  const lineHasSelection = partitioned.lineSynced.length > 0;
  if (!wordHasSelection && !lineHasSelection) return { appliedDelta: 0, updates: [] };
  const direction = requestedDelta < 0 ? -1 : 1;

  const wordProbe = nudgeSelectedWords(rawLines, partitioned.wordSynced, requestedDelta, rangeOf);
  const lineProbe = shiftLineSyncedRows(rawLines, partitioned.lineSynced, requestedDelta, rangeOf);
  const wordMag = wordHasSelection ? Math.abs(wordProbe.appliedDelta) : Number.POSITIVE_INFINITY;
  const lineMag = lineHasSelection ? Math.abs(lineProbe.appliedDelta) : Number.POSITIVE_INFINITY;
  const unifiedMag = Math.min(wordMag, lineMag, Math.abs(requestedDelta));
  if (unifiedMag === 0) return { appliedDelta: 0, updates: [] };

  const unifiedDelta = direction * unifiedMag;

  const wordFinal =
    !wordHasSelection || Math.abs(wordProbe.appliedDelta) === unifiedMag
      ? wordProbe
      : nudgeSelectedWords(rawLines, partitioned.wordSynced, unifiedDelta, rangeOf);
  const lineFinal =
    !lineHasSelection || Math.abs(lineProbe.appliedDelta) === unifiedMag
      ? lineProbe
      : shiftLineSyncedRows(rawLines, partitioned.lineSynced, unifiedDelta, rangeOf);

  return { appliedDelta: unifiedDelta, updates: [...wordFinal.updates, ...lineFinal.updates] };
}

function shiftLineSyncedRows(
  rawLines: LyricLine[],
  selections: ReadonlyArray<NudgeSelection>,
  requestedDelta: number,
  rangeOf: (line: LyricLine) => TimeRange,
): NudgeResult {
  if (selections.length === 0 || requestedDelta === 0) {
    return { appliedDelta: 0, updates: [] };
  }
  const direction = requestedDelta < 0 ? -1 : 1;
  let allowedMagnitude = Math.abs(requestedDelta);
  const targets: LyricLine[] = [];
  const linesById = new Map<string, LyricLine>();
  for (const l of rawLines) linesById.set(l.id, l);
  for (const sel of selections) {
    const line = linesById.get(sel.lineId);
    if (!line || line.begin === undefined || line.end === undefined) continue;
    targets.push(line);
    const range = rangeOf(line);
    const headroom = direction < 0 ? line.begin - range.min : range.max - line.end;
    if (headroom < allowedMagnitude) allowedMagnitude = headroom;
    if (allowedMagnitude <= 0) return { appliedDelta: 0, updates: [] };
  }
  if (targets.length === 0) return { appliedDelta: 0, updates: [] };
  const appliedDelta = direction * allowedMagnitude;
  const updates: NudgeUpdate[] = targets.map((line) => ({
    id: line.id,
    updates: { begin: (line.begin as number) + appliedDelta, end: (line.end as number) + appliedDelta },
  }));
  return { appliedDelta, updates };
}

function nudgeSelectedWords(
  lines: LyricLine[],
  selections: ReadonlyArray<NudgeSelection>,
  requestedDelta: number,
  rangeOf: (line: LyricLine) => TimeRange,
): NudgeResult {
  if (selections.length === 0 || requestedDelta === 0) {
    return { appliedDelta: 0, updates: [] };
  }

  type Group = { line: LyricLine; type: "word" | "bg"; indices: Set<number> };
  const groups = new Map<string, Group>();
  const linesById = new Map<string, LyricLine>();
  for (const l of lines) linesById.set(l.id, l);
  for (const sel of selections) {
    const line = linesById.get(sel.lineId);
    if (!line) continue;
    if (trackWords(line, sel.type)?.[sel.wordIndex] === undefined) continue;
    const key = `${sel.lineId}:${sel.type}`;
    let group = groups.get(key);
    if (!group) {
      group = { line, type: sel.type, indices: new Set() };
      groups.set(key, group);
    }
    group.indices.add(sel.wordIndex);
  }

  if (groups.size === 0) return { appliedDelta: 0, updates: [] };

  const direction = requestedDelta < 0 ? -1 : 1;
  let allowedMagnitude = Math.abs(requestedDelta);

  for (const group of groups.values()) {
    const wordsArray = trackWords(group.line, group.type) ?? [];
    const range = rangeOf(group.line);
    for (const idx of group.indices) {
      const word = wordsArray[idx];
      let headroom: number;
      if (direction < 0) {
        let prevEnd = range.min;
        for (let i = idx - 1; i >= 0; i--) {
          if (!group.indices.has(i)) {
            prevEnd = wordsArray[i].end;
            break;
          }
        }
        headroom = word.begin - prevEnd;
      } else {
        let nextBegin = range.max;
        for (let i = idx + 1; i < wordsArray.length; i++) {
          if (!group.indices.has(i)) {
            nextBegin = wordsArray[i].begin;
            break;
          }
        }
        headroom = nextBegin - word.end;
      }
      if (headroom < allowedMagnitude) allowedMagnitude = headroom;
      if (allowedMagnitude <= 0) return { appliedDelta: 0, updates: [] };
    }
  }

  const appliedDelta = direction * allowedMagnitude;
  const updates: NudgeUpdate[] = [];
  for (const group of groups.values()) {
    const wordsArray = trackWords(group.line, group.type);
    if (!wordsArray) continue;
    const updatedWords = wordsArray.map((w, i) =>
      group.indices.has(i) ? { ...w, begin: w.begin + appliedDelta, end: w.end + appliedDelta } : w,
    );
    updates.push({
      id: group.line.id,
      updates: group.type === "word" ? { words: updatedWords } : manualBackgroundWordEdit(updatedWords),
    });
  }

  return { appliedDelta, updates };
}

// -- Exports ------------------------------------------------------------------

export type { NudgeResult, NudgeSelection, PartitionedSelections };
export { nudgeSelectedWords, partitionNudgeSelections, shiftLineSyncedRows, shiftSelectionsTogether };
