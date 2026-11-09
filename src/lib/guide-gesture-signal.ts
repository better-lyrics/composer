import type { GuideSignal } from "@/domain/guide/model";
import { noteGuideSignal } from "@/lib/guide-signals";

// -- Constants ----------------------------------------------------------------

const GESTURE_GAP_MS = 1000;

// -- State --------------------------------------------------------------------

const lastEventAt = new Map<GuideSignal, number>();

// -- API ----------------------------------------------------------------------

// For wheel, drag and slider handlers: one signal per gesture, not one per event.
function noteGuideGesture(signal: GuideSignal): void {
  const now = performance.now();
  const last = lastEventAt.get(signal) ?? Number.NEGATIVE_INFINITY;
  lastEventAt.set(signal, now);
  if (now - last > GESTURE_GAP_MS) noteGuideSignal(signal);
}

// -- Exports ------------------------------------------------------------------

export { noteGuideGesture };
