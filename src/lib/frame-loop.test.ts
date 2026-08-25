import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// -- Types --------------------------------------------------------------------

type FrameLoop = typeof import("@/lib/frame-loop");

// -- Constants ----------------------------------------------------------------

const FRAME_MS = 16;

// -- Harness ------------------------------------------------------------------

let subscribeFrame: FrameLoop["subscribeFrame"];
let setFrameSource: FrameLoop["setFrameSource"];
let wake: FrameLoop["wake"];
let nextFrame: FrameLoop["nextFrame"];
let cancelNextFrame: FrameLoop["cancelNextFrame"];
let tailFrames: number;

function advanceFrames(count: number): void {
  vi.advanceTimersByTime(FRAME_MS * count);
}

function countingSubscriber(): { calls: () => number; subscribe: () => () => void } {
  let calls = 0;
  return {
    calls: () => calls,
    subscribe: () =>
      subscribeFrame(() => {
        calls += 1;
      }),
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  const frameLoop = await import("@/lib/frame-loop");
  subscribeFrame = frameLoop.subscribeFrame;
  setFrameSource = frameLoop.setFrameSource;
  wake = frameLoop.wake;
  nextFrame = frameLoop.nextFrame;
  cancelNextFrame = frameLoop.cancelNextFrame;
  tailFrames = frameLoop.TAIL_FRAMES;
});

afterEach(() => {
  vi.useRealTimers();
});

// -- Tests --------------------------------------------------------------------

describe("frame-loop", () => {
  describe("happy path", () => {
    it("runs a subscriber on the next frame", () => {
      const probe = countingSubscriber();
      const unsubscribe = probe.subscribe();
      expect(probe.calls()).toBe(0);
      advanceFrames(1);
      expect(probe.calls()).toBe(1);
      unsubscribe();
    });

    it("runs every frame while a live source is set", () => {
      const probe = countingSubscriber();
      const unsubscribe = probe.subscribe();
      setFrameSource("playing", true);
      advanceFrames(40);
      expect(probe.calls()).toBe(40);
      setFrameSource("playing", false);
      unsubscribe();
    });

    it("stops after the tail once the last live source is cleared", () => {
      const probe = countingSubscriber();
      const unsubscribe = probe.subscribe();
      setFrameSource("playing", true);
      advanceFrames(10);
      setFrameSource("playing", false);
      advanceFrames(tailFrames);
      const stopped = probe.calls();
      advanceFrames(100);
      expect(probe.calls()).toBe(stopped);
      unsubscribe();
    });
  });

  describe("tail behaviour", () => {
    it("runs exactly TAIL_FRAMES frames after a wake with no live source", () => {
      const probe = countingSubscriber();
      const unsubscribe = probe.subscribe();
      advanceFrames(100);
      expect(probe.calls()).toBe(tailFrames);
      unsubscribe();
    });

    it("re-arms the full tail when a second wake arrives mid-tail", () => {
      const probe = countingSubscriber();
      const unsubscribe = probe.subscribe();
      advanceFrames(1);
      wake();
      advanceFrames(100);
      expect(probe.calls()).toBe(1 + tailFrames);
      unsubscribe();
    });

    it("re-arms the full tail when a subscriber wakes from inside a frame", () => {
      let calls = 0;
      const unsubscribe = subscribeFrame(() => {
        calls += 1;
        if (calls === 1) wake();
      });
      advanceFrames(100);
      expect(calls).toBe(1 + tailFrames);
      unsubscribe();
    });
  });

  describe("edge cases", () => {
    it("schedules nothing when waking with zero subscribers", () => {
      wake();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("cancels the pending frame when the last subscriber leaves", () => {
      const probe = countingSubscriber();
      const unsubscribe = probe.subscribe();
      expect(vi.getTimerCount()).toBe(1);
      unsubscribe();
      expect(vi.getTimerCount()).toBe(0);
      advanceFrames(100);
      expect(probe.calls()).toBe(0);
    });

    it("does not skip a sibling when one subscriber unsubscribes mid-frame", () => {
      let firstCalls = 0;
      let removedCalls = 0;
      let lastCalls = 0;
      let unsubscribeRemoved: (() => void) | null = null;
      const unsubscribeFirst = subscribeFrame(() => {
        firstCalls += 1;
        unsubscribeRemoved?.();
      });
      unsubscribeRemoved = subscribeFrame(() => {
        removedCalls += 1;
      });
      const unsubscribeLast = subscribeFrame(() => {
        lastCalls += 1;
      });
      advanceFrames(1);
      expect(firstCalls).toBe(1);
      expect(removedCalls).toBe(0);
      expect(lastCalls).toBe(1);
      unsubscribeFirst();
      unsubscribeLast();
    });

    it("runs a subscriber added during a frame in that same frame", () => {
      let addedCalls = 0;
      const unsubscribes: Array<() => void> = [];
      unsubscribes.push(
        subscribeFrame(() => {
          if (unsubscribes.length > 1) return;
          unsubscribes.push(
            subscribeFrame(() => {
              addedCalls += 1;
            }),
          );
        }),
      );
      advanceFrames(1);
      expect(addedCalls).toBe(1);
      for (const unsubscribe of unsubscribes) unsubscribe();
    });

    it("treats a repeated setFrameSource value as a no-op", () => {
      const probe = countingSubscriber();
      const unsubscribe = probe.subscribe();
      setFrameSource("scrubbing", true);
      setFrameSource("scrubbing", true);
      advanceFrames(30);
      expect(probe.calls()).toBe(30);
      setFrameSource("scrubbing", false);
      advanceFrames(tailFrames);
      const stopped = probe.calls();
      advanceFrames(100);
      expect(probe.calls()).toBe(stopped);
      unsubscribe();
    });

    it("does not re-arm the tail when clearing a source that was never set", () => {
      const probe = countingSubscriber();
      const unsubscribe = probe.subscribe();
      advanceFrames(100);
      expect(probe.calls()).toBe(tailFrames);
      setFrameSource("never-set", false);
      advanceFrames(100);
      expect(probe.calls()).toBe(tailFrames);
      unsubscribe();
    });

    it("keeps running until every live source is cleared", () => {
      const probe = countingSubscriber();
      const unsubscribe = probe.subscribe();
      setFrameSource("playing", true);
      setFrameSource("scrubbing", true);
      advanceFrames(10);
      setFrameSource("playing", false);
      advanceFrames(20);
      expect(probe.calls()).toBe(30);
      setFrameSource("scrubbing", false);
      advanceFrames(tailFrames);
      const stopped = probe.calls();
      advanceFrames(100);
      expect(probe.calls()).toBe(stopped);
      unsubscribe();
    });

    it("cancels a one-shot frame handed to cancelNextFrame", () => {
      let calls = 0;
      const handle = nextFrame(() => {
        calls += 1;
      });
      cancelNextFrame(handle);
      advanceFrames(10);
      expect(calls).toBe(0);
    });
  });

  describe("invariants", () => {
    it("keeps at most one frame pending however many wakes arrive", () => {
      const probe = countingSubscriber();
      const unsubscribe = probe.subscribe();
      wake();
      wake();
      wake();
      setFrameSource("playing", true);
      expect(vi.getTimerCount()).toBe(1);
      advanceFrames(1);
      expect(vi.getTimerCount()).toBe(1);
      setFrameSource("playing", false);
      unsubscribe();
    });

    it("quiesces fully: no frame callbacks across 100 idle frames", () => {
      const probe = countingSubscriber();
      const unsubscribe = probe.subscribe();
      advanceFrames(tailFrames);
      expect(vi.getTimerCount()).toBe(0);
      advanceFrames(100);
      expect(probe.calls()).toBe(tailFrames);
      unsubscribe();
    });

    it("quiesces after the same tail regardless of subscriber order", () => {
      const counts = [0, 0, 0];
      const subscribers = counts.map((_unused, index) => () => {
        counts[index] += 1;
      });
      const forward = subscribers.map((callback) => subscribeFrame(callback));
      advanceFrames(100);
      expect(counts).toEqual([tailFrames, tailFrames, tailFrames]);
      for (const unsubscribe of forward) unsubscribe();

      counts[0] = 0;
      counts[1] = 0;
      counts[2] = 0;
      const reversed = subscribers.toReversed().map((callback) => subscribeFrame(callback));
      advanceFrames(100);
      expect(counts).toEqual([tailFrames, tailFrames, tailFrames]);
      for (const unsubscribe of reversed) unsubscribe();
    });

    it("hands every subscriber the same timestamp within one frame", () => {
      const timestamps: number[] = [];
      const unsubscribeFirst = subscribeFrame((now) => timestamps.push(now));
      const unsubscribeSecond = subscribeFrame((now) => timestamps.push(now));
      advanceFrames(1);
      expect(timestamps).toHaveLength(2);
      expect(timestamps[0]).toBe(timestamps[1]);
      unsubscribeFirst();
      unsubscribeSecond();
    });
  });

  describe("regressions", () => {
    it("regression #174: does not schedule a frame when idle with no live source", () => {
      const probe = countingSubscriber();
      const unsubscribe = probe.subscribe();
      advanceFrames(tailFrames);
      expect(vi.getTimerCount()).toBe(0);
      advanceFrames(60 * 60);
      expect(probe.calls()).toBe(tailFrames);
      expect(vi.getTimerCount()).toBe(0);
      unsubscribe();
    });
  });
});
