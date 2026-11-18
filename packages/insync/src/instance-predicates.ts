import type { LyricLine } from "./line";

// -- Types --------------------------------------------------------------------

type LinkedLine = LyricLine & { groupId: string; instanceIdx: number };

// A line that follows its group's template at one template line.
type SlotLine = LinkedLine & { templateLineIdx: number };

// -- Predicates ---------------------------------------------------------------

function isLinked(line: LyricLine): line is LinkedLine {
  return line.groupId !== undefined && line.instanceIdx !== undefined;
}

function isSlotLine(line: LyricLine | undefined): line is SlotLine {
  return !!line && isLinked(line) && line.templateLineIdx !== undefined && !line.detached;
}

function belongsToInstance(line: LyricLine, groupId: string, instanceIdx: number): boolean {
  return line.groupId === groupId && line.instanceIdx === instanceIdx;
}

function isAttachedToInstance(line: LyricLine, groupId: string, instanceIdx: number): boolean {
  return belongsToInstance(line, groupId, instanceIdx) && !line.detached;
}

// -- Exports ------------------------------------------------------------------

export type { LinkedLine, SlotLine };
export { belongsToInstance, isAttachedToInstance, isLinked, isSlotLine };
