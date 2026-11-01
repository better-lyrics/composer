import { useAudioStore } from "@/stores/audio";
import { bufferToBlobUrl, createAudioFile, makeSineBuffer } from "@/test/audio-fixtures";
import { render } from "@/test/render";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { TimelineWaveform } from "@/views/timeline/timeline-waveform";
import { describe, expect, it } from "vitest";

// -- Helpers -------------------------------------------------------------------

const DURATION_SECONDS = 2;
const RELOADED_DURATION_SECONDS = 3;

function setupPlayableAudio(): HTMLAudioElement {
  const audio = new Audio();
  audio.src = bufferToBlobUrl(makeSineBuffer(DURATION_SECONDS));
  useAudioStore.setState({
    source: { type: "file", file: createAudioFile() },
    duration: DURATION_SECONDS,
    audioElement: audio,
  });
  return audio;
}

function waveformIsShown(): boolean {
  return document.querySelector<HTMLElement>("[data-waveform-loading-dots]")?.style.opacity === "0";
}

function drawnWaveformWidth(): number {
  const host = [...document.querySelectorAll("[data-waveform-fade] div")].find((element) => element.shadowRoot);
  const wrapper = host?.shadowRoot?.querySelector<HTMLElement>("[part='wrapper']");
  return wrapper?.getBoundingClientRect().width ?? 0;
}

function swapSourceOnSameElement(audio: HTMLAudioElement): Promise<void> {
  const started = new Promise<void>((resolve) => audio.addEventListener("loadstart", () => resolve(), { once: true }));
  audio.src = bufferToBlobUrl(makeSineBuffer(RELOADED_DURATION_SECONDS));
  return started;
}

// -- Tests ---------------------------------------------------------------------

describe("TimelineWaveform source reload", () => {
  it("draws the reloaded source at the current zoom", async () => {
    const audio = setupPlayableAudio();
    useTimelineStore.setState({ zoom: 50 });
    await render(<TimelineWaveform />);
    await expect.poll(waveformIsShown, { timeout: 5000 }).toBe(true);

    await swapSourceOnSameElement(audio);
    useTimelineStore.setState({ zoom: 120 });

    await expect.poll(drawnWaveformWidth, { timeout: 5000 }).toBe(RELOADED_DURATION_SECONDS * 120);
  });

  describe("regressions", () => {
    it("regression: zooming while a stem switch reloads the waveform neither throws No audio loaded nor leaks the aborted reload", async () => {
      const unhandledReloads: unknown[] = [];
      const recordUnhandled = (event: PromiseRejectionEvent) => unhandledReloads.push(event.reason);
      window.addEventListener("unhandledrejection", recordUnhandled);
      const audio = setupPlayableAudio();
      useTimelineStore.setState({ zoom: 50 });
      await render(<TimelineWaveform />);
      await expect.poll(waveformIsShown, { timeout: 5000 }).toBe(true);

      await swapSourceOnSameElement(audio);
      useTimelineStore.setState({ zoom: 80 });
      useTimelineStore.setState({ zoom: 100 });

      await expect.poll(drawnWaveformWidth, { timeout: 5000 }).toBe(RELOADED_DURATION_SECONDS * 100);
      window.removeEventListener("unhandledrejection", recordUnhandled);
      expect(unhandledReloads).toEqual([]);
    });
  });
});
