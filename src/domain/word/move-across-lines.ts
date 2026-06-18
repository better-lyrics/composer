import { wouldDropCrossInstance } from "@/domain/instance/cross-instance";
import { CLEARED_BACKGROUND, manualBackgroundWordEdit } from "@/domain/line/background";
import { applyMainWordEdit } from "@/domain/line/main-words";
import { type LyricLine, reconcileLine, toFlat } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { bgWords, mainWords } from "@/domain/line/voices";
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

type MoveRejectReason = "cross-instance" | "line-synced-target" | "overlap";

type MoveResult = { ok: true; lines: LyricLine[] } | { ok: false; reject: MoveRejectReason };

interface SourceRemovals {
  word: Set<number>;
  bg: Set<number>;
}

interface TargetInserts {
  word: WordTiming[];
  bg: WordTiming[];
}

// -- Validation ---------------------------------------------------------------

function validateMoves(moves: WordMove[], linesById: Map<string, LyricLine>): MoveResult | null {
  for (const move of moves) {
    const source = linesById.get(move.sourceLineId);
    const target = linesById.get(move.targetLineId);
    if (!source || !target) return { ok: false, reject: "overlap" };
    if (source.id !== target.id && wouldDropCrossInstance(source, target)) {
      return { ok: false, reject: "cross-instance" };
    }
    if (move.targetTrack === "word" && isLineSynced(target) && target.id !== source.id) {
      return { ok: false, reject: "line-synced-target" };
    }
    const targetArr = move.targetTrack === "word" ? mainWords(target) : bgWords(target);
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

// -- Plan -> Snapshot ---------------------------------------------------------

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

function applyRemovals(line: LyricLine, removals: SourceRemovals): LyricLine {
  let updated = line;
  const main = mainWords(updated);
  if (removals.word.size > 0 && main) {
    const remaining = trimTrailingSpaceFromLast(main.filter((_, i) => !removals.word.has(i)));
    updated = applyMainWordEdit(updated, remaining);
  }
  const bg = bgWords(updated);
  if (removals.bg.size > 0 && bg) {
    const remaining = trimTrailingSpaceFromLast(bg.filter((_, i) => !removals.bg.has(i)));
    updated =
      remaining.length > 0
        ? reconcileLine({ ...toFlat(updated), ...manualBackgroundWordEdit(remaining) })
        : reconcileLine({ ...toFlat(updated), ...CLEARED_BACKGROUND });
  }
  return updated;
}

function applyInserts(line: LyricLine, inserts: TargetInserts, duration: number): LyricLine {
  let updated = line;
  if (inserts.word.length > 0) {
    const merged = resolveOverlapsForward(mergeWordsIntoTrack(mainWords(updated) ?? [], inserts.word), duration);
    updated = applyMainWordEdit(updated, merged);
  }
  if (inserts.bg.length > 0) {
    const merged = resolveOverlapsForward(mergeWordsIntoTrack(bgWords(updated) ?? [], inserts.bg), duration);
    updated = reconcileLine({ ...toFlat(updated), ...manualBackgroundWordEdit(merged) });
  }
  return updated;
}

// -- Entry point --------------------------------------------------------------

function applyWordMoveAcrossLines(lines: LyricLine[], moves: WordMove[], duration: number): MoveResult {
  if (moves.length === 0) return { ok: true, lines };

  const linesById = new Map<string, LyricLine>();
  for (const line of lines) linesById.set(line.id, line);

  const validation = validateMoves(moves, linesById);
  if (validation) return validation;
  const selfOverlap = detectIncomingSelfOverlap(moves);
  if (selfOverlap) return selfOverlap;

  const removeByLine = planRemovals(moves);
  const insertByLine = planInserts(moves);

  const next = lines.map((line) => {
    let updated = line;
    const removals = removeByLine.get(line.id);
    if (removals) updated = applyRemovals(updated, removals);
    const inserts = insertByLine.get(line.id);
    if (inserts) updated = applyInserts(updated, inserts, duration);
    return updated;
  });

  return { ok: true, lines: next };
}

// -- Exports ------------------------------------------------------------------

export { applyWordMoveAcrossLines };
export type { MoveRejectReason, MoveResult, WordMove, WordTrackKind };
