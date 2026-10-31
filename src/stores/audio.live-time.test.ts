import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resyncPlaybackClock } from "@/audio/playback-clock";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { type SimulatedAudio, simulatedAudio } from "@/test/simulated-audio";

// -- Helpers -------------------------------------------------------------------

// Firefox publishes the position every 40 ms; Chrome computes it at every read.
const FIREFOX_TICK_MS = 40;

function playing(audio: SimulatedAudio): SimulatedAudio {
  useAudioStore.setState({ audioElement: audio.element });
  livePlaybackTime();
  audio.play();
  return audio;
}

// Frames on a 60 Hz cadence, with a read in between at a varying moment, the way a sync tap lands.
function readFramesAndTaps(frames: number, onTap: (error: number) => void, audio: SimulatedAudio): void {
  let seed = 7;
  for (let frame = 0; frame < frames; frame++) {
    const frameMs = frame % 3 === 2 ? 16 : 17;
    seed = (seed * 48271) % 2147483647;
    const tapAt = 1 + (seed % (frameMs - 2));
    livePlaybackTime();
    vi.advanceTimersByTime(tapAt);
    onTap(livePlaybackTime() - audio.heard());
    vi.advanceTimersByTime(frameMs - tapAt);
  }
}

function tapErrors(audio: SimulatedAudio, frames = 240, settleFrames = 60): number[] {
  const errors: number[] = [];
  let frame = 0;
  readFramesAndTaps(
    frames,
    (error) => {
      if (frame++ >= settleFrames) errors.push(error);
    },
    audio,
  );
  return errors;
}

function maxAbs(values: number[]): number {
  return Math.max(...values.map(Math.abs));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["performance"] });
  useAudioStore.getState().reset();
  resyncPlaybackClock();
});

afterEach(() => {
  vi.useRealTimers();
});

// -- Tests ---------------------------------------------------------------------

describe("livePlaybackTime", () => {
  it("reads exactly what is heard when the element time is exact (Chrome)", () => {
    const audio = playing(simulatedAudio({ start: 10 }));
    expect(maxAbs(tapErrors(audio))).toBeLessThan(0.0005);
  });

  it("regression: reads the middle of an exact time that scatters (Chrome time-stretching at 2x)", () => {
    const jitterMs = [9, -12, 4, -7, 14, -3, -10, 6, 1, -2];
    const audio = playing(simulatedAudio({ start: 10, rate: 2, jitterMs }));
    const errors = tapErrors(audio);
    expect(Math.abs(errors.reduce((sum, error) => sum + error, 0) / errors.length)).toBeLessThan(0.002);
    expect(maxAbs(errors)).toBeLessThan(0.006);
  });

  it("regression: an exact clock that scatters stays on its mean after a resume", () => {
    const jitterMs = [9, -12, 4, -7, 14, -3, -10, 6, 1, -2];
    const audio = playing(simulatedAudio({ start: 10, rate: 2, jitterMs }));
    tapErrors(audio, 60, 60);
    audio.pause();
    livePlaybackTime();
    vi.advanceTimersByTime(500);
    audio.play();
    const errors: number[] = [];
    for (let frame = 0; frame < 60; frame++) {
      livePlaybackTime();
      livePlaybackTime();
      vi.advanceTimersByTime(7);
      if (frame >= 10) errors.push(livePlaybackTime() - audio.heard());
      vi.advanceTimersByTime(9);
    }
    expect(maxAbs(errors)).toBeLessThan(0.004);
  });

  it.each([0.5, 1, 2])(
    "regression: a read between frames lands within a few ms of what is heard with 40 ms element steps (Firefox) at %sx",
    (rate) => {
      const audio = playing(simulatedAudio({ start: 10, rate, tickMs: FIREFOX_TICK_MS, tickPhaseMs: 7 }));
      const errors = tapErrors(audio);
      expect(maxAbs(errors)).toBeLessThan(0.004 * rate);
      expect(Math.abs(errors.reduce((sum, error) => sum + error, 0) / errors.length)).toBeLessThan(0.002 * rate);
    },
  );

  describe("edge cases", () => {
    it("holds at the element time until the audio actually starts after play", () => {
      const audio = simulatedAudio({ start: 10, tickMs: FIREFOX_TICK_MS });
      useAudioStore.setState({ audioElement: audio.element });
      audio.play();
      audio.stall();
      for (let frame = 0; frame < 15; frame++) {
        vi.advanceTimersByTime(16);
        expect(livePlaybackTime()).toBe(10);
      }
    });

    it.each([
      ["paused", (audio: SimulatedAudio) => audio.pause()],
      ["stalled", (audio: SimulatedAudio) => audio.stall()],
    ])("never runs more than one element step past the element time once %s", (_label, stop) => {
      const audio = playing(simulatedAudio({ start: 10, tickMs: FIREFOX_TICK_MS }));
      tapErrors(audio, 60, 60);
      stop(audio);
      for (let frame = 0; frame < 20; frame++) {
        vi.advanceTimersByTime(16);
        expect(livePlaybackTime() - audio.element.currentTime).toBeLessThanOrEqual(0.06);
      }
      expect(livePlaybackTime()).toBe(audio.element.currentTime);
    });

    it("finds the audio again within a few frames after a stall ends", () => {
      const audio = playing(simulatedAudio({ start: 10, tickMs: FIREFOX_TICK_MS }));
      tapErrors(audio, 60, 60);
      audio.stall();
      vi.advanceTimersByTime(500);
      audio.resume();
      const errors = tapErrors(audio, 60, 6);
      expect(maxAbs(errors)).toBeLessThan(0.02);
    });

    it("starts over at a seek target and holds there until the audio moves", () => {
      const audio = playing(simulatedAudio({ start: 10, tickMs: FIREFOX_TICK_MS }));
      tapErrors(audio, 60, 60);
      resyncPlaybackClock();
      audio.seek(42);
      audio.stall();
      expect(livePlaybackTime()).toBe(42);
      vi.advanceTimersByTime(100);
      expect(livePlaybackTime()).toBe(42);
    });

    it("regression: a seek with no seeking event never keeps the old timeline", () => {
      const audio = playing(simulatedAudio({ start: 30, tickMs: FIREFOX_TICK_MS }));
      tapErrors(audio, 60, 60);
      audio.seek(5);
      const errors = tapErrors(audio, 30, 6);
      expect(maxAbs(errors)).toBeLessThan(0.02);
    });

    it("never runs past the end of the song", () => {
      const audio = playing(simulatedAudio({ start: 29.9, duration: 30 }));
      tapErrors(audio, 20, 20);
      expect(livePlaybackTime()).toBe(30);
    });

    it("starts over when the audio engine swaps the element", () => {
      const first = playing(simulatedAudio({ start: 10, tickMs: FIREFOX_TICK_MS }));
      tapErrors(first, 30, 30);
      const second = simulatedAudio({ start: 3 });
      useAudioStore.setState({ audioElement: second.element });
      expect(livePlaybackTime()).toBe(3);
    });

    it("falls back to the store time without an element", () => {
      useAudioStore.setState({ audioElement: null, currentTime: 12 });
      expect(livePlaybackTime()).toBe(12);
    });
  });
});
