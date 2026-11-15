import type { LyricCommand } from "@/domain/commands/command";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { refused } from "@/domain/commands/outcome";
import { type TimeRange, timeRangeResolver } from "insync/group-shared-timing";
import type { LanguagePieces, LanguageSide } from "insync/language";
import { languageSide, pieceOf, withAddedPieces } from "insync/language-pieces";
import { drawnPieces, drawnSyllables } from "insync/line-drawn-track";
import { manualBackgroundWordEdit } from "insync/line-lane-word-edits";
import type { LineUpdate, LyricLine } from "insync/line";
import { trackRole, type WordTrack, untimedSyllablesOf } from "insync/line-track";
import { mainTimingEdit } from "insync/line-track-writes";
import type { SyllableAddress } from "insync/selection-model";
import { type ResolvedAddress, resolveAddresses } from "insync/selection-resolve";
import { mergeWordsIntoTrack } from "@/domain/word/merge-track";
import { type WordMove, applyWordMoveAcrossLines } from "@/domain/word/move-across-lines";
import { boundsOverlap } from "insync/word-overlap";
import { reorderWordTrack } from "@/domain/word/reorder-track";
import type { WordTiming } from "insync/word-timing";
import { cloneWord } from "insync/word-clone";

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

function linesById(lines: readonly LyricLine[]): Map<string, LyricLine> {
  return new Map(lines.map((line) => [line.id, line]));
}

function reorderUpdates(
  lines: readonly LyricLine[],
  selections: readonly ResolvedAddress[],
  timeDelta: number,
  rangeOf: (line: LyricLine) => TimeRange,
  splitChar: string,
): LineUpdate[] {
  const byId = linesById(lines);
  return [...byLine(selections)].flatMap(([lineId, forLine]) => {
    const line = byId.get(lineId);
    if (!line) return [];
    const lineUpdates: Partial<LyricLine> = {};
    const range = rangeOf(line);
    const wordIndices = new Set(forLine.flatMap((s) => (s.type === "word" ? [s.wordIndex] : [])));
    const bgIndices = new Set(forLine.flatMap((s) => (s.type === "bg" ? [s.wordIndex] : [])));
    const mainWords = drawnSyllables(line, "main", splitChar);
    if (wordIndices.size > 0 && mainWords.length > 0) {
      const edit = mainTimingEdit(line, reorderWordTrack(mainWords, wordIndices, timeDelta, range));
      if (edit) Object.assign(lineUpdates, edit);
    }
    const bgWords = drawnSyllables(line, "bg", splitChar);
    if (bgIndices.size > 0 && bgWords.length > 0) {
      const reordered = reorderWordTrack(bgWords, bgIndices, timeDelta, range);
      Object.assign(lineUpdates, manualBackgroundWordEdit(line, reordered, splitChar, lineUpdates));
    }
    return Object.keys(lineUpdates).length > 0 ? [{ id: lineId, updates: lineUpdates }] : [];
  });
}

function crossLineMoves(
  lines: readonly LyricLine[],
  selections: readonly ResolvedAddress[],
  args: CrossLineMoveArgs,
  rangeOf: (line: LyricLine) => TimeRange,
  splitChar: string,
): WordMove[] {
  const byId = linesById(lines);
  const targetLine = byId.get(args.targetLineId);
  if (!targetLine) return [];
  const targetRange = rangeOf(targetLine);
  return selections.flatMap((selection) => {
    if (selection.lineId !== args.fromLineId) return [];
    const sourceLine = byId.get(selection.lineId);
    const source = sourceLine && drawnSyllables(sourceLine, trackRole(selection.type), splitChar)[selection.wordIndex];
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
  lines: readonly LyricLine[],
  moves: readonly WordMove[],
  updates: LineUpdate[],
  splitChar: string,
): LineUpdate[] {
  const byId = linesById(lines);
  return updates.map((update) => {
    const carried = moves.flatMap((move) => {
      const source = move.targetLineId === update.id ? byId.get(move.sourceLineId) : undefined;
      const piece = source && pieceOf(drawnPieces(source, languageSide(move.sourceTrack), splitChar), move.word);
      return piece ? [{ side: languageSide(move.targetTrack), pieces: { [move.word.id]: piece } }] : [];
    });
    if (!carried.length) return update;
    const languages = carried.reduce(
      (written, { side, pieces }) => withAddedPieces(written, side, pieces),
      update.updates.languages ?? byId.get(update.id)?.languages,
    );
    return { id: update.id, updates: { ...update.updates, languages } };
  });
}

function duplicatesFor(
  line: LyricLine,
  forLine: readonly ResolvedAddress[],
  timeDelta: number,
  range: TimeRange,
  newId: () => string,
  splitChar: string,
) {
  const wordDups: WordTiming[] = [];
  const bgDups: WordTiming[] = [];
  const readings: { side: LanguageSide; pieces: LanguagePieces }[] = [];
  for (const selection of forLine) {
    const word = drawnSyllables(line, trackRole(selection.type), splitChar)[selection.wordIndex];
    if (!word) continue;
    const newBegin = Math.max(range.min, word.begin + timeDelta);
    const newEnd = Math.min(range.max, word.end + timeDelta);
    if (newEnd <= newBegin) continue;
    const dup = cloneWord(word, { begin: newBegin, end: newEnd, id: newId() });
    if (selection.type === "word") wordDups.push(dup);
    else bgDups.push(dup);
    const side = languageSide(selection.type);
    const piece = pieceOf(drawnPieces(line, side, splitChar), word);
    if (piece) readings.push({ side, pieces: { [dup.id]: piece } });
  }
  return { wordDups, bgDups, readings };
}

const overlapsAny = (dups: readonly WordTiming[], existing: readonly WordTiming[]) =>
  dups.some((dup) => existing.some((word) => boundsOverlap(dup, word)));

// -- Functions ----------------------------------------------------------------

// Copies that land on a taken spot are dropped; a line-synced line cannot take word copies.
function planDuplicate(
  lines: readonly LyricLine[],
  selections: readonly ResolvedAddress[],
  timeDelta: number,
  rangeOf: (line: LyricLine) => TimeRange,
  newId: () => string,
  splitChar: string,
): DuplicatePlan {
  const byId = linesById(lines);
  let rejectedLineSynced = false;
  const updates = [...byLine(selections)].flatMap(([lineId, forLine]) => {
    const line = byId.get(lineId);
    if (!line) return [];
    const { wordDups, bgDups, readings } = duplicatesFor(line, forLine, timeDelta, rangeOf(line), newId, splitChar);
    const lineUpdates: Partial<LyricLine> = {};
    const existingWords = drawnSyllables(line, "main", splitChar);
    if (wordDups.length > 0 && !overlapsAny(wordDups, existingWords)) {
      const edit = mainTimingEdit(line, mergeWordsIntoTrack(existingWords, wordDups, untimedSyllablesOf(line, "main")));
      if (edit) Object.assign(lineUpdates, edit);
      else rejectedLineSynced = true;
    }
    const existingBg = drawnSyllables(line, "bg", splitChar);
    if (bgDups.length > 0 && !overlapsAny(bgDups, existingBg)) {
      Object.assign(
        lineUpdates,
        manualBackgroundWordEdit(
          line,
          mergeWordsIntoTrack(existingBg, bgDups, untimedSyllablesOf(line, "bg")),
          splitChar,
          lineUpdates,
        ),
      );
    }
    if (Object.keys(lineUpdates).length > 0 && readings.length > 0) {
      lineUpdates.languages = readings.reduce(
        (written, { side, pieces }) => withAddedPieces(written, side, pieces),
        lineUpdates.languages ?? line.languages,
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
    (root, ctx) => {
      const { lines } = root;
      const rangeOf = timeRangeResolver(root.lines, root.groups, args.duration);
      return reorderUpdates(
        lines,
        resolveAddresses(lines, args.addresses, ctx.splitChar),
        args.timeDelta,
        rangeOf,
        ctx.splitChar,
      );
    },
  );
}

// Across lines, and across tracks of one line. `report` receives the group lines the move made their instance's own.
function moveWordsAcrossLines(
  args: CrossLineMoveArgs,
  report?: (detachedIds: readonly string[]) => void,
): LyricCommand {
  return lineEditCommand(
    {
      command: "move words across lines",
      args: [args.targetLineId, args.targetTrack, args.timeDelta, ...args.addresses.map((a) => a.syllableId)],
    },
    (root, ctx) => {
      const { lines } = root;
      const rangeOf = timeRangeResolver(root.lines, root.groups, args.duration);
      const moves = crossLineMoves(
        lines,
        resolveAddresses(lines, args.addresses, ctx.splitChar),
        args,
        rangeOf,
        ctx.splitChar,
      );
      if (moves.length === 0) return [];
      const result = applyWordMoveAcrossLines(lines, moves, rangeOf, ctx.splitChar);
      if (!result.ok) return refused({ reason: "move", reject: result.reject });
      report?.(result.detachedIds);
      return withMovedPieces(lines, moves, result.updates, ctx.splitChar);
    },
  );
}

// `report` receives the committed plan, so the caller never plans a second time.
function duplicateWords(args: MoveArgs, report?: (plan: DuplicatePlan) => void): LyricCommand {
  return lineEditCommand(
    { command: "duplicate words", args: [args.timeDelta, ...args.addresses.map((address) => address.syllableId)] },
    (root, ctx) => {
      const { lines } = root;
      const rangeOf = timeRangeResolver(root.lines, root.groups, args.duration);
      const plan = planDuplicate(
        lines,
        resolveAddresses(lines, args.addresses, ctx.splitChar),
        args.timeDelta,
        rangeOf,
        ctx.newId,
        ctx.splitChar,
      );
      report?.(plan);
      return plan.updates;
    },
  );
}

// -- Exports ------------------------------------------------------------------

export { duplicateWords, moveWords, moveWordsAcrossLines };
