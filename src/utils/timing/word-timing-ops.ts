import { type TimeRange, timeRangeResolver } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import type { ReadableLine } from "@/domain/line/effective-words";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { applyStepKey, type StepKey, type StepRefusal } from "@/domain/step-timing/step-write";
import { type BoundaryEdge, clampBoundaryTime, shouldRollNeighbour } from "@/domain/word/boundary";
import { getSyllablePositions } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

type UpdateLineWithHistory = (
  id: string,
  updates: Partial<LyricLine>,
  options?: { deriveText?: boolean; propagateToSiblings?: boolean },
) => void;

interface WordFieldConfig {
  getWords: (line: LyricLine) => WordTiming[] | undefined;
  writeWords: (line: ReadableLine, words: WordTiming[]) => Partial<LyricLine>;
  // mutateWord deliberately writes raw: routing it here too would newly stamp background provenance in useSyncHandlers.
  buildBoundaryUpdate?: (words: WordTiming[]) => Partial<LyricLine>;
}

interface NeighborContext {
  word: WordTiming;
  prevWord: WordTiming | undefined;
  nextWord: WordTiming | undefined;
  range: TimeRange;
}

type WordMutator = (ctx: NeighborContext) => WordTiming;

interface BoundaryEditInput {
  line: ReadableLine;
  wordIdx: number;
  edge: BoundaryEdge;
  time: number;
  minDuration: number;
  rolling: boolean;
  syllablesFollowRolling: boolean;
  range?: TimeRange;
}

interface StepEditInput {
  lines: readonly ReadableLine[];
  lineIdx: number;
  wordIdx: number;
  key: StepKey;
  time: number;
  minDuration: number;
  range: TimeRange;
}

type StepEdit =
  | { kind: "written"; update: LineUpdate; endedPrevious?: string }
  | { kind: "refused"; refusal: StepRefusal }
  | null;

// -- Factory ------------------------------------------------------------------

function createWordTimingOps(config: WordFieldConfig) {
  const { getWords, writeWords, buildBoundaryUpdate } = config;
  const boundaryUpdate = (line: ReadableLine, words: WordTiming[]) =>
    buildBoundaryUpdate ? buildBoundaryUpdate(words) : writeWords(line, words);

  function mutateWord(
    lines: readonly ReadableLine[],
    lineIdx: number,
    wordIdx: number,
    updateLineWithHistory: UpdateLineWithHistory,
    groups: readonly LinkGroup[],
    duration: number,
    mutator: WordMutator,
  ): void {
    const line = lines[lineIdx];
    if (!line) return;
    const words = getWords(line);
    if (!words?.[wordIdx]) return;

    const updatedWords = [...words];
    const word = updatedWords[wordIdx];
    const range = timeRangeResolver(lines, groups, duration)(line);
    updatedWords[wordIdx] = mutator({
      word,
      prevWord: updatedWords[wordIdx - 1],
      nextWord: updatedWords[wordIdx + 1],
      range,
    });

    updateLineWithHistory(line.id, writeWords(line, updatedWords), {
      deriveText: false,
      propagateToSiblings: false,
    });
  }

  function clampBegin({ word, prevWord, range }: NeighborContext, candidate: number): WordTiming {
    const minBegin = prevWord?.end ?? range.min;
    return { ...word, begin: Math.min(word.end, Math.max(minBegin, candidate)) };
  }

  function clampEnd({ word, nextWord, range }: NeighborContext, candidate: number): WordTiming {
    const maxEnd = nextWord?.begin ?? range.max;
    return { ...word, end: Math.min(maxEnd, Math.max(word.begin, candidate)) };
  }

  function nudgeBegin(
    lines: readonly ReadableLine[],
    lineIdx: number,
    wordIdx: number,
    delta: number,
    updateLineWithHistory: UpdateLineWithHistory,
    groups: readonly LinkGroup[] = [],
    duration = Number.POSITIVE_INFINITY,
  ): void {
    mutateWord(lines, lineIdx, wordIdx, updateLineWithHistory, groups, duration, (ctx) =>
      clampBegin(ctx, ctx.word.begin + delta),
    );
  }

  function setBegin(
    lines: readonly ReadableLine[],
    lineIdx: number,
    wordIdx: number,
    newBegin: number,
    updateLineWithHistory: UpdateLineWithHistory,
    groups: readonly LinkGroup[] = [],
    duration = Number.POSITIVE_INFINITY,
  ): void {
    mutateWord(lines, lineIdx, wordIdx, updateLineWithHistory, groups, duration, (ctx) => clampBegin(ctx, newBegin));
  }

  function nudgeEnd(
    lines: readonly ReadableLine[],
    lineIdx: number,
    wordIdx: number,
    delta: number,
    updateLineWithHistory: UpdateLineWithHistory,
    groups: readonly LinkGroup[] = [],
    duration = Number.POSITIVE_INFINITY,
  ): void {
    mutateWord(lines, lineIdx, wordIdx, updateLineWithHistory, groups, duration, (ctx) =>
      clampEnd(ctx, ctx.word.end + delta),
    );
  }

  function setEnd(
    lines: readonly ReadableLine[],
    lineIdx: number,
    wordIdx: number,
    newEnd: number,
    updateLineWithHistory: UpdateLineWithHistory,
    groups: readonly LinkGroup[] = [],
    duration = Number.POSITIVE_INFINITY,
  ): void {
    mutateWord(lines, lineIdx, wordIdx, updateLineWithHistory, groups, duration, (ctx) => clampEnd(ctx, newEnd));
  }

  function boundaryEdit({
    line,
    wordIdx,
    edge,
    time,
    minDuration,
    rolling,
    syllablesFollowRolling,
    range,
  }: BoundaryEditInput): LineUpdate | null {
    const words = getWords(line);
    if (!words?.[wordIdx]) return null;

    const rollNeighbour = shouldRollNeighbour({
      words,
      wordIndex: wordIdx,
      edge,
      rollingEdit: rolling,
      syllablesFollowRolling,
      syllablePositions: getSyllablePositions(words),
    });
    const clamped = clampBoundaryTime({ words, wordIndex: wordIdx, edge, time, minDuration, rollNeighbour, range });
    const updatedWords = [...words];
    const word = updatedWords[wordIdx];

    if (edge === "begin") {
      const prev: WordTiming | undefined = updatedWords[wordIdx - 1];
      updatedWords[wordIdx] = { ...word, begin: clamped };
      if (rollNeighbour && prev) updatedWords[wordIdx - 1] = { ...prev, end: clamped };
    } else {
      const next: WordTiming | undefined = updatedWords[wordIdx + 1];
      updatedWords[wordIdx] = { ...word, end: clamped };
      if (rollNeighbour && next) updatedWords[wordIdx + 1] = { ...next, begin: clamped };
    }

    return { id: line.id, updates: boundaryUpdate(line, updatedWords) };
  }

  function stepEdit({ lines, lineIdx, wordIdx, key, time, minDuration, range }: StepEditInput): StepEdit {
    const line = lines[lineIdx];
    const words = line ? getWords(line) : undefined;
    if (!line || !words?.[wordIdx]) return null;
    const result = applyStepKey({ words, index: wordIdx, key, time, minDuration, range });
    if (result.kind === "refused") return result;
    const update = { id: line.id, updates: boundaryUpdate(line, result.words) };
    return { kind: "written", update, endedPrevious: result.endedPrevious };
  }

  return { nudgeBegin, setBegin, nudgeEnd, setEnd, boundaryEdit, stepEdit };
}

// -- Exports -------------------------------------------------------------------

export type { StepEdit };
export { createWordTimingOps };
