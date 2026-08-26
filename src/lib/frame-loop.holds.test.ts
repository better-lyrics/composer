import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advanceFrames, type FrameLoopModule, loadFrameLoop } from "@/test/frame-loop-harness";

// -- Harness ------------------------------------------------------------------

let subscribeFrame: FrameLoopModule["subscribeFrame"];
let holdFrames: FrameLoopModule["holdFrames"];
let tailFrames: number;
let calls = 0;
let unsubscribe: (() => void) | null = null;

function framesUntilQuiet(): number {
  advanceFrames(tailFrames);
  const settled = calls;
  advanceFrames(200);
  return calls - settled;
}

beforeEach(async () => {
  const frameLoop = await loadFrameLoop();
  subscribeFrame = frameLoop.subscribeFrame;
  holdFrames = frameLoop.holdFrames;
  tailFrames = frameLoop.TAIL_FRAMES;
  calls = 0;
  unsubscribe = subscribeFrame(() => {
    calls += 1;
  }, "probe");
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = null;
  vi.useRealTimers();
});

// -- Tests --------------------------------------------------------------------

describe("holdFrames", () => {
  describe("happy path", () => {
    it("keeps the loop running for as long as the hold is held", () => {
      const release = holdFrames("marquee-scroll");
      advanceFrames(600);
      expect(calls).toBe(600);
      release();
    });

    it("lets the loop quiesce after the tail once released", () => {
      const release = holdFrames("marquee-scroll");
      advanceFrames(10);
      release();
      expect(framesUntilQuiet()).toBe(0);
    });
  });

  describe("reference counting", () => {
    it("keeps the loop alive while a second holder of the same label remains", () => {
      const releaseFirst = holdFrames("drag");
      const releaseSecond = holdFrames("drag");
      advanceFrames(10);
      releaseFirst();
      advanceFrames(30);
      expect(calls).toBe(40);
      releaseSecond();
      expect(framesUntilQuiet()).toBe(0);
    });

    it("keeps the loop alive while a holder of a different label remains", () => {
      const releasePlaying = holdFrames("playing");
      const releaseScroll = holdFrames("marquee-scroll");
      advanceFrames(10);
      releasePlaying();
      advanceFrames(30);
      expect(calls).toBe(40);
      releaseScroll();
      expect(framesUntilQuiet()).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("treats a repeated release of the same handle as a no-op", () => {
      const releaseFirst = holdFrames("drag");
      const releaseSecond = holdFrames("drag");
      releaseFirst();
      releaseFirst();
      releaseFirst();
      advanceFrames(30);
      expect(calls).toBe(30);
      releaseSecond();
      expect(framesUntilQuiet()).toBe(0);
    });

    it("re-arms the tail on release so callbacks can settle", () => {
      const release = holdFrames("drag");
      advanceFrames(10);
      const heldCalls = calls;
      release();
      advanceFrames(tailFrames);
      expect(calls).toBe(heldCalls + tailFrames);
    });

    it("keeps at most one frame pending when many holds are acquired at once", () => {
      const releases = ["a", "b", "c"].map((label) => holdFrames(label));
      expect(vi.getTimerCount()).toBe(1);
      advanceFrames(1);
      expect(vi.getTimerCount()).toBe(1);
      for (const release of releases) release();
    });

    it("can be re-acquired under the same label after a full release", () => {
      holdFrames("drag")();
      expect(framesUntilQuiet()).toBe(0);
      const release = holdFrames("drag");
      advanceFrames(50);
      expect(calls).toBeGreaterThan(tailFrames);
      release();
    });
  });

  describe("invariants", () => {
    it("never lets a stale release from one holder drop another holder's hold", () => {
      const releaseStale = holdFrames("shared");
      releaseStale();
      const releaseLive = holdFrames("shared");
      releaseStale();
      advanceFrames(50);
      expect(calls).toBe(50);
      releaseLive();
      expect(framesUntilQuiet()).toBe(0);
    });
  });

  describe("regressions", () => {
    it("regression #174: an unreleased hold is the only thing that can pin the loop", () => {
      const release = holdFrames("marquee-scroll");
      advanceFrames(1000);
      expect(calls).toBe(1000);
      release();
      expect(framesUntilQuiet()).toBe(0);
    });
  });
});
