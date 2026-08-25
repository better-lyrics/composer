import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advanceFrames, type FrameLoopModule, loadFrameLoop } from "@/test/frame-loop-harness";

// -- Harness ------------------------------------------------------------------

let subscribeFrame: FrameLoopModule["subscribeFrame"];
let holdFrames: FrameLoopModule["holdFrames"];
let wake: FrameLoopModule["wake"];
let nextFrame: FrameLoopModule["nextFrame"];
let cancelNextFrame: FrameLoopModule["cancelNextFrame"];
let tailFrames: number;

function countingSubscriber(label = "probe"): { calls: () => number; subscribe: () => () => void } {
  let calls = 0;
  return {
    calls: () => calls,
    subscribe: () =>
      subscribeFrame(() => {
        calls += 1;
      }, label),
  };
}

beforeEach(async () => {
  const frameLoop = await loadFrameLoop();
  subscribeFrame = frameLoop.subscribeFrame;
  holdFrames = frameLoop.holdFrames;
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

    it("runs every frame while a hold is held", () => {
      const probe = countingSubscriber();
      const unsubscribe = probe.subscribe();
      const release = holdFrames("playing");
      advanceFrames(40);
      expect(probe.calls()).toBe(40);
      release();
      unsubscribe();
    });

    it("stops after the tail once the last hold is released", () => {
      const probe = countingSubscriber();
      const unsubscribe = probe.subscribe();
      const release = holdFrames("playing");
      advanceFrames(10);
      release();
      advanceFrames(tailFrames);
      const stopped = probe.calls();
      advanceFrames(100);
      expect(probe.calls()).toBe(stopped);
      unsubscribe();
    });
  });

  describe("tail behaviour", () => {
    it("runs exactly TAIL_FRAMES frames after a wake with no hold", () => {
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
      }, "waker");
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
      }, "first");
      unsubscribeRemoved = subscribeFrame(() => {
        removedCalls += 1;
      }, "removed");
      const unsubscribeLast = subscribeFrame(() => {
        lastCalls += 1;
      }, "last");
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
            }, "added"),
          );
        }, "adder"),
      );
      advanceFrames(1);
      expect(addedCalls).toBe(1);
      for (const unsubscribe of unsubscribes) unsubscribe();
    });

    it("keeps the same callback subscribed twice as two independent subscriptions", () => {
      let calls = 0;
      const callback = () => {
        calls += 1;
      };
      const unsubscribeFirst = subscribeFrame(callback, "twin-a");
      const unsubscribeSecond = subscribeFrame(callback, "twin-b");
      advanceFrames(1);
      expect(calls).toBe(2);
      unsubscribeFirst();
      advanceFrames(1);
      expect(calls).toBe(3);
      unsubscribeSecond();
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
      const release = holdFrames("playing");
      expect(vi.getTimerCount()).toBe(1);
      advanceFrames(1);
      expect(vi.getTimerCount()).toBe(1);
      release();
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
      const forward = subscribers.map((callback, index) => subscribeFrame(callback, `ordered-${index}`));
      advanceFrames(100);
      expect(counts).toEqual([tailFrames, tailFrames, tailFrames]);
      for (const unsubscribe of forward) unsubscribe();

      counts[0] = 0;
      counts[1] = 0;
      counts[2] = 0;
      const reversed = subscribers.toReversed().map((callback, index) => subscribeFrame(callback, `reversed-${index}`));
      advanceFrames(100);
      expect(counts).toEqual([tailFrames, tailFrames, tailFrames]);
      for (const unsubscribe of reversed) unsubscribe();
    });

    it("hands every subscriber the same timestamp within one frame", () => {
      const timestamps: number[] = [];
      const unsubscribeFirst = subscribeFrame((now) => timestamps.push(now), "stamp-a");
      const unsubscribeSecond = subscribeFrame((now) => timestamps.push(now), "stamp-b");
      advanceFrames(1);
      expect(timestamps).toHaveLength(2);
      expect(timestamps[0]).toBe(timestamps[1]);
      unsubscribeFirst();
      unsubscribeSecond();
    });
  });

  describe("regressions", () => {
    it("regression #174: does not schedule a frame when idle with no hold", () => {
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
