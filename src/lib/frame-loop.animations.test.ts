import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advanceFrames, type FrameLoopModule, loadFrameLoop } from "@/test/frame-loop-harness";

// -- Harness ------------------------------------------------------------------

let frameLoop: FrameLoopModule;
let calls = 0;
let unsubscribe: (() => void) | null = null;
let errorSpy: ReturnType<typeof vi.spyOn>;

function framesUntilQuiet(): number {
  advanceFrames(frameLoop.TAIL_FRAMES);
  const settled = calls;
  advanceFrames(200);
  return calls - settled;
}

beforeEach(async () => {
  frameLoop = await loadFrameLoop();
  calls = 0;
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  unsubscribe = frameLoop.subscribeFrame(() => {
    calls += 1;
  }, "probe");
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = null;
  errorSpy.mockRestore();
  vi.useRealTimers();
});

// -- Tests --------------------------------------------------------------------

describe("animateFrames", () => {
  it("keeps the loop running for as long as the animation is held", () => {
    const release = frameLoop.animateFrames("resume-backdrop");
    advanceFrames(900);
    expect(calls).toBe(900);
    release();
  });

  it("lets the loop idle after the tail once released", () => {
    const release = frameLoop.animateFrames("resume-backdrop");
    advanceFrames(10);
    release();
    expect(framesUntilQuiet()).toBe(0);
  });

  describe("regressions", () => {
    it("regression: an animation held for thousands of idle frames is never reported as a stale hold", () => {
      const release = frameLoop.animateFrames("resume-backdrop");
      advanceFrames(3000);
      expect(errorSpy).not.toHaveBeenCalled();
      release();
    });

    it("regression: a leaked holdFrames next to an animation is still reported", () => {
      const releaseAnimation = frameLoop.animateFrames("resume-backdrop");
      const releaseHold = frameLoop.holdFrames("drag");
      advanceFrames(3000);
      const messages = errorSpy.mock.calls.map((args: unknown[]) => String(args[0]));
      expect(messages.some((message: string) => message.includes("drag"))).toBe(true);
      releaseHold();
      releaseAnimation();
    });
  });

  describe("invariants", () => {
    it("counts references per label and ignores a second release", () => {
      const first = frameLoop.animateFrames("resume-backdrop");
      const second = frameLoop.animateFrames("resume-backdrop");
      first();
      first();
      advanceFrames(30);
      expect(calls).toBe(30);
      second();
      expect(framesUntilQuiet()).toBe(0);
    });
  });
});
