import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFrameLoop } from "@/test/frame-loop-harness";
import { simulatedAudio } from "@/test/simulated-audio";

// -- Helpers -------------------------------------------------------------------

interface FrameRun {
  times: number[];
  heard: number[];
}

// Frames every 16 ms against Firefox's element steps (40 ms of media time), optionally with a read between frames (a sync tap).
async function frameRun(readBetweenFrames: boolean, visibleAfterMs = 0, rate = 1): Promise<FrameRun> {
  const frameLoop = await loadFrameLoop();
  const { resyncPlaybackClock } = await import("@/audio/playback-clock");
  const { livePlaybackTime, useAudioStore } = await import("@/stores/audio");
  resyncPlaybackClock();
  const audio = simulatedAudio({ start: 10, rate, tickMs: 40, tickPhaseMs: 5, visibleAfterMs });
  useAudioStore.setState({ audioElement: audio.element });
  audio.play();
  const run: FrameRun = { times: [], heard: [] };
  const release = frameLoop.holdFrames("playing");
  const unsubscribe = frameLoop.subscribeFrame(() => {
    run.times.push(livePlaybackTime());
    run.heard.push(audio.heard());
  }, "probe");
  for (let frame = 0; frame < 180; frame++) {
    vi.advanceTimersByTime(7);
    if (readBetweenFrames) livePlaybackTime();
    vi.advanceTimersByTime(9);
  }
  unsubscribe();
  release();
  return run;
}

afterEach(() => {
  vi.useRealTimers();
});

// -- Tests ---------------------------------------------------------------------

describe("livePlaybackTime in frames", () => {
  it.each([
    [false, 0],
    [true, 0],
    [true, 6],
  ])(
    "moves evenly, never backwards, and stays on the audio (reads between frames: %s, steps visible after %i ms)",
    async (busy, visibleAfterMs) => {
      const { times, heard } = await frameRun(busy, visibleAfterMs);
      const settled = times.slice(60);
      const steps = settled.slice(1).map((time, index) => time - settled[index]);
      expect(Math.min(...steps)).toBeGreaterThanOrEqual(0.016 - 0.002);
      expect(Math.max(...steps)).toBeLessThanOrEqual(0.016 + 0.002);
      const errors = settled.map((time, index) => Math.abs(time - heard[index + 60]));
      expect(Math.max(...errors)).toBeLessThan(0.008 + visibleAfterMs / 1000);
    },
  );

  it("regression: moves evenly and never backwards at 0.25x, where element steps land 160 ms apart (Firefox)", async () => {
    const { times, heard } = await frameRun(false, 0, 0.25);
    const settled = times.slice(60);
    const steps = settled.slice(1).map((time, index) => time - settled[index]);
    expect(Math.min(...steps)).toBeGreaterThanOrEqual(0.004 - 0.0005);
    expect(Math.max(...steps)).toBeLessThanOrEqual(0.004 + 0.0005);
    const errors = settled.map((time, index) => Math.abs(time - heard[index + 60]));
    expect(Math.max(...errors)).toBeLessThan(0.004);
  });
});
