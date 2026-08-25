import { subscribeFrame } from "@/lib/frame-loop";
import { settleFrames } from "@/test/frame-steps";

// -- Interfaces ---------------------------------------------------------------

interface FrameProbe {
  count: () => number;
  quiesce: () => Promise<void>;
  wokeAfter: (trigger: () => void) => Promise<boolean>;
  dispose: () => void;
}

// -- Helpers ------------------------------------------------------------------

function createFrameProbe(): FrameProbe {
  let frames = 0;
  const unsubscribe = subscribeFrame(() => {
    frames += 1;
  }, "frame-probe");

  const count = () => frames;

  const quiesce = async () => {
    await settleFrames(count);
    frames = 0;
  };

  return {
    count,
    quiesce,
    wokeAfter: async (trigger) => {
      await quiesce();
      trigger();
      await settleFrames(count);
      return frames > 0;
    },
    dispose: unsubscribe,
  };
}

// -- Exports ------------------------------------------------------------------

export { createFrameProbe };
export type { FrameProbe };
