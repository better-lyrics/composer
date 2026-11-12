import { useAudioStore } from "@/stores/audio";
import { bufferToBlobUrl, createAudioFile, makeClippedStereoBuffer } from "@/test/audio-fixtures";
import { render } from "@/test/render";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { TimelineWaveform } from "@/views/timeline/timeline-waveform";
import { mediaSource, readWaveformData } from "@/views/timeline/waveform-data-cache";
import { Activity } from "react";
import { describe, expect, it, vi } from "vitest";

// -- Helpers -------------------------------------------------------------------

const DURATION_SECONDS = 2;

function setupLoudStereoAudio(): HTMLAudioElement {
  const audio = new Audio();
  audio.src = bufferToBlobUrl(makeClippedStereoBuffer(DURATION_SECONDS));
  useAudioStore.setState({
    source: { type: "file", file: createAudioFile() },
    duration: DURATION_SECONDS,
    audioElement: audio,
  });
  return audio;
}

function waveformCanvases(): HTMLCanvasElement[] {
  const host = [...document.querySelectorAll("[data-waveform-fade] div")].find((element) => element.shadowRoot);
  return [...(host?.shadowRoot?.querySelectorAll("canvas") ?? [])];
}

function drawnPixels(): string[] {
  return waveformCanvases().map((canvas) => `${canvas.width}x${canvas.height}:${canvas.toDataURL()}`);
}

function paintedPixelCount(): number {
  return waveformCanvases().reduce((count, canvas) => {
    const alpha = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data ?? [];
    let painted = 0;
    for (let i = 3; i < alpha.length; i += 4) if (alpha[i] > 0) painted++;
    return count + painted;
  }, 0);
}

function WaveformTab({ shown }: { shown: boolean }) {
  return (
    <Activity mode={shown ? "visible" : "hidden"}>
      <TimelineWaveform />
    </Activity>
  );
}

// -- Tests ---------------------------------------------------------------------

describe("TimelineWaveform tab return", () => {
  it("draws the same pixels from the kept samples without fetching or decoding again", async () => {
    const audio = setupLoudStereoAudio();
    useTimelineStore.setState({ zoom: 100 });
    const fetchSpy = vi.spyOn(window, "fetch");
    const decodeSpy = vi.spyOn(AudioContext.prototype, "decodeAudioData");

    const screen = await render(<WaveformTab shown />);
    await expect.poll(() => useTimelineStore.getState().waveformReady, { timeout: 5000 }).toBe(true);
    await expect.poll(paintedPixelCount).toBeGreaterThan(0);
    const firstDraw = drawnPixels();
    expect(decodeSpy).toHaveBeenCalledTimes(1);
    const fetchesOfSource = () => fetchSpy.mock.calls.filter(([input]) => String(input) === audio.src).length;
    expect(fetchesOfSource()).toBe(1);

    await screen.rerender(<WaveformTab shown={false} />);
    await expect.poll(() => useTimelineStore.getState().waveformReady).toBe(false);
    expect(readWaveformData(mediaSource(audio))?.barHeight).toBeGreaterThan(1);

    await screen.rerender(<WaveformTab shown />);
    await expect.poll(drawnPixels, { timeout: 5000 }).toEqual(firstDraw);
    expect(decodeSpy).toHaveBeenCalledTimes(1);
    expect(fetchesOfSource()).toBe(1);
  });
});
