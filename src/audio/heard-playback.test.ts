import { beforeEach, expect, it } from "vitest";
import { heardRanges, noteHeardTime, restoreHeardRanges } from "@/audio/heard-playback";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { resetAllStores } from "@/test/stores";

// -- Helpers ------------------------------------------------------------------

function playThrough(from: number, to: number): void {
  const audio = new Audio();
  Object.defineProperty(audio, "paused", { value: false });
  let time = from;
  Object.defineProperty(audio, "currentTime", { get: () => time });
  audio.addEventListener("timeupdate", noteHeardTime);
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
  restoreHeardRanges([[0, 10]]);
  useAudioStore.getState().setSource({ type: "file", file: audioFile("evening-tide.mp3") });

  expect(heardRanges()).toEqual([[0, 10]]);
});

it("keeps ranges when a save reads them while another song is loading but has not played", () => {
  useAudioStore.getState().setSource({ type: "file", file: audioFile("harbor-lights.mp3") });
  playThrough(0, 5);
  useAudioStore.getState().setYouTubeSource("q1w2e3r4t5y");
  heardRanges();
  useAudioStore.getState().setSource({ type: "file", file: audioFile("harbor-lights.mp3") });

  expect(heardRanges()).toEqual([[0, 5]]);
});
