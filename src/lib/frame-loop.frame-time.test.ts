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

describe("frameTime with rounded frame stamps", () => {
  // Firefox with privacy.resistFingerprinting rounds rAF stamps down to 16.67 ms steps.
  const ROUNDING_MS = 1000 / 60;

  function frameTimesAt(frameMs: number, frames: number): { paced: number[]; real: number[] } {
    const paced: number[] = [];
    const real: number[] = [];
    let vsync = performance.now();
    window.requestAnimationFrame = (callback) => {
      vsync += frameMs;
      return window.setTimeout(
        () => callback(Math.floor(performance.now() / ROUNDING_MS) * ROUNDING_MS),
        Math.round(vsync) - performance.now(),
      );
    };
    window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
    const release = frameLoop.holdFrames("playing");
    const unsubscribe = frameLoop.subscribeFrame(() => {
      paced.push(frameLoop.frameTime());
      real.push(performance.now());
    }, "probe");
    vi.advanceTimersByTime(frameMs * frames);
    unsubscribe();
    release();
    return { paced, real };
  }

  function steps(times: number[]): number[] {
    return times.slice(1).map((time, index) => time - times[index]);
  }

  it.each([60, 120])("regression: every frame moves forward at %i Hz", (hz) => {
    const frameMs = 1000 / hz;
    const { paced, real } = frameTimesAt(frameMs, 240);
    const settled = steps(paced).slice(60);
    expect(Math.min(...settled)).toBeGreaterThan(frameMs * 0.9);
    expect(Math.max(...settled)).toBeLessThan(frameMs * 1.1);
    for (let index = 0; index < paced.length; index++) {
      expect(Math.abs(paced[index] - real[index])).toBeLessThanOrEqual(ROUNDING_MS);
    }
  });
});

describe("frameTime with a repeated but unrounded stamp", () => {
  it("regression: a jittery clock that repeats one stamp keeps its own stamps", () => {
    const jitterMs = [0.4, -0.3, 0.2, -0.5, 0.1];
    let frame = 0;
    let previousStamp = 0;
    window.requestAnimationFrame = (callback) =>
      window.setTimeout(() => {
        frame += 1;
        const stamp = frame === 20 ? previousStamp : performance.now() + jitterMs[frame % jitterMs.length];
        previousStamp = stamp;
        callback(stamp);
      }, 16);
    window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
    const stamps: number[] = [];
    const paced: number[] = [];
    const release = frameLoop.holdFrames("playing");
    const unsubscribe = frameLoop.subscribeFrame((now) => {
      stamps.push(previousStamp);
      paced.push(now);
    }, "probe");
    vi.advanceTimersByTime(16 * 60);
    unsubscribe();
    release();
    expect(frameLoop.clockRoundingMs()).toBe(0);
    expect(paced).toEqual(stamps);
  });
});

describe("frameTime after uneven rounded gaps", () => {
  it("regression: early frames that skip several rounding steps still prove the clock rounds", () => {
    const step = 1000 / 60;
    const stepsBetweenFrames = [1, 3, 2, 1, 1, 0, 1, 1, 0, 1];
    let frame = 0;
    let stamp = 1000;
    window.requestAnimationFrame = (callback) =>
      window.setTimeout(() => {
        stamp += stepsBetweenFrames[frame++ % stepsBetweenFrames.length] * step;
        callback(stamp);
      }, 16);
    window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
    const release = frameLoop.holdFrames("playing");
    const unsubscribe = frameLoop.subscribeFrame(() => {}, "probe");
    vi.advanceTimersByTime(16 * 30);
    unsubscribe();
    release();
    expect(frameLoop.clockRoundingMs()).toBeCloseTo(step, 6);
  });
});
