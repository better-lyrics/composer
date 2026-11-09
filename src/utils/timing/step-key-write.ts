import type { TimeRange } from "@/domain/group/shared-timing";
import type { ReadableLine } from "@/domain/line/effective-words";
import type { LineUpdate } from "@/domain/line/model";
import type { WordSelection } from "@/domain/selection/model";
import type { StepKey, StepRefusal } from "@/domain/step-timing/step-write";
import { stepBgWordEdit } from "@/utils/timing/bg-word-timing";
import { stepWordEdit } from "@/utils/timing/word-timing";
import type { StepEdit } from "@/utils/timing/word-timing-ops";

// -- Types --------------------------------------------------------------------

interface StepKeyWriteInput {
  lines: readonly ReadableLine[];
  cursor: WordSelection;
  startNext: WordSelection | null;
  key: StepKey;
  time: number;
  minDuration: number;
  rangeOf: (line: ReadableLine) => TimeRange;
  updateLinesWithHistory: (
    updates: LineUpdate[],
    options?: { deriveText?: boolean; propagateToSiblings?: boolean },
  ) => void;
}

// -- Helpers ------------------------------------------------------------------

function editAt(input: StepKeyWriteInput, slot: WordSelection, key: StepKey): StepEdit {
  const line = input.lines[slot.lineIndex];
  if (!line) return null;
  const edit = slot.type === "word" ? stepWordEdit : stepBgWordEdit;
  return edit({
    lines: input.lines,
    lineIdx: slot.lineIndex,
    wordIdx: slot.wordIndex,
    key,
    time: input.time,
    minDuration: input.minDuration,
    range: input.rangeOf(line),
  });
}

// -- Functions ----------------------------------------------------------------

// A step that also starts a word on another line lands both lines in one undo step.
function writeStepKey(input: StepKeyWriteInput): StepRefusal | null {
  const { cursor, startNext, key } = input;
  const inTrack = startNext?.lineId === cursor.lineId && startNext.type === cursor.type;
  const ownKey = key !== "step" || inTrack ? key : "end";
  const own = editAt(input, cursor, ownKey);
  if (!own) return null;
  if (own.kind === "refused") return own.refusal;
  const updates = [own.update];
  if (key === "step" && startNext && !inTrack) {
    const started = editAt(input, startNext, "start");
    if (started?.kind === "refused") return started.refusal;
    if (started) updates.push(started.update);
  }
  input.updateLinesWithHistory(updates, { deriveText: false, propagateToSiblings: false });
  return null;
}

// -- Exports ------------------------------------------------------------------

export { writeStepKey };
