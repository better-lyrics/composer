import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  useAudioStore.getState().reset();
});

describe("useAudioStore - setYouTubeSource", () => {
  it("sets a youtube source with cached file", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "song.opus", { type: "audio/ogg" });
    useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ", file);
    const { source } = useAudioStore.getState();
    expect(source).toEqual({
      type: "youtube",
      videoId: "dQw4w9WgXcQ",
      file,
    });
  });

  it("sets a youtube source without a file (pre-download)", () => {
    useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
    const { source } = useAudioStore.getState();
    expect(source).toEqual({
      type: "youtube",
      videoId: "dQw4w9WgXcQ",
      file: undefined,
    });
  });

  it("resets currentTime, duration, and isPlaying", () => {
    useAudioStore.setState({ currentTime: 42, duration: 200, isPlaying: true });
    useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
    const state = useAudioStore.getState();
    expect(state.currentTime).toBe(0);
    expect(state.duration).toBe(0);
    expect(state.isPlaying).toBe(false);
  });
});

describe("useAudioStore - setYouTubeFile", () => {
  it("attaches a file to an existing youtube source", () => {
    useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
    const file = new File([new Uint8Array([4, 5, 6])], "song.opus", { type: "audio/ogg" });
    useAudioStore.getState().setYouTubeFile(file);
    const { source } = useAudioStore.getState();
    expect(source).toEqual({
      type: "youtube",
      videoId: "dQw4w9WgXcQ",
      file,
    });
  });

  it("preserves the videoId when attaching a file", () => {
    useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
    const file = new File([new Uint8Array([7])], "song.opus", { type: "audio/ogg" });
    useAudioStore.getState().setYouTubeFile(file);
    const { source } = useAudioStore.getState();
    if (!source || source.type !== "youtube") throw new Error("expected youtube source");
    expect(source.videoId).toBe("dQw4w9WgXcQ");
    expect(source.file).toBe(file);
  });

  it("is a no-op when no source is set", () => {
    const file = new File([new Uint8Array([1])], "song.opus", { type: "audio/ogg" });
    useAudioStore.getState().setYouTubeFile(file);
    const { source } = useAudioStore.getState();
    expect(source).toBeNull();
  });

  it("is a no-op when source is a file source", () => {
    const fileSource = new File(["audio"], "test.mp3", { type: "audio/mp3" });
    useAudioStore.getState().setSource({ type: "file", file: fileSource });
    const newFile = new File([new Uint8Array([1])], "song.opus", { type: "audio/ogg" });
    useAudioStore.getState().setYouTubeFile(newFile);
    const { source } = useAudioStore.getState();
    if (!source || source.type !== "file") throw new Error("expected file source preserved");
    expect(source.file).toBe(fileSource);
  });
});

describe("useAudioStore - reset", () => {
  it("clears youtube source", () => {
    const file = new File([new Uint8Array([1])], "song.opus", { type: "audio/ogg" });
    useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ", file);
    useAudioStore.getState().reset();
    expect(useAudioStore.getState().source).toBeNull();
  });
});

describe("useAudioStore - seekTo", () => {
  it("ignores non-finite times", () => {
    useAudioStore.setState({ currentTime: 12 });
    useAudioStore.getState().seekTo(Number.POSITIVE_INFINITY);
    expect(useAudioStore.getState().currentTime).toBe(12);
    useAudioStore.getState().seekTo(Number.NaN);
    expect(useAudioStore.getState().currentTime).toBe(12);
  });

  it("ignores negative times", () => {
    useAudioStore.setState({ currentTime: 12 });
    useAudioStore.getState().seekTo(-1);
    expect(useAudioStore.getState().currentTime).toBe(12);
  });

  it("accepts a valid time", () => {
    useAudioStore.getState().seekTo(5);
    expect(useAudioStore.getState().currentTime).toBe(5);
  });
});

describe("useAudioStore - primingStripped", () => {
  it("defaults to false", () => {
    expect(useAudioStore.getState().primingStripped).toBe(false);
  });

  it("can be set true via setPrimingStripped", () => {
    useAudioStore.getState().setPrimingStripped(true);
    expect(useAudioStore.getState().primingStripped).toBe(true);
  });

  it("can be set back to false via setPrimingStripped", () => {
    useAudioStore.getState().setPrimingStripped(true);
    useAudioStore.getState().setPrimingStripped(false);
    expect(useAudioStore.getState().primingStripped).toBe(false);
  });

  it("resets to false when setSource is called", () => {
    useAudioStore.getState().setPrimingStripped(true);
    const file = new File([], "x.wav", { type: "audio/wav" });
    useAudioStore.getState().setSource({ type: "file", file });
    expect(useAudioStore.getState().primingStripped).toBe(false);
  });

  it("resets to false when setSource(null) is called", () => {
    useAudioStore.getState().setPrimingStripped(true);
    useAudioStore.getState().setSource(null);
    expect(useAudioStore.getState().primingStripped).toBe(false);
  });

  it("resets to false on reset()", () => {
    useAudioStore.getState().setPrimingStripped(true);
    useAudioStore.getState().reset();
    expect(useAudioStore.getState().primingStripped).toBe(false);
  });

  it("does not affect other audio state when toggling", () => {
    useAudioStore.setState({ currentTime: 5, duration: 100 });
    useAudioStore.getState().setPrimingStripped(true);
    expect(useAudioStore.getState().currentTime).toBe(5);
    expect(useAudioStore.getState().duration).toBe(100);
  });
});

describe("useAudioStore - setPlaybackRate", () => {
  it("persists the selected playback rate as the default", () => {
    useAudioStore.getState().setPlaybackRate(1.5);
    expect(useAudioStore.getState().playbackRate).toBe(1.5);
    expect(useSettingsStore.getState().defaultPlaybackRate).toBe(1.5);
  });

  it("ignores invalid playback rates", () => {
    useAudioStore.setState({ playbackRate: 1 });
    useSettingsStore.getState().set("defaultPlaybackRate", 1);
    useAudioStore.getState().setPlaybackRate(0);
    useAudioStore.getState().setPlaybackRate(Number.NaN);
    expect(useAudioStore.getState().playbackRate).toBe(1);
    expect(useSettingsStore.getState().defaultPlaybackRate).toBe(1);
  });
});
