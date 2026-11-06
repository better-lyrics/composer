import { beforeEach, expect, it } from "vitest";
import { notePlaybackTime, playedRanges, restorePlayedRanges } from "@/audio/playback-ranges";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { resetAllStores } from "@/test/stores";

// -- Helpers ------------------------------------------------------------------

function playThrough(from: number, to: number): void {
  const audio = new Audio();
  useAudioStore.getState().registerAudioElement(audio);
  Object.defineProperty(audio, "paused", { value: false });
  let time = from;
  Object.defineProperty(audio, "currentTime", { get: () => time });
  audio.addEventListener("timeupdate", notePlaybackTime);
  for (; time <= to; time += 0.25) audio.dispatchEvent(new Event("timeupdate"));
}

function audioFile(name: string): File {
  return new File([new Uint8Array(16)], name, { type: "audio/mpeg" });
}

// -- Tests --------------------------------------------------------------------

beforeEach(() => resetAllStores());

it("regression: keeps a project's restored ranges when its audio arrives after another song played", () => {
  useAudioStore.getState().setSource({ type: "file", file: audioFile("harbor-lights.mp3") });
  playThrough(0, 5);

  useProjectStore.getState().reset();
  useAudioStore.getState().setSource(null);
  useAudioStore.getState().expectProjectAudio({ kind: "file", name: "evening-tide.mp3" });
  restorePlayedRanges([[0, 10]]);
  useAudioStore.getState().setSource({ type: "file", file: audioFile("evening-tide.mp3") });

  expect(playedRanges()).toEqual([[0, 10]]);
});

it("keeps ranges when a save reads them while another song is loading but has not played", () => {
  useAudioStore.getState().setSource({ type: "file", file: audioFile("harbor-lights.mp3") });
  playThrough(0, 5);
  useAudioStore.getState().setYouTubeSource("q1w2e3r4t5y");
  expect(playedRanges()).toEqual([]);
  useAudioStore.getState().setSource({ type: "file", file: audioFile("harbor-lights.mp3") });

  expect(playedRanges()).toEqual([[0, 5]]);
});

it("ignores playback from an audio element that is no longer the current one", () => {
  useAudioStore.getState().setSource({ type: "file", file: audioFile("harbor-lights.mp3") });
  playThrough(0, 5);
  const stale = new Audio();
  Object.defineProperty(stale, "paused", { value: false });
  let time = 40;
  Object.defineProperty(stale, "currentTime", { get: () => time });
  stale.addEventListener("timeupdate", notePlaybackTime);
  for (; time <= 45; time += 0.25) stale.dispatchEvent(new Event("timeupdate"));

  expect(playedRanges()).toEqual([[0, 5]]);
});
