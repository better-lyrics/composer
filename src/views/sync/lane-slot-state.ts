import type { SlotState } from "@/views/sync/sync-lane-word";

// -- Interfaces ---------------------------------------------------------------

interface LaneSlotInput {
  slot: number;
  slotCount: number;
  timedSlots: number;
  isCurrent: boolean;
  isLastLine: boolean;
  wordIndex: number;
  isHolding: boolean;
}

// -- Functions ----------------------------------------------------------------

function isLastTapped({ slot, slotCount, isCurrent, isLastLine, wordIndex }: LaneSlotInput): boolean {
  if (isCurrent) return wordIndex > 0 && slot === wordIndex - 1;
  return isLastLine && wordIndex === 0 && slot === slotCount - 1;
}

function laneSlotState(input: LaneSlotInput): SlotState {
  if (input.isCurrent && input.slot === input.wordIndex) return "next";
  if (!input.isHolding && isLastTapped(input)) return "lastTapped";
  return input.slot < input.timedSlots ? "timed" : "untimed";
}

// -- Exports ------------------------------------------------------------------

export { laneSlotState };
