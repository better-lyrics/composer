// -- Types ---------------------------------------------------------------------

type WheelAction = { kind: "zoom" } | { kind: "scrub" } | { kind: "scroll"; axis: "x" | "y" } | { kind: "native" };

interface WheelDecisionInput {
  deltaX: number;
  deltaY: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  overWaveform: boolean;
  horizontalScrollSetting: boolean;
}

// -- Functions -----------------------------------------------------------------

function decideWheelAction(input: WheelDecisionInput): WheelAction {
  if (input.ctrlKey || input.metaKey) return { kind: "zoom" };
  if (input.overWaveform) return { kind: "scrub" };
  if (input.horizontalScrollSetting) {
    if (Math.abs(input.deltaX) > Math.abs(input.deltaY)) return { kind: "native" };
    return { kind: "scroll", axis: input.shiftKey ? "y" : "x" };
  }
  return { kind: "native" };
}

function computeScrubTime(currentTime: number, deltaY: number, zoom: number, duration: number): number {
  if (zoom <= 0) return currentTime;
  const next = currentTime + deltaY / zoom;
  return Math.max(0, Math.min(duration, next));
}

// -- Exports -------------------------------------------------------------------

export { decideWheelAction, computeScrubTime };
export type { WheelAction };
