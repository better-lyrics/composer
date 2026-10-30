import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFrameLoop } from "@/test/frame-loop-harness";

const JITTER_MS = [4, -6, 5, -3, 6, -5, 2, -4];

function audioPlayingFrom(start: number): { element: HTMLAudioElement; advance: (frame: number) => void } {
  const element = document.createElement("audio");
  let currentTime = start;
  Object.defineProperties(element, {
    currentTime: { get: () => currentTime, configurable: true },
    paused: { value: false, configurable: true },
    seeking: { value: false, configurable: true },
    readyState: { value: HTMLMediaElement.HAVE_ENOUGH_DATA, configurable: true },
    playbackRate: { value: 1, configurable: true },
  });
  return {
    element,
    advance: (frame) => {
      currentTime = start + frame * 0.016 + JITTER_MS[frame % JITTER_MS.length] / 1000;
    },
  };
}

async function frameTimes(readBetweenFrames: boolean): Promise<number[]> {
  const frameLoop = await loadFrameLoop();
  const { livePlaybackTime, useAudioStore } = await import("@/stores/audio");
  const audio = audioPlayingFrom(10);
  useAudioStore.setState({ audioElement: audio.element });
  const seen: number[] = [];
  const release = frameLoop.holdFrames("playing");
  const unsubscribe = frameLoop.subscribeFrame(() => seen.push(livePlaybackTime()), "probe");
  for (let frame = 1; frame <= 60; frame++) {
    audio.advance(frame);
    vi.advanceTimersByTime(5);
    if (readBetweenFrames) livePlaybackTime();
    vi.advanceTimersByTime(11);
  }
  unsubscribe();
  release();
  return seen;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("livePlaybackTime between frames", () => {
  it("a read outside a frame never changes where the next frame draws", async () => {
    const quiet = await frameTimes(false);
    const busy = await frameTimes(true);
    expect(busy).toEqual(quiet);
  });
});
