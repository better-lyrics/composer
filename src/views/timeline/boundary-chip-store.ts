import { hasKeyboard } from "@/lib/keyboard-presence";
import { noteGuideSignal } from "@/lib/guide-signals";
import { useGuideStore } from "@/stores/guide";
import { useSettingsStore } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

interface ChipPlace {
  x: number;
  y: number;
  edgeKey: string;
}

// -- Constants ----------------------------------------------------------------

const ALT_GAP_SIGNAL = "timeline.gap";
const CHIP_LIFT_PX = 40;

// -- State --------------------------------------------------------------------

// One chip for the whole Timeline: only one boundary drag runs at a time, so word tracks share this owner.
let place: ChipPlace | null = null;
let altDown = false;
const listeners = new Set<() => void>();

// -- Helpers ------------------------------------------------------------------

function notify(): void {
  for (const listener of listeners) listener();
}

function setPlace(next: ChipPlace | null): void {
  if (next === place) return;
  place = next;
  notify();
}

// Once you have opened a gap with Alt, you know it: the chip never shows again.
function chipStillTeaching(): boolean {
  return (
    hasKeyboard() &&
    useSettingsStore.getState().showGuide &&
    useSettingsStore.getState().guideHints &&
    !useGuideStore.getState().learnedSignals.includes(ALT_GAP_SIGNAL)
  );
}

const subscribeBoundaryChip = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const boundaryChipSnapshot = () => place;
const altHeldSnapshot = () => altDown;

// -- API ----------------------------------------------------------------------

// Teaches the Alt gap during the drag itself. Placed once at drag start; it never follows the pointer.
function beginBoundaryDrag(track: HTMLElement, clientX: number, edgeKey: string): void {
  if (!chipStillTeaching()) return;
  setPlace({ x: clientX, y: track.getBoundingClientRect().top - CHIP_LIFT_PX, edgeKey });
}

function endBoundaryDrag(finished: { edgeKey: string; gapOpen: boolean } | null): void {
  setPlace(null);
  if (!finished) return;
  noteGuideSignal(finished.gapOpen ? ALT_GAP_SIGNAL : "timeline.syllablesMovedTogether", finished.edgeKey);
}

// Alt is often pressed before the drag starts, so the key is tracked all along and only re-renders while the chip shows.
function noteAltKey(event: KeyboardEvent): void {
  if (altDown === event.altKey) return;
  altDown = event.altKey;
  if (place) notify();
}

// -- Exports ------------------------------------------------------------------

export { altHeldSnapshot, beginBoundaryDrag, boundaryChipSnapshot, endBoundaryDrag, noteAltKey, subscribeBoundaryChip };
