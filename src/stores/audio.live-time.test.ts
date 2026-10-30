import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resyncPlaybackClock } from "@/audio/playback-clock";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";

interface ElementClock {
  currentTime: number;
  paused: boolean;
  seeking: boolean;
  readyState: number;
  playbackRate: number;
  duration?: number;
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
    expect(livePlaybackTime()).toBeCloseTo(10.016, 6);
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

  it("regression: smooths jittery element time steps into even frame steps", () => {
    const clock = playingClock(10);
    useAudioStore.setState({ audioElement: audioWithClock(clock) });
    livePlaybackTime();
    const jitterMs = [4, -6, 5, -3, 6, -5, 2, -4];
    const errors: number[] = [];
    for (let frame = 1; frame <= 120; frame++) {
      vi.advanceTimersByTime(16);
      const truth = 10 + frame * 0.016;
      clock.currentTime = truth + jitterMs[frame % jitterMs.length] / 1000;
      errors.push(Math.abs(livePlaybackTime() - truth));
    }
    expect(Math.max(...errors.slice(30))).toBeLessThan(0.0015);
  });

  it("never moves backwards while playing", () => {
    const clock = playingClock(10);
    useAudioStore.setState({ audioElement: audioWithClock(clock) });
    let previous = livePlaybackTime();
    for (let frame = 1; frame <= 60; frame++) {
      vi.advanceTimersByTime(16);
      if (frame % 3 === 0) clock.currentTime = 10 + frame * 0.016 - 0.012;
      const now = livePlaybackTime();
      expect(now).toBeGreaterThanOrEqual(previous);
      previous = now;
    }
  });

  it("jumps straight to a seek target while playing", () => {
    const clock = playingClock(10);
    useAudioStore.setState({ audioElement: audioWithClock(clock) });
    livePlaybackTime();
    vi.advanceTimersByTime(16);
    clock.currentTime = 42;
    expect(livePlaybackTime()).toBe(42);
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
      expect(livePlaybackTime()).toBe(10);
      vi.advanceTimersByTime(16);
      clock.currentTime = 10.016;
      expect(livePlaybackTime()).toBeCloseTo(10.016, 6);
    });

    it("regression: resuming starts at the element time even when nothing read the clock while paused", () => {
      const clock = { ...playingClock(10), paused: true };
      useAudioStore.setState({ audioElement: audioWithClock(clock) });
      livePlaybackTime();
      vi.advanceTimersByTime(5000);
      clock.paused = false;
      expect(livePlaybackTime()).toBe(10);
      vi.advanceTimersByTime(16);
      clock.currentTime = 10.016;
      expect(livePlaybackTime()).toBeCloseTo(10.016, 6);
    });

    it("regression: holds at the element time until playback actually starts after play", () => {
      const clock = { ...playingClock(10), paused: true };
      useAudioStore.setState({ audioElement: audioWithClock(clock) });
      livePlaybackTime();
      clock.paused = false;
      const held: number[] = [];
      for (let frame = 0; frame < 14; frame++) {
        vi.advanceTimersByTime(16);
        held.push(livePlaybackTime());
      }
      expect(held.every((time) => time === 10)).toBe(true);
      clock.currentTime = 10.005;
      vi.advanceTimersByTime(16);
      expect(livePlaybackTime()).toBe(10.005);
    });

    it("regression: stays close to the element when the audio stalls mid-play", () => {
      const clock = playingClock(10);
      useAudioStore.setState({ audioElement: audioWithClock(clock) });
      livePlaybackTime();
      const lead: number[] = [];
      let previous = 10;
      for (let frame = 1; frame <= 30; frame++) {
        vi.advanceTimersByTime(16);
        if (frame <= 5) clock.currentTime = 10 + frame * 0.016;
        const time = livePlaybackTime();
        expect(time).toBeGreaterThanOrEqual(previous);
        previous = time;
        lead.push(time - clock.currentTime);
      }
      expect(Math.max(...lead)).toBeLessThanOrEqual(0.06 + 0.025 + 1e-9);
    });

    it("regression: a creeping start-up time never lets the clock run far ahead", () => {
      const clock = { ...playingClock(10), paused: true };
      useAudioStore.setState({ audioElement: audioWithClock(clock) });
      livePlaybackTime();
      clock.paused = false;
      const lead: number[] = [];
      for (let frame = 1; frame <= 20; frame++) {
        vi.advanceTimersByTime(16);
        if (frame % 4 === 0) clock.currentTime += 0.002;
        lead.push(livePlaybackTime() - clock.currentTime);
      }
      expect(Math.max(...lead)).toBeLessThanOrEqual(0.03);
    });

    it("holds after a seek that lands exactly on the last element time", () => {
      const clock = playingClock(10);
      useAudioStore.setState({ audioElement: audioWithClock(clock) });
      livePlaybackTime();
      vi.advanceTimersByTime(30);
      resyncPlaybackClock();
      expect(livePlaybackTime()).toBe(10);
    });

    it("never runs past the end of the song", () => {
      const clock = { ...playingClock(29.98), duration: 30 };
      useAudioStore.setState({ audioElement: audioWithClock(clock) });
      livePlaybackTime();
      vi.advanceTimersByTime(50);
      expect(livePlaybackTime()).toBe(30);
    });

    it("jumps to a short seek instead of easing toward it", () => {
      const clock = playingClock(10);
      useAudioStore.setState({ audioElement: audioWithClock(clock) });
      livePlaybackTime();
      vi.advanceTimersByTime(16);
      clock.currentTime = 10.016;
      livePlaybackTime();
      resyncPlaybackClock();
      clock.currentTime = 10.08;
      vi.advanceTimersByTime(16);
      expect(livePlaybackTime()).toBe(10.08);
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
