import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeFrame, TAIL_FRAMES } from "@/lib/frame-loop";
import { wireFrameLoop } from "@/lib/frame-loop-wiring";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// Exercises the wiring against the real frame-loop singleton and real stores.
// The audio-element paths need real media events and live in the browser test.

// -- Constants ----------------------------------------------------------------

const FRAME_MS = 16;

// -- Harness ------------------------------------------------------------------

let frames = 0;
let unsubscribeProbe: (() => void) | null = null;
const disposers: Array<() => void> = [];

function advanceFrames(count: number): void {
  vi.advanceTimersByTime(FRAME_MS * count);
}

function wire(): () => void {
  const dispose = wireFrameLoop();
  disposers.push(dispose);
  return dispose;
}

function settleThenReset(): void {
  advanceFrames(TAIL_FRAMES + 1);
  frames = 0;
}

function framesAfter(trigger: () => void): number {
  settleThenReset();
  trigger();
  advanceFrames(TAIL_FRAMES + 1);
  return frames;
}

beforeEach(() => {
  vi.useFakeTimers();
  frames = 0;
  unsubscribeProbe = subscribeFrame(() => {
    frames += 1;
  }, "wiring-probe");
});

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  unsubscribeProbe?.();
  unsubscribeProbe = null;
  vi.useRealTimers();
});

// -- Tests --------------------------------------------------------------------

describe("wireFrameLoop store subscriptions", () => {
  describe("happy path", () => {
    it("wakes the loop on a store write", () => {
      wire();
      expect(framesAfter(() => useProjectStore.setState({ activeTab: "edit" }))).toBeGreaterThan(0);
    });

    it("stops waking once disposed", () => {
      const dispose = wire();
      dispose();
      expect(framesAfter(() => useProjectStore.setState({ activeTab: "sync" }))).toBe(0);
    });
  });

  describe("re-entrancy", () => {
    it("regression: disposing one wiring leaves another wiring's store subscriptions intact", () => {
      const disposeFirst = wire();
      wire();
      disposeFirst();
      expect(framesAfter(() => useProjectStore.setState({ activeTab: "edit" }))).toBeGreaterThan(0);
      expect(framesAfter(() => useTimelineStore.setState({ scrollLeft: 21 }))).toBeGreaterThan(0);
    });

    it("stops waking only once every wiring is disposed", () => {
      const disposeFirst = wire();
      const disposeSecond = wire();
      disposeFirst();
      disposeSecond();
      expect(framesAfter(() => useProjectStore.setState({ activeTab: "export" }))).toBe(0);
    });

    it("tolerates the same wiring being disposed twice", () => {
      const disposeFirst = wire();
      wire();
      disposeFirst();
      disposeFirst();
      expect(framesAfter(() => useProjectStore.setState({ activeTab: "edit" }))).toBeGreaterThan(0);
    });
  });
});
