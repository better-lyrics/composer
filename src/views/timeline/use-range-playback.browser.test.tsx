import { AudioEngine } from "@/audio/audio-engine";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { clearLoopRegion, loopSelection, playSelection } from "@/views/timeline/selection-playback";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useRangePlayback } from "@/views/timeline/use-range-playback";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const SONG_SECONDS = 2;
const LEAD_IN = 0.3;
const WORD_BEGIN = 1.5;

const RangePlaybackHost: React.FC = () => {
  useRangePlayback();
  return <AudioEngine />;
};

async function loadSong(): Promise<HTMLAudioElement> {
  await render(<RangePlaybackHost />);
  useAudioStore.setState({ source: { type: "file", file: createAudioFile("silence.wav", SONG_SECONDS) } });
  await expect.poll(() => useAudioStore.getState().audioElement).not.toBeNull();
  const audio = useAudioStore.getState().audioElement as HTMLAudioElement;
  await expect.poll(() => useAudioStore.getState().duration).toBeGreaterThan(0);
  audio.muted = true;
  return audio;
}

async function selectLastWordOfSong(): Promise<HTMLAudioElement> {
  const audio = await loadSong();
  useSettingsStore.setState({ selectionLeadIn: LEAD_IN });
  useProjectStore.setState({
    lines: [createLine({ id: "a", text: "end", words: [{ text: "end", begin: WORD_BEGIN, end: SONG_SECONDS }] })],
  });
  useTimelineStore.getState().setSelectedWords([{ lineId: "a", lineIndex: 0, wordIndex: 0, type: "word" }]);
  return audio;
}

const REGION = { begin: 0.2, end: 1.2, loops: true };

async function playRegionOnTimeline(): Promise<HTMLAudioElement> {
  const audio = await loadSong();
  useProjectStore.setState({ activeTab: "timeline" });
  useTimelineStore.getState().setLoopRegion(REGION);
  // Play seeks into the region from the song start; wait until that seek lands so a test seek is not merged into it.
  const seekedIntoRegion = new Promise((resolve) => audio.addEventListener("seeked", resolve, { once: true }));
  useAudioStore.getState().setIsPlaying(true);
  await seekedIntoRegion;
  return audio;
}

async function runToSongEnd(audio: HTMLAudioElement): Promise<void> {
  await expect.poll(() => audio.paused).toBe(false);
  const ended = new Promise((resolve) => audio.addEventListener("ended", resolve, { once: true }));
  audio.currentTime = audio.duration;
  await ended;
}

// -- Tests --------------------------------------------------------------------

describe("useRangePlayback", () => {
  it("regression: a loop that reaches the end of the song starts over", async () => {
    const audio = await selectLastWordOfSong();
    expect(loopSelection()).toBe(true);
    await runToSongEnd(audio);

    await expect.poll(() => audio.paused).toBe(false);
    expect(audio.currentTime).toBeGreaterThanOrEqual(WORD_BEGIN - LEAD_IN - 0.005);
    expect(audio.currentTime).toBeLessThan(WORD_BEGIN);
    expect(useTimelineStore.getState().selectionPlayback).toBe("loop");
  });

  it("regression: a loop survives a main thread stall that outlasts its own seek back", async () => {
    const audio = await selectLastWordOfSong();
    useSettingsStore.setState({ selectionLeadIn: 0 });
    useProjectStore.setState({
      lines: [createLine({ id: "a", text: "up", words: [{ text: "up", begin: 0.2, end: 0.3 }] })],
    });
    expect(loopSelection()).toBe(true);
    await expect.poll(() => audio.paused).toBe(false);
    await expect.poll(() => audio.currentTime).toBeGreaterThan(0.25);

    // Chrome fires a timeupdate once the seek back lands and before seeked: stalling there lets playback run on.
    const stalled = new Promise((resolve) =>
      audio.addEventListener(
        "seeking",
        () =>
          audio.addEventListener(
            "timeupdate",
            () => {
              const until = performance.now() + 400;
              while (performance.now() < until) {
                // Busy wait: a main thread stall, like a lag spike.
              }
              resolve(null);
            },
            { once: true },
          ),
        { once: true },
      ),
    );
    await stalled;
    await new Promise((resolve) => audio.addEventListener("seeked", resolve, { once: true }));

    await expect.poll(() => audio.currentTime).toBeLessThan(0.3);
    expect(useTimelineStore.getState().selectionPlayback).toBe("loop");
  });

  it("ends a loop when the user seeks outside it", async () => {
    const audio = await selectLastWordOfSong();
    expect(loopSelection()).toBe(true);
    await expect.poll(() => audio.currentTime).toBeGreaterThan(WORD_BEGIN - LEAD_IN + 0.05);

    useAudioStore.getState().seekTo(0.2);

    await expect.poll(() => useTimelineStore.getState().selectionPlayback).toBeNull();
    expect(audio.paused).toBe(false);
  });

  it("regression: a single play that reaches the end of the song ends the selection play", async () => {
    const audio = await selectLastWordOfSong();
    expect(playSelection()).toBe(true);
    await runToSongEnd(audio);

    await expect.poll(() => useTimelineStore.getState().selectionPlayback).toBeNull();
    expect(audio.paused).toBe(true);
  });

  it("transport Play loops a drawn region from its start", async () => {
    const audio = await playRegionOnTimeline();
    expect(useTimelineStore.getState().selectionPlayback).toBe("loop");
    let reachedEnd = false;
    let wrapped = false;
    audio.addEventListener("timeupdate", () => {
      if (audio.currentTime >= 1.0) reachedEnd = true;
      else if (reachedEnd) wrapped = true;
    });
    await expect.poll(() => wrapped, { timeout: 5000 }).toBe(true);
    expect(audio.paused).toBe(false);
    expect(audio.currentTime).toBeGreaterThanOrEqual(REGION.begin - 0.005);
  });

  it("a seek outside a playing region ends its playback and keeps the region", async () => {
    const audio = await playRegionOnTimeline();
    expect(useTimelineStore.getState().selectionPlayback).toBe("loop");
    useAudioStore.getState().seekTo(1.6);
    await expect.poll(() => useTimelineStore.getState().selectionPlayback).toBeNull();
    expect(useTimelineStore.getState().loopRegion).toEqual(REGION);
    expect(audio.paused).toBe(false);
  });

  it("regression: clearing a looping region keeps the song playing", async () => {
    const audio = await playRegionOnTimeline();
    clearLoopRegion();
    expect(useTimelineStore.getState().selectionPlayback).toBeNull();
    expect(useAudioStore.getState().isPlaying).toBe(true);
    expect(audio.paused).toBe(false);
  });
});
