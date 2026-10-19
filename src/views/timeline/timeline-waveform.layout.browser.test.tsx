import { useAudioStore } from "@/stores/audio";
import { createAudioFile } from "@/test/audio-fixtures";
import { installUtilitiesUsedIn } from "@/test/browser-css";
import { render } from "@/test/render";
import { WAVEFORM_HEIGHT } from "@/views/timeline/timeline-store";
import { TimelineWaveform } from "@/views/timeline/timeline-waveform";
import { afterEach, describe, expect, it } from "vitest";

// -- Harness ------------------------------------------------------------------

let utilities: HTMLStyleElement | null = null;

afterEach(() => {
  utilities?.remove();
  utilities = null;
});

async function rowsTop(): Promise<number> {
  const screen = await render(
    <div className="relative">
      <TimelineWaveform />
      <div data-rows />
    </div>,
  );
  utilities = await installUtilitiesUsedIn(screen.container);
  const rows = screen.container.querySelector<HTMLElement>("[data-rows]");
  if (!rows) throw new Error("rows not rendered");
  return rows.offsetTop;
}

// -- Tests --------------------------------------------------------------------

describe("TimelineWaveform · layout", () => {
  it("starts the rows below the waveform once the audio is loaded", async () => {
    const file = createAudioFile("silence.wav", 30);
    useAudioStore.setState({
      source: { type: "file", file },
      duration: 30,
      audioElement: new Audio(URL.createObjectURL(file)),
    });

    await expect.poll(rowsTop).toBe(WAVEFORM_HEIGHT);
  });

  describe("regressions", () => {
    it("regression #286: keeps the waveform height while a YouTube song's audio has not loaded", async () => {
      useAudioStore.setState({ source: { type: "youtube", videoId: "dQw4w9WgXcQ" }, duration: 30, audioElement: null });

      expect(await rowsTop()).toBe(WAVEFORM_HEIGHT);
    });

    it("regression #286: keeps the waveform height before the audio element exists", async () => {
      useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 30, audioElement: null });

      expect(await rowsTop()).toBe(WAVEFORM_HEIGHT);
    });
  });

  describe("edge cases", () => {
    it("keeps the waveform height when the duration is still unknown", async () => {
      useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 0, audioElement: null });

      expect(await rowsTop()).toBe(WAVEFORM_HEIGHT);
    });

    it("takes no space without an audio source", async () => {
      useAudioStore.setState({ source: null, audioElement: null });

      expect(await rowsTop()).toBe(0);
    });
  });
});
