import { isSharedLine, type TimeRange } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
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
  groups: readonly LinkGroup[];
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

type StepKeyOutcome = { kind: "refused"; refusal: StepRefusal } | { kind: "written"; endedPrevious?: string };

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

// A start written in another instance of the same shared group would copy back over the cursor's own instance.
function crossesSharedInstance(input: StepKeyWriteInput, startNext: WordSelection): boolean {
  const from = input.lines[input.cursor.lineIndex];
  const to = input.lines[startNext.lineIndex];
  if (!from || !to || from.groupId !== to.groupId || from.instanceIdx === to.instanceIdx) return false;
  const groupsById = new Map(input.groups.map((group) => [group.id, group]));
  return isSharedLine(from, groupsById) && isSharedLine(to, groupsById);
}

// -- Functions ----------------------------------------------------------------

// A step that also starts a word on another line lands both lines in one undo step.
function writeStepKey(input: StepKeyWriteInput): StepKeyOutcome | null {
  const { cursor, key } = input;
  const startNext = input.startNext && !crossesSharedInstance(input, input.startNext) ? input.startNext : null;
  const inTrack = startNext?.lineId === cursor.lineId && startNext.type === cursor.type;
  const ownKey = key !== "step" || inTrack ? key : "end";
  const own = editAt(input, cursor, ownKey);
  if (!own) return null;
  if (own.kind === "refused") return own;
  const updates = [own.update];
  if (key === "step" && startNext && !inTrack) {
    const started = editAt(input, startNext, "start");
    if (started?.kind === "refused") return started;
    if (started) updates.push(started.update);
  }
  input.updateLinesWithHistory(updates, { deriveText: false, propagateToSiblings: false });
  return { kind: "written", endedPrevious: own.endedPrevious };
}

// -- Exports ------------------------------------------------------------------

export { writeStepKey };
