import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advanceFrames, type FrameLoopModule, loadFrameLoop } from "@/test/frame-loop-harness";

// -- Harness ------------------------------------------------------------------

let subscribeFrame: FrameLoopModule["subscribeFrame"];
let holdFrames: FrameLoopModule["holdFrames"];
let wake: FrameLoopModule["wake"];
let tailFrames: number;
let errorSpy: ReturnType<typeof silenceConsoleError>;

function silenceConsoleError() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

function loggedMessages(): string[] {
  return errorSpy.mock.calls.map((args) => String(args[0]));
}

function messagesMatching(pattern: RegExp): string[] {
  return loggedMessages().filter((message) => pattern.test(message));
}

beforeEach(async () => {
  const frameLoop = await loadFrameLoop();
  subscribeFrame = frameLoop.subscribeFrame;
  holdFrames = frameLoop.holdFrames;
  wake = frameLoop.wake;
  tailFrames = frameLoop.TAIL_FRAMES;
  errorSpy = silenceConsoleError();
});

afterEach(() => {
  errorSpy.mockRestore();
  vi.useRealTimers();
});

// -- Tests --------------------------------------------------------------------

describe("frame-loop subscriber isolation", () => {
  describe("containment", () => {
    it("runs a later-ordered subscriber after an earlier one throws", () => {
      let laterCalls = 0;
      const unsubscribeThrower = subscribeFrame(() => {
        throw new Error("playhead ref went away");
      }, "playhead");
      const unsubscribeLater = subscribeFrame(() => {
        laterCalls += 1;
      }, "preview-sidebar");

      advanceFrames(1);

      expect(laterCalls).toBe(1);
      unsubscribeThrower();
      unsubscribeLater();
    });

    it("runs an earlier-ordered subscriber before a later one throws", () => {
      let earlierCalls = 0;
      const unsubscribeEarlier = subscribeFrame(() => {
        earlierCalls += 1;
      }, "snap-markers");
      const unsubscribeThrower = subscribeFrame(() => {
        throw new Error("boom");
      }, "playhead");

      advanceFrames(1);

      expect(earlierCalls).toBe(1);
      unsubscribeEarlier();
      unsubscribeThrower();
    });

    it("hands every subscriber the same timestamp in a frame where one throws", () => {
      const timestamps: number[] = [];
      const unsubscribeFirst = subscribeFrame((now) => timestamps.push(now), "first");
      const unsubscribeThrower = subscribeFrame(() => {
        throw new Error("boom");
      }, "thrower");
      const unsubscribeLast = subscribeFrame((now) => timestamps.push(now), "last");

      advanceFrames(1);

      expect(timestamps).toHaveLength(2);
      expect(timestamps[0]).toBe(timestamps[1]);
      unsubscribeFirst();
      unsubscribeThrower();
      unsubscribeLast();
    });

    it("lets a sibling unsubscribe and wake in a frame where another throws", () => {
      let survivorCalls = 0;
      const unsubscribeThrower = subscribeFrame(() => {
        throw new Error("boom");
      }, "thrower");
      let unsubscribeDoomed: (() => void) | null = null;
      const unsubscribeSurvivor = subscribeFrame(() => {
        survivorCalls += 1;
        unsubscribeDoomed?.();
        wake();
      }, "survivor");
      let doomedCalls = 0;
      unsubscribeDoomed = subscribeFrame(() => {
        doomedCalls += 1;
      }, "doomed");

      advanceFrames(1);

      expect(survivorCalls).toBe(1);
      expect(doomedCalls).toBe(0);
      unsubscribeThrower();
      unsubscribeSurvivor();
    });
  });

  describe("the loop survives a thrower", () => {
    it("completes the full tail while a subscriber throws every frame", () => {
      let survivorCalls = 0;
      const unsubscribeThrower = subscribeFrame(() => {
        throw new Error("boom");
      }, "thrower");
      const unsubscribeSurvivor = subscribeFrame(() => {
        survivorCalls += 1;
      }, "survivor");

      advanceFrames(100);

      expect(survivorCalls).toBe(tailFrames);
      unsubscribeThrower();
      unsubscribeSurvivor();
    });

    it("keeps running every frame under a hold while a subscriber throws", () => {
      let survivorCalls = 0;
      const unsubscribeThrower = subscribeFrame(() => {
        throw new Error("boom");
      }, "thrower");
      const unsubscribeSurvivor = subscribeFrame(() => {
        survivorCalls += 1;
      }, "survivor");
      const release = holdFrames("playing");

      advanceFrames(50);

      expect(survivorCalls).toBe(50);
      release();
      unsubscribeThrower();
      unsubscribeSurvivor();
    });

    it("queues the next frame before any callback runs", () => {
      let pendingDuringFrame = -1;
      const release = holdFrames("playing");
      const unsubscribe = subscribeFrame(() => {
        pendingDuringFrame = vi.getTimerCount();
      }, "probe");

      advanceFrames(1);

      expect(pendingDuringFrame).toBe(1);
      release();
      unsubscribe();
    });

    it("leaves the next frame queued even when reporting a failure throws", () => {
      errorSpy.mockImplementation(() => {
        throw new Error("console instrumentation exploded");
      });
      const release = holdFrames("playing");
      const unsubscribe = subscribeFrame(() => {
        throw new Error("boom");
      }, "thrower");

      expect(() => advanceFrames(1)).toThrow(/console instrumentation exploded/);

      expect(vi.getTimerCount()).toBe(1);
      release();
      unsubscribe();
    });

    it("quiesces after the tail even though a subscriber threw", () => {
      const unsubscribeThrower = subscribeFrame(() => {
        throw new Error("boom");
      }, "thrower");
      const probe = { calls: 0 };
      const unsubscribeProbe = subscribeFrame(() => {
        probe.calls += 1;
      }, "probe");

      advanceFrames(tailFrames);
      expect(vi.getTimerCount()).toBe(0);
      advanceFrames(500);
      expect(probe.calls).toBe(tailFrames);

      unsubscribeThrower();
      unsubscribeProbe();
    });
  });

  describe("logging", () => {
    it("names the failing subscriber", () => {
      const unsubscribe = subscribeFrame(() => {
        throw new Error("boom");
      }, "timeline-playhead");

      advanceFrames(1);

      expect(messagesMatching(/frame callback/)).toEqual([
        expect.stringContaining('frame callback "timeline-playhead" failed'),
      ]);
      unsubscribe();
    });

    it("logs once rather than once per frame while a subscriber throws every frame", () => {
      const unsubscribeThrower = subscribeFrame(() => {
        throw new Error("boom");
      }, "thrower");
      const release = holdFrames("playing");

      advanceFrames(300);

      expect(messagesMatching(/frame callback/)).toHaveLength(1);
      release();
      unsubscribeThrower();
    });

    it("logs again when a subscriber recovers and then breaks a second time", () => {
      let shouldThrow = true;
      const unsubscribe = subscribeFrame(() => {
        if (shouldThrow) throw new Error("boom");
      }, "flaky");
      const release = holdFrames("playing");

      advanceFrames(5);
      expect(messagesMatching(/frame callback/)).toHaveLength(1);

      shouldThrow = false;
      advanceFrames(5);
      expect(messagesMatching(/frame callback/)).toHaveLength(1);

      shouldThrow = true;
      advanceFrames(5);
      expect(messagesMatching(/frame callback/)).toHaveLength(2);

      release();
      unsubscribe();
    });

    it("keeps each subscriber's failure independent", () => {
      const unsubscribeFirst = subscribeFrame(() => {
        throw new Error("boom");
      }, "first-broken");
      const unsubscribeSecond = subscribeFrame(() => {
        throw new Error("boom");
      }, "second-broken");
      const release = holdFrames("playing");

      advanceFrames(100);

      expect(messagesMatching(/frame callback/)).toEqual([
        expect.stringContaining('"first-broken"'),
        expect.stringContaining('"second-broken"'),
      ]);
      release();
      unsubscribeFirst();
      unsubscribeSecond();
    });
  });
});

describe("frame-loop runaway diagnostics", () => {
  it("reports once when a subscriber wakes the loop every frame with no hold", () => {
    const unsubscribe = subscribeFrame(() => wake(), "store-writer");

    advanceFrames(3000);

    expect(messagesMatching(/never idled/)).toHaveLength(1);
    expect(messagesMatching(/never idled/)[0]).toContain("store-writer");
    unsubscribe();
  });

  it("stays silent across many separate short tails", () => {
    const unsubscribe = subscribeFrame(() => {}, "quiet");

    for (let cycle = 0; cycle < 500; cycle++) {
      wake();
      advanceFrames(tailFrames + 2);
    }

    expect(messagesMatching(/never idled/)).toEqual([]);
    unsubscribe();
  });

  it("stays silent while a hold legitimately keeps the loop awake and wakes keep arriving", () => {
    const unsubscribe = subscribeFrame(() => {}, "playhead");
    const release = holdFrames("playing");

    for (let beat = 0; beat < 200; beat++) {
      wake();
      advanceFrames(15);
    }

    expect(loggedMessages()).toEqual([]);
    release();
    unsubscribe();
  });

  it("reports an unreleased hold by label once nothing is waking the loop", () => {
    const unsubscribe = subscribeFrame(() => {}, "playhead");
    const release = holdFrames("marquee-scroll");

    advanceFrames(3000);

    expect(messagesMatching(/held/)).toHaveLength(1);
    expect(messagesMatching(/held/)[0]).toContain("marquee-scroll");
    release();
    unsubscribe();
  });
});
