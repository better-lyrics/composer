import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advanceFrames, type FrameLoopModule, loadFrameLoop } from "@/test/frame-loop-harness";

let frameLoop: FrameLoopModule;

beforeEach(async () => {
  frameLoop = await loadFrameLoop();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("frameTime", () => {
  it("gives every subscriber the frame's own timestamp, in both phases", () => {
    const seen: number[] = [];
    const frameStamps: number[] = [];
    const unsubscribe = frameLoop.subscribeFrame(
      {
        read: (now) => {
          frameStamps.push(now);
          seen.push(frameLoop.frameTime());
        },
        write: () => seen.push(frameLoop.frameTime()),
      },
      "probe",
    );
    advanceFrames(1);
    expect(seen).toEqual([frameStamps[0], frameStamps[0]]);
    unsubscribe();
  });

  it("reads the wall clock outside a frame", () => {
    advanceFrames(3);
    expect(frameLoop.frameTime()).toBe(performance.now());
  });
});
