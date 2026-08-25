import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { wireFrameLoop } from "@/lib/frame-loop-wiring";
import { useAudioStore } from "@/stores/audio";
import { render } from "@/test/render";
import { formatTimeMs } from "@/utils/sync-helpers";
import { TimingDisplay } from "@/views/sync/timing-display";

// -- Harness -------------------------------------------------------------------

let disposeWiring: (() => void) | null = null;

function attachAudio(): HTMLAudioElement {
  const audioElement = document.createElement("audio");
  useAudioStore.getState().registerAudioElement(audioElement);
  return audioElement;
}

beforeEach(() => {
  disposeWiring = wireFrameLoop();
});

afterEach(() => {
  disposeWiring?.();
  disposeWiring = null;
});

// -- Tests ---------------------------------------------------------------------

describe("TimingDisplay on the frame loop", () => {
  it("tracks the audio element clock while playing", async () => {
    const audioElement = attachAudio();
    const screen = await render(<TimingDisplay />);
    await expect.poll(() => screen.container.textContent).toContain(formatTimeMs(0));

    useAudioStore.getState().setIsPlaying(true);
    audioElement.currentTime = 12.5;

    await expect.poll(() => screen.container.textContent).toContain(formatTimeMs(12.5));
  });

  it("tracks a seek while paused", async () => {
    attachAudio();
    const screen = await render(<TimingDisplay />);
    await expect.poll(() => screen.container.textContent).toContain(formatTimeMs(0));

    useAudioStore.getState().seekTo(7.25);

    await expect.poll(() => screen.container.textContent).toContain(formatTimeMs(7.25));
  });

  it("falls back to the stored time when no audio element is registered", async () => {
    useAudioStore.setState({ currentTime: 3.5 });
    const screen = await render(<TimingDisplay />);

    await expect.poll(() => screen.container.textContent).toContain(formatTimeMs(3.5));
  });
});
