import { nextFrame } from "@/lib/frame-loop";

// -- Constants ----------------------------------------------------------------

const QUIET_FRAMES = 6;
const MAX_SETTLE_FRAMES = 300;

// -- Helpers ------------------------------------------------------------------

function stepFrame(): Promise<void> {
  return new Promise((resolve) => {
    nextFrame(() => resolve());
  });
}

async function stepFrames(count: number): Promise<void> {
  for (let stepped = 0; stepped < count; stepped++) await stepFrame();
}

async function settleFrames(readFrameCount: () => number): Promise<number> {
  let quietFrames = 0;
  let lastCount = readFrameCount();
  for (let stepped = 0; stepped < MAX_SETTLE_FRAMES; stepped++) {
    await stepFrame();
    const currentCount = readFrameCount();
    if (currentCount !== lastCount) {
      quietFrames = 0;
      lastCount = currentCount;
      continue;
    }
    quietFrames += 1;
    if (quietFrames >= QUIET_FRAMES) return lastCount;
  }
  throw new Error(`frame loop did not quiesce within ${MAX_SETTLE_FRAMES} frames`);
}

// -- Exports ------------------------------------------------------------------

export { settleFrames, stepFrames };
