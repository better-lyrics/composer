import { isSharedLine, type TimeRange } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { combinedTrackEdits } from "@/domain/line/combined-track-edits";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import type { ResolvedAddress } from "@/domain/selection/resolve";
import type { StepKey, StepRefusal } from "@/domain/step-timing/step-write";
import { stepBgWordEdit } from "@/utils/timing/bg-word-timing";
import { stepWordEdit } from "@/utils/timing/word-timing";
import type { StepEdit } from "@/utils/timing/word-timing-ops";

// -- Types --------------------------------------------------------------------

interface StepKeyWriteInput {
  lines: readonly LyricLine[];
  groups: readonly LinkGroup[];
  cursor: ResolvedAddress;
  startNext: ResolvedAddress | null;
  key: StepKey;
  time: number;
  minDuration: number;
  rangeOf: (line: LyricLine) => TimeRange;
}

type StepKeyPlan =
  | { kind: "refused"; refusal: StepRefusal }
  | { kind: "written"; updates: LineUpdate[]; endedPrevious?: string };

// -- Helpers ------------------------------------------------------------------

function editAt(input: StepKeyWriteInput, slot: ResolvedAddress, key: StepKey): StepEdit {
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
function crossesSharedInstance(input: StepKeyWriteInput, startNext: ResolvedAddress): boolean {
  const from = input.lines[input.cursor.lineIndex];
  const to = input.lines[startNext.lineIndex];
  if (!from || !to || from.groupId !== to.groupId || from.instanceIdx === to.instanceIdx) return false;
  const groupsById = new Map(input.groups.map((group) => [group.id, group]));
  return isSharedLine(from, groupsById) && isSharedLine(to, groupsById);
}

// A start on the cursor's own line joins the end in one update, so neither track write overwrites the other.
function joinedUpdates(input: StepKeyWriteInput, own: LineUpdate, started: LineUpdate | undefined): LineUpdate[] {
  if (!started) return [own];
  if (started.id !== own.id) return [own, started];
  const line = input.lines[input.cursor.lineIndex];
  return [{ id: own.id, updates: combinedTrackEdits(line, [own.updates, started.updates]) }];
}

// -- Functions ----------------------------------------------------------------

// A step that also starts a word on another line lands both lines in one undo step.
function planStepKey(input: StepKeyWriteInput): StepKeyPlan | null {
  const { cursor, key } = input;
  const startNext = input.startNext && !crossesSharedInstance(input, input.startNext) ? input.startNext : null;
  const inTrack = startNext?.lineId === cursor.lineId && startNext.type === cursor.type;
  const ownKey = key !== "step" || inTrack ? key : "end";
  const own = editAt(input, cursor, ownKey);
  if (!own) return null;
  if (own.kind === "refused") return own;
  if (key !== "step" || !startNext || inTrack)
    return { kind: "written", updates: [own.update], endedPrevious: own.endedPrevious };
  const started = editAt(input, startNext, "start");
  if (started?.kind === "refused") return started;
  return {
    kind: "written",
    updates: joinedUpdates(input, own.update, started?.update),
    endedPrevious: own.endedPrevious,
  };
}

// -- Exports ------------------------------------------------------------------

export type { StepKeyPlan };
export { planStepKey };
