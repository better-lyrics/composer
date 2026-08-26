import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useRendererAudioSync } from "@/hooks/use-renderer-audio-sync";
import { wireFrameLoop } from "@/lib/frame-loop-wiring";
import { useAudioStore } from "@/stores/audio";
import { createFrameProbe, type FrameProbe } from "@/test/frame-probe";
import { settleFrames } from "@/test/frame-steps";
import { render } from "@/test/render";

// -- Harness -------------------------------------------------------------------

const SyncedElement: React.FC = () => {
  const elementRef = useRef<HTMLDivElement>(null);
  useRendererAudioSync(
    elementRef,
    (element, audio) => {
      element.dataset.time = String(audio.currentTime);
      element.dataset.paused = String(audio.paused);
      element.dataset.rate = String(audio.playbackRate);
    },
    "synced-element",
  );
  return <div ref={elementRef} data-test="synced" />;
};

let disposeWiring: (() => void) | null = null;
let probe: FrameProbe;

function attachAudio(): HTMLAudioElement {
  const audioElement = document.createElement("audio");
  useAudioStore.getState().registerAudioElement(audioElement);
  return audioElement;
}

function syncedElement(root: HTMLElement): HTMLElement {
  const element = root.querySelector<HTMLElement>("[data-test='synced']");
  if (!element) throw new Error("synced element missing");
  return element;
}

beforeEach(() => {
  disposeWiring = wireFrameLoop();
  probe = createFrameProbe();
});

afterEach(() => {
  probe.dispose();
  disposeWiring?.();
  disposeWiring = null;
});

// -- Tests ---------------------------------------------------------------------

describe("useRendererAudioSync", () => {
  it("applies the audio clock on mount", async () => {
    const audioElement = attachAudio();
    audioElement.currentTime = 4;
    const screen = await render(<SyncedElement />);

    await expect.poll(() => syncedElement(screen.container).dataset.time).toBe("4");
  });

  it("keeps applying the clock while the audio plays", async () => {
    const audioElement = attachAudio();
    const screen = await render(<SyncedElement />);
    await expect.poll(() => syncedElement(screen.container).dataset.time).toBe("0");

    useAudioStore.getState().setIsPlaying(true);
    audioElement.currentTime = 9;

    await expect.poll(() => syncedElement(screen.container).dataset.time).toBe("9");
  });

  it("applies a scrub while the audio stays paused", async () => {
    attachAudio();
    const screen = await render(<SyncedElement />);
    await expect.poll(() => syncedElement(screen.container).dataset.time).toBe("0");

    useAudioStore.getState().seekTo(21);

    await expect.poll(() => syncedElement(screen.container).dataset.time).toBe("21");
    expect(syncedElement(screen.container).dataset.paused).toBe("true");
  });

  it("applies a playback rate change", async () => {
    const audioElement = attachAudio();
    const screen = await render(<SyncedElement />);
    await expect.poll(() => syncedElement(screen.container).dataset.rate).toBe("1");

    audioElement.playbackRate = 2;

    await expect.poll(() => syncedElement(screen.container).dataset.rate).toBe("2");
  });

  it("follows the audio element the engine registers next", async () => {
    attachAudio();
    const screen = await render(<SyncedElement />);
    await expect.poll(() => syncedElement(screen.container).dataset.time).toBe("0");

    const replacement = document.createElement("audio");
    replacement.currentTime = 17;
    useAudioStore.getState().registerAudioElement(replacement);

    await expect.poll(() => syncedElement(screen.container).dataset.time).toBe("17");
  });

  it("applies nothing while no audio element is registered", async () => {
    const screen = await render(<SyncedElement />);

    expect(syncedElement(screen.container).dataset.time).toBeUndefined();
  });

  describe("invariants", () => {
    it("regression #174: stops running frames once the audio is paused and idle", async () => {
      attachAudio();
      const screen = await render(<SyncedElement />);
      await expect.poll(() => syncedElement(screen.container).dataset.time).toBe("0");
      await probe.quiesce();

      await settleFrames(probe.count);
      expect(probe.count()).toBe(0);
    });
  });
});
