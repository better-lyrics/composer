import { bindAudioStateEvents } from "@/audio/audio-state-events";
import { useAudioStore } from "@/stores/audio";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => useAudioStore.getState().reset());

const bind = (audio: HTMLAudioElement) =>
  bindAudioStateEvents(audio, () => useAudioStore.getState().isPlaying, useAudioStore.getState().setIsPlaying);

describe("bindAudioStateEvents", () => {
  it("ignores a stale 'play' event from an element that is paused again", () => {
    const audio = new Audio();
    bind(audio);
    audio.dispatchEvent(new Event("play"));
    expect(useAudioStore.getState().isPlaying).toBe(false);
  });

  it("flips store isPlaying to false when audio fires 'pause'", () => {
    useAudioStore.setState({ isPlaying: true });
    const audio = new Audio();
    bind(audio);
    audio.dispatchEvent(new Event("pause"));
    expect(useAudioStore.getState().isPlaying).toBe(false);
  });

  it("does not re-write isPlaying when 'pause' fires while store is already false", () => {
    const audio = new Audio();
    let writes = 0;
    const setIsPlaying = (value: boolean) => {
      writes++;
      useAudioStore.getState().setIsPlaying(value);
    };
    bindAudioStateEvents(audio, () => useAudioStore.getState().isPlaying, setIsPlaying);
    audio.dispatchEvent(new Event("pause"));
    audio.dispatchEvent(new Event("pause"));
    expect(writes).toBe(0);
  });

  it("cleanup removes both play and pause listeners", () => {
    useAudioStore.setState({ isPlaying: false });
    const audio = new Audio();
    const cleanup = bind(audio);
    cleanup();
    audio.dispatchEvent(new Event("play"));
    expect(useAudioStore.getState().isPlaying).toBe(false);
    useAudioStore.setState({ isPlaying: true });
    audio.dispatchEvent(new Event("pause"));
    expect(useAudioStore.getState().isPlaying).toBe(true);
  });
});
