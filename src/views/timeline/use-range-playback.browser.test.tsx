import { AudioEngine } from "@/audio/audio-engine";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { loopSelection, playSelection } from "@/views/timeline/selection-playback";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useRangePlayback } from "@/views/timeline/use-range-playback";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const SONG_SECONDS = 2;

const RangePlaybackHost: React.FC = () => {
  useRangePlayback();
  return <AudioEngine />;
};

async function selectLastWordOfSong(): Promise<HTMLAudioElement> {
  await render(<RangePlaybackHost />);
  useAudioStore.setState({ source: { type: "file", file: createAudioFile("silence.wav", SONG_SECONDS) } });
  await expect.poll(() => useAudioStore.getState().audioElement).not.toBeNull();
  const audio = useAudioStore.getState().audioElement as HTMLAudioElement;
  await expect.poll(() => useAudioStore.getState().duration).toBeGreaterThan(0);
  audio.muted = true;
  useProjectStore.setState({
    lines: [createLine({ id: "a", text: "end", words: [{ text: "end", begin: 1.5, end: SONG_SECONDS }] })],
  });
  useTimelineStore.getState().setSelectedWords([{ lineId: "a", lineIndex: 0, wordIndex: 0, type: "word" }]);
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
    expect(audio.currentTime).toBeLessThan(1.5);
    expect(useTimelineStore.getState().selectionPlayback).toBe("loop");
  });

  it("regression: a single play that reaches the end of the song ends the selection play", async () => {
    const audio = await selectLastWordOfSong();
    expect(playSelection()).toBe(true);
    await runToSongEnd(audio);

    await expect.poll(() => useTimelineStore.getState().selectionPlayback).toBeNull();
    expect(audio.paused).toBe(true);
  });
});
