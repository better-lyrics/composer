import { vi } from "vitest";

// -- Types --------------------------------------------------------------------

type FrameLoopModule = typeof import("@/lib/frame-loop");

// -- Constants ----------------------------------------------------------------

const FRAME_MS = 16;

// -- Helpers ------------------------------------------------------------------

async function loadFrameLoop(): Promise<FrameLoopModule> {
  vi.resetModules();
  vi.useFakeTimers();
  return import("@/lib/frame-loop");
}

function advanceFrames(count: number): void {
  vi.advanceTimersByTime(FRAME_MS * count);
}

// -- Exports ------------------------------------------------------------------

export { advanceFrames, loadFrameLoop };
export type { FrameLoopModule };
