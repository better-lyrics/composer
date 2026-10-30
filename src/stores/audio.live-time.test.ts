import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface ElementClock {
  currentTime: number;
  paused: boolean;
  seeking: boolean;
  readyState: number;
  playbackRate: number;
}

function audioWithClock(clock: ElementClock): HTMLAudioElement {
  const element = document.createElement("audio");
  for (const key of Object.keys(clock) as (keyof ElementClock)[]) {
    Object.defineProperty(element, key, { get: () => clock[key], configurable: true });
  }
  return element;
}

function playingClock(currentTime: number): ElementClock {
  return { currentTime, paused: false, seeking: false, readyState: HTMLMediaElement.HAVE_ENOUGH_DATA, playbackRate: 1 };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["performance"] });
  useAudioStore.getState().reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("livePlaybackTime extrapolation", () => {
  it("returns the element time when it has just advanced", () => {
    const clock = playingClock(10);
    useAudioStore.setState({ audioElement: audioWithClock(clock) });
    expect(livePlaybackTime()).toBe(10);
    clock.currentTime = 10.016;
    vi.advanceTimersByTime(16);
    expect(livePlaybackTime()).toBe(10.016);
  });

  it("regression: coarse Firefox steps advance with wall time between element updates", () => {
    const clock = playingClock(10);
    useAudioStore.setState({ audioElement: audioWithClock(clock) });
    livePlaybackTime();
    vi.advanceTimersByTime(16);
    expect(livePlaybackTime()).toBeCloseTo(10.016, 6);
    vi.advanceTimersByTime(16);
    expect(livePlaybackTime()).toBeCloseTo(10.032, 6);
  });

  it("scales the extrapolation by the playback rate", () => {
    const clock = { ...playingClock(10), playbackRate: 0.5 };
    useAudioStore.setState({ audioElement: audioWithClock(clock) });
    livePlaybackTime();
    vi.advanceTimersByTime(20);
    expect(livePlaybackTime()).toBeCloseTo(10.01, 6);
  });

  describe("edge cases", () => {
    it("never runs more than 60 ms of wall time ahead of the element", () => {
      const clock = { ...playingClock(10), playbackRate: 2 };
      useAudioStore.setState({ audioElement: audioWithClock(clock) });
      livePlaybackTime();
      vi.advanceTimersByTime(500);
      expect(livePlaybackTime()).toBeCloseTo(10.12, 6);
    });

    it.each([
      ["paused", { paused: true }],
      ["seeking", { seeking: true }],
      ["stalled", { readyState: HTMLMediaElement.HAVE_CURRENT_DATA }],
    ])("returns the element time while %s", (_label, override) => {
      const clock = { ...playingClock(10), ...override };
      useAudioStore.setState({ audioElement: audioWithClock(clock) });
      livePlaybackTime();
      vi.advanceTimersByTime(30);
      expect(livePlaybackTime()).toBe(10);
    });

    it("does not jump ahead by the paused time on resume", () => {
      const clock = { ...playingClock(10), paused: true };
      useAudioStore.setState({ audioElement: audioWithClock(clock) });
      livePlaybackTime();
      vi.advanceTimersByTime(5000);
      livePlaybackTime();
      clock.paused = false;
      vi.advanceTimersByTime(16);
      expect(livePlaybackTime()).toBeCloseTo(10.016, 6);
    });

    it("starts over when the audio engine swaps the element", () => {
      useAudioStore.setState({ audioElement: audioWithClock(playingClock(10)) });
      livePlaybackTime();
      vi.advanceTimersByTime(30);
      useAudioStore.setState({ audioElement: audioWithClock(playingClock(10)) });
      expect(livePlaybackTime()).toBe(10);
    });
  });
});
