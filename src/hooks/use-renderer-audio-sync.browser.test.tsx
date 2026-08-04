import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useRendererAudioSync } from "@/hooks/use-renderer-audio-sync";
import { useAudioStore } from "@/stores/audio";
import { render } from "@/test/render";

// -- Helpers ------------------------------------------------------------------

/**
 * A media element whose clock only moves when the test says so, which is what a
 * real one does between presented frames.
 */
function createStalledAudio(currentTime: number, { paused = false, playbackRate = 1 } = {}): HTMLAudioElement {
  const audio = new Audio();
  Object.defineProperty(audio, "paused", { value: paused, configurable: true });
  Object.defineProperty(audio, "playbackRate", { value: playbackRate, configurable: true, writable: true });
  audio.currentTime = currentTime;
  return audio;
}

const Probe: React.FC<{ onTick: (seconds: number) => void }> = ({ onTick }) => {
  const elementRef = useRef<HTMLDivElement>(null);
  useRendererAudioSync(elementRef, (_element, _audio, currentTimeSeconds) => onTick(currentTimeSeconds));
  return <div ref={elementRef} />;
};

async function collectTicks(): Promise<number[]> {
  const ticks: number[] = [];
  await render(<Probe onTick={(seconds) => ticks.push(seconds)} />);
  await expect.poll(() => ticks.length).toBeGreaterThan(3);
  return ticks;
}

// -- Tests --------------------------------------------------------------------

describe("useRendererAudioSync", () => {
  it("carries a stalled reading forward so the clock keeps moving between refreshes", async () => {
    useAudioStore.setState({ audioElement: createStalledAudio(10) });

    const ticks = await collectTicks();

    expect(ticks[0]).toBeGreaterThanOrEqual(10);
    await expect.poll(() => Math.max(...ticks)).toBeGreaterThan(10);
  });

  it("scales the carry by the playback rate", async () => {
    useAudioStore.setState({ audioElement: createStalledAudio(10, { playbackRate: 0.25 }) });

    const ticks = await collectTicks();
    const slowAdvance = Math.max(...ticks) - 10;

    useAudioStore.setState({ audioElement: createStalledAudio(10, { playbackRate: 1 }) });
    const fastTicks = await collectTicks();
    const fastAdvance = Math.max(...fastTicks) - 10;

    expect(slowAdvance).toBeGreaterThan(0);
    expect(slowAdvance).toBeLessThan(fastAdvance);
  });

  it("never carries further than the cap, so a stalled clock waits rather than running away", async () => {
    useAudioStore.setState({ audioElement: createStalledAudio(10) });

    const ticks = await collectTicks();
    await expect.poll(() => ticks.length).toBeGreaterThan(20);

    expect(Math.max(...ticks)).toBeLessThanOrEqual(10.1);
  });
});

// -- Edge cases ---------------------------------------------------------------

describe("useRendererAudioSync edge cases", () => {
  it("reports a paused clock exactly, so scrubbing while paused does not drift", async () => {
    useAudioStore.setState({ audioElement: createStalledAudio(10, { paused: true }) });

    const ticks = await collectTicks();

    expect(new Set(ticks)).toEqual(new Set([10]));
  });

  it("re-anchors when the reading moves, rather than carrying from the old one", async () => {
    const audio = createStalledAudio(10);
    useAudioStore.setState({ audioElement: audio });

    const ticks: number[] = [];
    await render(<Probe onTick={(seconds) => ticks.push(seconds)} />);
    await expect.poll(() => ticks.length).toBeGreaterThan(3);

    audio.currentTime = 30;

    await expect.poll(() => ticks.at(-1)).toBeGreaterThanOrEqual(30);
    expect(ticks.at(-1)).toBeLessThan(30.2);
  });
});
