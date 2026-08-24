import { beforeEach, describe, expect, it } from "vitest";
import { scrubPreview } from "@/audio/scrub-preview";
import { createAudioFile } from "@/test/audio-fixtures";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { seekAndReveal } from "@/views/timeline/seek-and-reveal";

// -- Helpers ------------------------------------------------------------------

function trackSeek(): { get: () => number } {
  let seeked = -1;
  useAudioStore.setState({
    seekTo: (time: number) => {
      seeked = time;
    },
  } as Parameters<typeof useAudioStore.setState>[0]);
  return { get: () => seeked };
}

async function loadScrubBuffer(): Promise<void> {
  const bytes = await createAudioFile().arrayBuffer();
  scrubPreview.useBuffer(await scrubPreview.decode(bytes));
}

// -- Tests --------------------------------------------------------------------

describe("seekAndReveal", () => {
  beforeEach(() => {
    scrubPreview.stop();
    scrubPreview.useBuffer(null);
    useSettingsStore.getState().set("audioScrubPreview", true);
  });

  it("seeks the audio to the requested time", () => {
    const seek = trackSeek();
    useAudioStore.setState({ isPlaying: false });

    seekAndReveal(4.2, null);

    expect(seek.get()).toBe(4.2);
  });

  it("auditions a snippet at the destination while paused", async () => {
    await loadScrubBuffer();
    trackSeek();
    useAudioStore.setState({ isPlaying: false });

    seekAndReveal(0.05, null);

    expect(scrubPreview.getActiveSnippet()).not.toBeNull();
  });

  it("stays silent while the track is already playing", async () => {
    await loadScrubBuffer();
    trackSeek();
    useAudioStore.setState({ isPlaying: true });

    seekAndReveal(0.05, null);

    expect(scrubPreview.getActiveSnippet()).toBeNull();
  });

  it("stays silent when the scrub preview setting is off", async () => {
    await loadScrubBuffer();
    trackSeek();
    useAudioStore.setState({ isPlaying: false });
    useSettingsStore.getState().set("audioScrubPreview", false);

    seekAndReveal(0.05, null);

    expect(scrubPreview.getActiveSnippet()).toBeNull();
  });

  it("still seeks when there is no scroll container", () => {
    const seek = trackSeek();
    useAudioStore.setState({ isPlaying: false });

    seekAndReveal(9, null);

    expect(seek.get()).toBe(9);
  });
});
