import type { TimeRange } from "@/domain/group/shared-timing";
import type { ReadableLine } from "@/domain/line/effective-words";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { applyStepKey, type StepKey, type StepRefusal } from "@/domain/step-timing/step-write";
import { type BoundaryEdge, clampBoundaryTime, shouldRollNeighbour } from "@/domain/word/boundary";
import { getSyllablePositions } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

interface WordFieldConfig {
  getWords: (line: LyricLine) => WordTiming[] | undefined;
  writeWords: (line: ReadableLine, words: WordTiming[]) => Partial<LyricLine>;
  // retimeEdit deliberately writes raw: routing it here too would newly stamp background provenance in useSyncHandlers.
  buildBoundaryUpdate?: (line: ReadableLine, words: WordTiming[]) => Partial<LyricLine>;
}

type RetimeChange = { by: number } | { to: number };

interface RetimeEditInput {
  line: ReadableLine;
  wordIdx: number;
  edge: BoundaryEdge;
  change: RetimeChange;
  range: TimeRange;
}

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
    buildBoundaryUpdate ? buildBoundaryUpdate(line, words) : writeWords(line, words);

  // A Sync nudge or typed time: one edge of one word, kept between its neighbours and inside the range.
  function retimeEdit({ line, wordIdx, edge, change, range }: RetimeEditInput): LineUpdate | null {
    const words = getWords(line);
    const word = words?.[wordIdx];
    if (!words || !word) return null;
    const updatedWords = [...words];
    if (edge === "begin") {
      const candidate = "by" in change ? word.begin + change.by : change.to;
      const minBegin = words[wordIdx - 1]?.end ?? range.min;
      updatedWords[wordIdx] = { ...word, begin: Math.min(word.end, Math.max(minBegin, candidate)) };
    } else {
      const candidate = "by" in change ? word.end + change.by : change.to;
      const maxEnd = words[wordIdx + 1]?.begin ?? range.max;
      updatedWords[wordIdx] = { ...word, end: Math.min(maxEnd, Math.max(word.begin, candidate)) };
    }
    return { id: line.id, updates: writeWords(line, updatedWords) };
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

  return { retimeEdit, boundaryEdit, stepEdit };
}

// -- Exports -------------------------------------------------------------------

export type { RetimeChange, StepEdit };
export { createWordTimingOps };
