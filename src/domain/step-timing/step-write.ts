import type { TimeRange } from "@/domain/group/shared-timing";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

type StepKey = "start" | "step" | "end";

type StepRefusal = { reason: "beforePrevious"; previousWord: string } | { reason: "songStart" } | { reason: "noRoom" };

type StepWrite = { kind: "written"; words: WordTiming[] } | { kind: "refused"; refusal: StepRefusal };

interface StepWriteInput {
  words: readonly WordTiming[];
  index: number;
  key: StepKey;
  time: number;
  minDuration: number;
  range: TimeRange;
}

// -- Helpers ------------------------------------------------------------------

const NO_ROOM: StepWrite = { kind: "refused", refusal: { reason: "noRoom" } };

function beforePrevious(previous: WordTiming): StepWrite {
  return { kind: "refused", refusal: { reason: "beforePrevious", previousWord: previous.text } };
}

function pushAhead(words: WordTiming[], from: number, floor: number, minDuration: number, max: number): boolean {
  let start = floor;
  for (let k = from; k < words.length; k++) {
    const word = words[k];
    if (word.begin >= start) return true;
    const end = Math.max(word.end, start + minDuration);
    if (end > max) return false;
    words[k] = { ...word, begin: start, end };
    if (end === word.end) return true;
    start = end;
  }
  return true;
}

function writeStart(words: WordTiming[], index: number, input: StepWriteInput): StepWrite {
  const word = words[index];
  const previous = words[index - 1];
  if (previous && input.time < previous.end) return beforePrevious(previous);
  const begin = Math.max(input.time, input.range.min);
  const end = Math.max(word.end, begin + input.minDuration);
  if (end > input.range.max) return NO_ROOM;
  words[index] = { ...word, begin, end };
  return pushAhead(words, index + 1, end, input.minDuration, input.range.max) ? { kind: "written", words } : NO_ROOM;
}

function writeEnd(words: WordTiming[], index: number, input: StepWriteInput): StepWrite {
  const word = words[index];
  const previous = words[index - 1];
  const end = Math.min(input.time, input.range.max);
  let begin = word.begin;
  if (end < begin + input.minDuration) {
    begin = end - input.minDuration;
    if (previous && begin < previous.end) return beforePrevious(previous);
    if (begin < input.range.min) return { kind: "refused", refusal: { reason: "songStart" } };
  }
  words[index] = { ...word, begin, end };
  return pushAhead(words, index + 1, end, input.minDuration, input.range.max) ? { kind: "written", words } : NO_ROOM;
}

// -- Functions ----------------------------------------------------------------

function applyStepKey(input: StepWriteInput): StepWrite {
  const words = [...input.words];
  const { index, key } = input;
  if (!words[index]) return NO_ROOM;
  if (key === "start") return writeStart(words, index, input);
  if (key === "end" || index === words.length - 1) return writeEnd(words, index, input);
  const ended = writeEnd(words, index, input);
  if (ended.kind === "refused") return ended;
  const begin = words[index].end;
  const next = words[index + 1];
  const end = Math.max(next.end, begin + input.minDuration);
  if (end > input.range.max) return NO_ROOM;
  words[index + 1] = { ...next, begin, end };
  return pushAhead(words, index + 2, end, input.minDuration, input.range.max) ? { kind: "written", words } : NO_ROOM;
}

// -- Exports ------------------------------------------------------------------

export type { StepKey, StepRefusal, StepWrite };
export { applyStepKey };
