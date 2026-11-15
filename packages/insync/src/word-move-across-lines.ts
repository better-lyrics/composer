import type { TimeRange } from "./group-shared-timing";
import { wouldDropCrossInstance } from "./cross-instance";
import { instanceKey } from "./instance-key";
import { isLinked, isSlotLine, type SlotLine } from "./instance-predicates";
import { withoutBackground } from "./line-background";
import { manualBackgroundWordEdit } from "./line-lane-word-edits";
import { drawnSyllables } from "./line-drawn-track";
import type { LineUpdate, LyricLine } from "./line";
import { isLineSynced } from "./line-predicates";
import { trackRole, untimedSyllablesOf } from "./line-track";
import { mainTimingEdit } from "./line-track-writes";
import { mergeWordsIntoTrack } from "./word-merge-track";
import { boundsOverlap } from "./word-overlap";
import type { WordTiming } from "./word-timing";
import { resolveOverlapsForward, trimTrailingSpaceFromLast } from "./word-spaces";

// -- Types --------------------------------------------------------------------

type WordTrackKind = "word" | "bg";

interface WordMove {
  sourceLineId: string;
  sourceWordIndex: number;
  sourceTrack: WordTrackKind;
  targetLineId: string;
  targetTrack: WordTrackKind;
  word: WordTiming;
}

type MoveRejectReason = "line-synced-target" | "line-synced-source" | "overlap";

// `detachedIds` are group lines a move to or from another instance made their instance's own.
type MoveResult = { ok: true; updates: LineUpdate[]; detachedIds: string[] } | { ok: false; reject: MoveRejectReason };

interface SourceRemovals {
  word: Set<number>;
  bg: Set<number>;
}

interface TargetInserts {
  word: WordTiming[];
  bg: WordTiming[];
}

// -- Validation ---------------------------------------------------------------

function validateMoves(moves: WordMove[], linesById: Map<string, LyricLine>, splitChar: string): MoveResult | null {
  for (const move of moves) {
    const source = linesById.get(move.sourceLineId);
    const target = linesById.get(move.targetLineId);
    if (!source || !target) return { ok: false, reject: "overlap" };
    if (move.targetTrack === "word" && isLineSynced(target) && target.id !== source.id) {
      return { ok: false, reject: "line-synced-target" };
    }
    for (const existing of drawnSyllables(target, trackRole(move.targetTrack), splitChar)) {
      if (boundsOverlap(move.word, existing)) return { ok: false, reject: "overlap" };
    }
  }
  return null;
}

function detectIncomingSelfOverlap(moves: WordMove[]): MoveResult | null {
  const incomingByTarget = new Map<string, WordTiming[]>();
  for (const move of moves) {
    const key = `${move.targetLineId}:${move.targetTrack}`;
    const arr = incomingByTarget.get(key) ?? [];
    arr.push(move.word);
    incomingByTarget.set(key, arr);
  }
  for (const arr of incomingByTarget.values()) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (boundsOverlap(arr[i], arr[j])) return { ok: false, reject: "overlap" };
      }
    }
  }
  return null;
}

// -- Plan -> Updates ----------------------------------------------------------

function planRemovals(moves: WordMove[]): Map<string, SourceRemovals> {
  const removeByLine = new Map<string, SourceRemovals>();
  for (const move of moves) {
    const entry = removeByLine.get(move.sourceLineId) ?? { word: new Set<number>(), bg: new Set<number>() };
    if (move.sourceTrack === "word") entry.word.add(move.sourceWordIndex);
    else entry.bg.add(move.sourceWordIndex);
    removeByLine.set(move.sourceLineId, entry);
  }
  return removeByLine;
}

function planInserts(moves: WordMove[]): Map<string, TargetInserts> {
  const insertByLine = new Map<string, TargetInserts>();
  for (const move of moves) {
    const entry = insertByLine.get(move.targetLineId) ?? { word: [], bg: [] };
    if (move.targetTrack === "word") entry.word.push(move.word);
    else entry.bg.push(move.word);
    insertByLine.set(move.targetLineId, entry);
  }
  return insertByLine;
}

function nonEmpty(words: WordTiming[]): WordTiming[] | undefined {
  return words.length > 0 ? words : undefined;
}

function lineUpdateFor(
  line: LyricLine,
  removals: SourceRemovals | undefined,
  inserts: TargetInserts | undefined,
  rangeEnd: number,
  splitChar: string,
): Partial<LyricLine> | null {
  let words = nonEmpty(drawnSyllables(line, "main", splitChar));
  let backgroundWords = nonEmpty(drawnSyllables(line, "bg", splitChar));
  let mainChanged = false;
  let bgChanged = false;
  if (removals?.word.size && words) {
    words = trimTrailingSpaceFromLast(words.filter((_, i) => !removals.word.has(i)));
    mainChanged = true;
  }
  if (removals?.bg.size && backgroundWords) {
    backgroundWords = trimTrailingSpaceFromLast(backgroundWords.filter((_, i) => !removals.bg.has(i)));
    bgChanged = true;
  }
  if (inserts?.word.length) {
    words = resolveOverlapsForward(
      mergeWordsIntoTrack(words ?? [], inserts.word, untimedSyllablesOf(line, "main")),
      rangeEnd,
    );
    mainChanged = true;
  }
  if (inserts?.bg.length) {
    backgroundWords = resolveOverlapsForward(
      mergeWordsIntoTrack(backgroundWords ?? [], inserts.bg, untimedSyllablesOf(line, "bg")),
      rangeEnd,
    );
    bgChanged = true;
  }

  let updates: Partial<LyricLine> = {};
  if (mainChanged) {
    const mainEdit = mainTimingEdit(line, words ?? []);
    if (!mainEdit) return null;
    updates = mainEdit;
  }
  if (bgChanged) {
    updates = backgroundWords?.length
      ? manualBackgroundWordEdit(line, backgroundWords, splitChar, updates)
      : { ...updates, tracks: withoutBackground({ ...line, ...updates }).tracks };
  }
  return updates;
}

// An instance takes a move between two of its template lines only whole, so where another instance follows the
// template at just one of the two lines, that line becomes its instance's own instead of diverging from the template.
function linesMissingTheirPair(lines: readonly LyricLine[], pairs: readonly SlotLine[][]): string[] {
  if (pairs.length === 0) return [];
  const slotKey = (groupId: string, instanceIdx: number, slot: number) =>
    `${instanceKey(groupId, instanceIdx)}\u0000${slot}`;
  const groupIds = new Set(pairs.map(([line]) => line.groupId));
  const instancesByGroup = new Map<string, Set<number>>();
  const attached = new Map<string, SlotLine>();
  for (const line of lines) {
    if (!isLinked(line) || !groupIds.has(line.groupId)) continue;
    instancesByGroup.set(line.groupId, (instancesByGroup.get(line.groupId) ?? new Set()).add(line.instanceIdx));
    if (isSlotLine(line)) attached.set(slotKey(line.groupId, line.instanceIdx, line.templateLineIdx), line);
  }
  return pairs.flatMap(([source, target]) =>
    [...(instancesByGroup.get(source.groupId) ?? [])].flatMap((instanceIdx) => {
      const [from, to] = [source, target].map((line) =>
        attached.get(slotKey(line.groupId, instanceIdx, line.templateLineIdx)),
      );
      const lone = from && to ? undefined : (from ?? to);
      return lone ? [lone.id] : [];
    }),
  );
}

// Text moved between a group line and a line of any other instance, or of none, or a detached one, makes that group
// line its instance's own; text moved inside one instance changes its template.
function linesLeavingTheirTemplate(
  lines: readonly LyricLine[],
  moves: WordMove[],
  linesById: Map<string, LyricLine>,
): Set<string> {
  const leaving = new Set<string>();
  const pairs: SlotLine[][] = [];
  for (const move of moves) {
    const source = linesById.get(move.sourceLineId);
    const target = linesById.get(move.targetLineId);
    if (!source || !target || source.id === target.id) continue;
    if (!wouldDropCrossInstance(source, target) && !source.detached === !target.detached) {
      if (isSlotLine(source) && isSlotLine(target)) pairs.push([source, target]);
      continue;
    }
    for (const line of [source, target]) if (isLinked(line) && !line.detached) leaving.add(line.id);
  }
  for (const id of linesMissingTheirPair(lines, pairs)) leaving.add(id);
  return leaving;
}

// -- Entry point --------------------------------------------------------------

function applyWordMoveAcrossLines(
  lines: readonly LyricLine[],
  moves: WordMove[],
  rangeOf: (line: LyricLine) => TimeRange,
  splitChar: string,
): MoveResult {
  if (moves.length === 0) return { ok: true, updates: [], detachedIds: [] };

  const linesById = new Map<string, LyricLine>();
  for (const line of lines) linesById.set(line.id, line);

  const validation = validateMoves(moves, linesById, splitChar);
  if (validation) return validation;
  const selfOverlap = detectIncomingSelfOverlap(moves);
  if (selfOverlap) return selfOverlap;

  const leaving = linesLeavingTheirTemplate(lines, moves, linesById);
  const removeByLine = planRemovals(moves);
  const insertByLine = planInserts(moves);

  const updates: LineUpdate[] = [];
  for (const line of lines) {
    const removals = removeByLine.get(line.id);
    const inserts = insertByLine.get(line.id);
    if (!removals && !inserts) {
      if (leaving.has(line.id)) updates.push({ id: line.id, updates: { detached: true } });
      continue;
    }
    const lineUpdates = lineUpdateFor(line, removals, inserts, rangeOf(line).max, splitChar);
    if (!lineUpdates) return { ok: false, reject: "line-synced-source" };
    if (Object.keys(lineUpdates).length === 0) continue;
    updates.push({ id: line.id, updates: leaving.has(line.id) ? { ...lineUpdates, detached: true } : lineUpdates });
  }

  return { ok: true, updates, detachedIds: updates.flatMap((update) => (leaving.has(update.id) ? [update.id] : [])) };
}

// -- Exports ------------------------------------------------------------------

export type { MoveRejectReason, WordMove };
export { applyWordMoveAcrossLines };
