import { wouldDropCrossInstance } from "@/domain/instance/cross-instance";
import { CLEARED_BACKGROUND, manualBackgroundWordEdit } from "@/domain/line/background";
import { type ReadableLine, effectiveMainWordEdit, isLineSyncedSource } from "@/domain/line/effective-words";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { trackWords } from "@/domain/line/tracks";
import { mergeWordsIntoTrack } from "@/domain/word/merge-track";
import { boundsOverlap } from "@/domain/word/overlap";
import type { WordTiming } from "@/domain/word/timing";
import { resolveOverlapsForward, trimTrailingSpaceFromLast } from "@/utils/word-spaces";

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

type MoveRejectReason = "cross-instance" | "line-synced-target" | "line-synced-source" | "overlap";

type MoveResult = { ok: true; updates: LineUpdate[] } | { ok: false; reject: MoveRejectReason };

interface SourceRemovals {
  word: Set<number>;
  bg: Set<number>;
}

interface TargetInserts {
  word: WordTiming[];
  bg: WordTiming[];
}

// -- Validation ---------------------------------------------------------------

function validateMoves(moves: WordMove[], linesById: Map<string, ReadableLine>): MoveResult | null {
  for (const move of moves) {
    const source = linesById.get(move.sourceLineId);
    const target = linesById.get(move.targetLineId);
    if (!source || !target) return { ok: false, reject: "overlap" };
    if (source.id !== target.id && wouldDropCrossInstance(source, target)) {
      return { ok: false, reject: "cross-instance" };
    }
    if (move.targetTrack === "word" && isLineSyncedSource(target) && target.id !== source.id) {
      return { ok: false, reject: "line-synced-target" };
    }
    const targetArr = trackWords(target, move.targetTrack);
    if (targetArr) {
      for (const existing of targetArr) {
        if (boundsOverlap(move.word, existing)) return { ok: false, reject: "overlap" };
      }
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

function lineUpdateFor(
  line: ReadableLine,
  removals: SourceRemovals | undefined,
  inserts: TargetInserts | undefined,
  duration: number,
): Partial<LyricLine> | null {
  let words = line.words;
  let backgroundWords = line.backgroundWords;
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
    words = resolveOverlapsForward(mergeWordsIntoTrack(words ?? [], inserts.word), duration);
    mainChanged = true;
  }
  if (inserts?.bg.length) {
    backgroundWords = resolveOverlapsForward(mergeWordsIntoTrack(backgroundWords ?? [], inserts.bg), duration);
    bgChanged = true;
  }

  const updates: Partial<LyricLine> = {};
  if (mainChanged) {
    const mainEdit = effectiveMainWordEdit(line, words ?? []);
    if (!mainEdit) return null;
    Object.assign(updates, mainEdit);
  }
  if (bgChanged) {
    Object.assign(updates, backgroundWords?.length ? manualBackgroundWordEdit(backgroundWords) : CLEARED_BACKGROUND);
  }
  return updates;
}

// -- Entry point --------------------------------------------------------------

function applyWordMoveAcrossLines(lines: readonly ReadableLine[], moves: WordMove[], duration: number): MoveResult {
  if (moves.length === 0) return { ok: true, updates: [] };

  const linesById = new Map<string, ReadableLine>();
  for (const line of lines) linesById.set(line.id, line);

  const validation = validateMoves(moves, linesById);
  if (validation) return validation;
  const selfOverlap = detectIncomingSelfOverlap(moves);
  if (selfOverlap) return selfOverlap;

  const removeByLine = planRemovals(moves);
  const insertByLine = planInserts(moves);

  const updates: LineUpdate[] = [];
  for (const line of lines) {
    const removals = removeByLine.get(line.id);
    const inserts = insertByLine.get(line.id);
    if (!removals && !inserts) continue;
    const lineUpdates = lineUpdateFor(line, removals, inserts, duration);
    if (!lineUpdates) return { ok: false, reject: "line-synced-source" };
    if (Object.keys(lineUpdates).length > 0) updates.push({ id: line.id, updates: lineUpdates });
  }

  return { ok: true, updates };
}

// -- Exports ------------------------------------------------------------------

export { applyWordMoveAcrossLines };
export type { WordMove };
