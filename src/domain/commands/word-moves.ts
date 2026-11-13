import type { LyricCommand } from "@/domain/commands/command";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { refused } from "@/domain/commands/outcome";
import { type TimeRange, timeRangeResolver } from "@/domain/group/shared-timing";
import type { LanguagePieces, LanguageSide } from "@/domain/language/model";
import { languageSide, pieceOf, trackPieces, withAddedPieces } from "@/domain/language/pieces";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import { type ReadableLine, effectiveMainWordEdit, getEffectiveLines } from "@/domain/line/effective-words";
import type { LineUpdate, LyricLine, RawLine } from "@/domain/line/model";
import { type WordTrack, trackWords } from "@/domain/line/tracks";
import type { SyllableAddress } from "@/domain/selection/model";
import { type ResolvedAddress, resolveAddresses } from "@/domain/selection/resolve";
import { mergeWordsIntoTrack } from "@/domain/word/merge-track";
import { type WordMove, applyWordMoveAcrossLines } from "@/domain/word/move-across-lines";
import { boundsOverlap } from "@/domain/word/overlap";
import { reorderWordTrack } from "@/domain/word/reorder-track";
import type { WordTiming } from "@/domain/word/timing";
import { cloneWord } from "@/utils/word-timing";

// -- Types --------------------------------------------------------------------

interface MoveArgs {
  addresses: readonly SyllableAddress[];
  timeDelta: number;
  duration: number;
}

interface CrossLineMoveArgs extends MoveArgs {
  fromLineId: string;
  targetLineId: string;
  targetTrack: WordTrack;
}

interface DuplicatePlan {
  updates: LineUpdate[];
  rejectedLineSynced: boolean;
}

// -- Constants ----------------------------------------------------------------

const OWN_LINE_ONLY = { propagateToSiblings: false } as const;

// -- Helpers ------------------------------------------------------------------

function byLine(selections: readonly ResolvedAddress[]): Map<string, ResolvedAddress[]> {
  const grouped = new Map<string, ResolvedAddress[]>();
  for (const selection of selections) {
    const forLine = grouped.get(selection.lineId) ?? [];
    forLine.push(selection);
    grouped.set(selection.lineId, forLine);
  }
  return grouped;
}

function linesById(lines: readonly ReadableLine[]): Map<string, ReadableLine> {
  return new Map(lines.map((line) => [line.id, line]));
}

function reorderUpdates(
  lines: readonly ReadableLine[],
  selections: readonly ResolvedAddress[],
  timeDelta: number,
  rangeOf: (line: LyricLine) => TimeRange,
): LineUpdate[] {
  const byId = linesById(lines);
  return [...byLine(selections)].flatMap(([lineId, forLine]) => {
    const line = byId.get(lineId);
    if (!line) return [];
    const lineUpdates: Partial<LyricLine> = {};
    const range = rangeOf(line);
    const wordIndices = new Set(forLine.flatMap((s) => (s.type === "word" ? [s.wordIndex] : [])));
    const bgIndices = new Set(forLine.flatMap((s) => (s.type === "bg" ? [s.wordIndex] : [])));
    if (wordIndices.size > 0 && line.words) {
      const edit = effectiveMainWordEdit(line, reorderWordTrack(line.words, wordIndices, timeDelta, range));
      if (edit) Object.assign(lineUpdates, edit);
    }
    if (bgIndices.size > 0 && line.backgroundWords) {
      const reordered = reorderWordTrack(line.backgroundWords, bgIndices, timeDelta, range);
      Object.assign(lineUpdates, manualBackgroundWordEdit(reordered));
    }
    return Object.keys(lineUpdates).length > 0 ? [{ id: lineId, updates: lineUpdates }] : [];
  });
}

function crossLineMoves(
  lines: readonly ReadableLine[],
  selections: readonly ResolvedAddress[],
  args: CrossLineMoveArgs,
  rangeOf: (line: LyricLine) => TimeRange,
): WordMove[] {
  const byId = linesById(lines);
  const targetLine = byId.get(args.targetLineId);
  if (!targetLine) return [];
  const targetRange = rangeOf(targetLine);
  return selections.flatMap((selection) => {
    if (selection.lineId !== args.fromLineId) return [];
    const sourceLine = byId.get(selection.lineId);
    const source = sourceLine && trackWords(sourceLine, selection.type)?.[selection.wordIndex];
    if (!source) return [];
    const newBegin = Math.max(targetRange.min, source.begin + args.timeDelta);
    const newEnd = Math.min(targetRange.max, source.end + args.timeDelta);
    if (newEnd <= newBegin) return [];
    return [
      {
        sourceLineId: selection.lineId,
        sourceWordIndex: selection.wordIndex,
        sourceTrack: selection.type,
        targetLineId: args.targetLineId,
        targetTrack: args.targetTrack,
        word: cloneWord(source, { begin: newBegin, end: newEnd }),
      },
    ];
  });
}

// A moved word keeps its id, so its reading is written under that id on the side it lands on.
function withMovedPieces(
  rawLines: readonly RawLine[],
  lines: readonly ReadableLine[],
  moves: readonly WordMove[],
  updates: LineUpdate[],
): LineUpdate[] {
  const byId = linesById(lines);
  const rawById = new Map(rawLines.map((line) => [line.id, line]));
  return updates.map((update) => {
    const carried = moves.flatMap((move) => {
      const source = move.targetLineId === update.id ? byId.get(move.sourceLineId) : undefined;
      const piece = source && pieceOf(trackPieces(source, languageSide(move.sourceTrack)), move.word);
      return piece ? [{ side: languageSide(move.targetTrack), pieces: { [move.word.id]: piece } }] : [];
    });
    if (!carried.length) return update;
    const languages = carried.reduce(
      (written, { side, pieces }) => withAddedPieces(written, side, pieces),
      update.updates.languages ?? rawById.get(update.id)?.languages,
    );
    return { id: update.id, updates: { ...update.updates, languages } };
  });
}

function duplicatesFor(
  line: ReadableLine,
  forLine: readonly ResolvedAddress[],
  timeDelta: number,
  range: TimeRange,
  newId: () => string,
) {
  const wordDups: WordTiming[] = [];
  const bgDups: WordTiming[] = [];
  const readings: { side: LanguageSide; pieces: LanguagePieces }[] = [];
  for (const selection of forLine) {
    const word = trackWords(line, selection.type)?.[selection.wordIndex];
    if (!word) continue;
    const newBegin = Math.max(range.min, word.begin + timeDelta);
    const newEnd = Math.min(range.max, word.end + timeDelta);
    if (newEnd <= newBegin) continue;
    const dup = cloneWord(word, { begin: newBegin, end: newEnd, id: newId() });
    if (selection.type === "word") wordDups.push(dup);
    else bgDups.push(dup);
    const side = languageSide(selection.type);
    const piece = pieceOf(trackPieces(line, side), word);
    if (piece) readings.push({ side, pieces: { [dup.id]: piece } });
  }
  return { wordDups, bgDups, readings };
}

const overlapsAny = (dups: readonly WordTiming[], existing: readonly WordTiming[]) =>
  dups.some((dup) => existing.some((word) => boundsOverlap(dup, word)));

// -- Functions ----------------------------------------------------------------

// Copies that land on a taken spot are dropped; a line-synced line cannot take word copies.
function planDuplicate(
  rawLines: readonly RawLine[],
  lines: readonly ReadableLine[],
  selections: readonly ResolvedAddress[],
  timeDelta: number,
  rangeOf: (line: LyricLine) => TimeRange,
  newId: () => string,
): DuplicatePlan {
  const byId = linesById(lines);
  const rawById = new Map(rawLines.map((line) => [line.id, line]));
  let rejectedLineSynced = false;
  const updates = [...byLine(selections)].flatMap(([lineId, forLine]) => {
    const line = byId.get(lineId);
    if (!line) return [];
    const { wordDups, bgDups, readings } = duplicatesFor(line, forLine, timeDelta, rangeOf(line), newId);
    const lineUpdates: Partial<LyricLine> = {};
    const existingWords = line.words ?? [];
    if (wordDups.length > 0 && !overlapsAny(wordDups, existingWords)) {
      const edit = effectiveMainWordEdit(line, mergeWordsIntoTrack(existingWords, wordDups));
      if (edit) Object.assign(lineUpdates, edit);
      else rejectedLineSynced = true;
    }
    const existingBg = line.backgroundWords ?? [];
    if (bgDups.length > 0 && !overlapsAny(bgDups, existingBg)) {
      Object.assign(lineUpdates, manualBackgroundWordEdit(mergeWordsIntoTrack(existingBg, bgDups)));
    }
    if (Object.keys(lineUpdates).length > 0 && readings.length > 0) {
      lineUpdates.languages = readings.reduce(
        (written, { side, pieces }) => withAddedPieces(written, side, pieces),
        lineUpdates.languages ?? rawById.get(lineId)?.languages,
      );
    }
    return Object.keys(lineUpdates).length > 0 ? [{ id: lineId, updates: lineUpdates }] : [];
  });
  return { updates, rejectedLineSynced };
}

// -- Commands -----------------------------------------------------------------

function moveWords(args: MoveArgs): LyricCommand {
  return lineEditCommand(
    { command: "move words", args: [args.timeDelta, ...args.addresses.map((address) => address.syllableId)] },
    (root) => {
      const lines = getEffectiveLines(root.lines);
      const rangeOf = timeRangeResolver(root.lines, root.groups, args.duration);
      return reorderUpdates(lines, resolveAddresses(lines, args.addresses), args.timeDelta, rangeOf);
    },
    OWN_LINE_ONLY,
  );
}

// Across lines, and across tracks of one line: neither propagates to linked copies.
function moveWordsAcrossLines(args: CrossLineMoveArgs): LyricCommand {
  return lineEditCommand(
    {
      command: "move words across lines",
      args: [args.targetLineId, args.targetTrack, args.timeDelta, ...args.addresses.map((a) => a.syllableId)],
    },
    (root) => {
      const lines = getEffectiveLines(root.lines);
      const rangeOf = timeRangeResolver(root.lines, root.groups, args.duration);
      const moves = crossLineMoves(lines, resolveAddresses(lines, args.addresses), args, rangeOf);
      if (moves.length === 0) return [];
      const result = applyWordMoveAcrossLines(lines, moves, rangeOf);
      if (!result.ok) return refused({ reason: "move", reject: result.reject });
      return withMovedPieces(root.lines, lines, moves, result.updates);
    },
    OWN_LINE_ONLY,
  );
}

// `report` receives the committed plan, so the caller never plans a second time.
function duplicateWords(args: MoveArgs, report?: (plan: DuplicatePlan) => void): LyricCommand {
  return lineEditCommand(
    { command: "duplicate words", args: [args.timeDelta, ...args.addresses.map((address) => address.syllableId)] },
    (root, ctx) => {
      const lines = getEffectiveLines(root.lines);
      const rangeOf = timeRangeResolver(root.lines, root.groups, args.duration);
      const plan = planDuplicate(
        root.lines,
        lines,
        resolveAddresses(lines, args.addresses),
        args.timeDelta,
        rangeOf,
        ctx.newId,
      );
      report?.(plan);
      return plan.updates;
    },
    OWN_LINE_ONLY,
  );
}

// -- Exports ------------------------------------------------------------------

export { duplicateWords, moveWords, moveWordsAcrossLines };
