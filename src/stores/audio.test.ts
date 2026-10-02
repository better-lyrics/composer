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

describe("useAudioStore - failYouTubeLoad", () => {
  const file = new File([new Uint8Array([1])], "alpha.mp3", { type: "audio/mp3" });

  it("reverts to the source that was playing before the video and sets the error together", () => {
    const previous = { type: "file" as const, file };
    useAudioStore.getState().setSource(previous);
    useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
    useAudioStore.getState().failYouTubeLoad("boom");
    const state = useAudioStore.getState();
    expect(state.source).toBe(previous);
    expect(state.youtubeLoadError).toBe("boom");
  });

  it("resets currentTime, duration, and isPlaying", () => {
    useAudioStore.setState({ currentTime: 42, duration: 200, isPlaying: true });
    useAudioStore.getState().failYouTubeLoad("boom");
    const state = useAudioStore.getState();
    expect(state.currentTime).toBe(0);
    expect(state.duration).toBe(0);
    expect(state.isPlaying).toBe(false);
  });

  describe("edge cases", () => {
    it("reverts to a null source", () => {
      useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
      useAudioStore.getState().failYouTubeLoad("boom");
      expect(useAudioStore.getState().source).toBeNull();
    });

    it("keeps the first fallback across videos that never loaded", () => {
      const previous = { type: "file" as const, file };
      useAudioStore.getState().setSource(previous);
      useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
      useAudioStore.getState().setYouTubeSource("9bZkp7q19f0");
      useAudioStore.getState().failYouTubeLoad("boom");
      expect(useAudioStore.getState().source).toBe(previous);
    });

    it("notifies subscribers exactly once", () => {
      let notifications = 0;
      const unsubscribe = useAudioStore.subscribe(() => {
        notifications++;
      });
      useAudioStore.getState().failYouTubeLoad("boom");
      unsubscribe();
      expect(notifications).toBe(1);
    });
  });

  describe("regressions", () => {
    it("regression: never falls back to a source replaced before the video was picked", () => {
      useAudioStore.getState().setSource({ type: "file", file });
      useAudioStore.getState().setSource(null);
      useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
      useAudioStore.getState().failYouTubeLoad("boom");
      expect(useAudioStore.getState().source).toBeNull();
    });

    it("regression: a video that finished loading drops the fallback it no longer needs", () => {
      useAudioStore.getState().setSource({ type: "file", file });
      useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
      useAudioStore.getState().setYouTubeFile(file);
      expect(useAudioStore.getState().youtubeFallbackSource).toBeNull();
    });
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

describe("useAudioStore - expected audio", () => {
  it("expects a missing local file without a source", () => {
    useAudioStore.getState().expectProjectAudio({ kind: "file", name: "city.wav" });
    const state = useAudioStore.getState();
    expect(state.source).toBeNull();
    expect(state.expectedAudio).toEqual({ kind: "file", name: "city.wav" });
  });

  it("expects YouTube audio by starting its fetch", () => {
    useAudioStore.getState().expectProjectAudio({ kind: "youtube", videoId: "dQw4w9WgXcQ" });
    const state = useAudioStore.getState();
    expect(state.source).toEqual({ type: "youtube", videoId: "dQw4w9WgXcQ" });
    expect(state.expectedAudio).toEqual({ kind: "youtube", videoId: "dQw4w9WgXcQ" });
    expect(state.youtubeFallbackSource).toBeNull();
  });

  it("keeps the expected audio and records why when the fetch fails", () => {
    useAudioStore.getState().expectProjectAudio({ kind: "youtube", videoId: "dQw4w9WgXcQ" });
    useAudioStore.getState().failYouTubeLoad("Composer Bridge is not running.", "bridge-unreachable");
    const state = useAudioStore.getState();
    expect(state.source).toBeNull();
    expect(state.expectedAudio).toEqual({ kind: "youtube", videoId: "dQw4w9WgXcQ" });
    expect(state.youtubeLoadError).toBe("Composer Bridge is not running.");
    expect(state.youtubeLoadFailure).toBe("bridge-unreachable");
  });

  it("clears the expected audio once the audio arrives", () => {
    useAudioStore.getState().expectProjectAudio({ kind: "youtube", videoId: "dQw4w9WgXcQ" });
    useAudioStore.getState().setYouTubeFile(new File([new Uint8Array([1])], "song.opus"));
    expect(useAudioStore.getState().expectedAudio).toBeNull();
  });

  it("clears the expected audio when another source replaces it", () => {
    useAudioStore.getState().expectProjectAudio({ kind: "file", name: "city.wav" });
    useAudioStore.getState().setSource({ type: "file", file: new File([new Uint8Array([1])], "other.wav") });
    expect(useAudioStore.getState().expectedAudio).toBeNull();
    useAudioStore.getState().expectProjectAudio({ kind: "file", name: "city.wav" });
    useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
    expect(useAudioStore.getState().expectedAudio).toBeNull();
  });

  describe("edge cases", () => {
    it("a failure without a reason reads as a fetch failure", () => {
      useAudioStore.getState().expectProjectAudio({ kind: "youtube", videoId: "dQw4w9WgXcQ" });
      useAudioStore.getState().failYouTubeLoad("Nope");
      expect(useAudioStore.getState().youtubeLoadFailure).toBe("fetch-failed");
    });

    it("expecting audio again clears the last failure", () => {
      useAudioStore.getState().expectProjectAudio({ kind: "youtube", videoId: "dQw4w9WgXcQ" });
      useAudioStore.getState().failYouTubeLoad("Nope", "bridge-unreachable");
      useAudioStore.getState().expectProjectAudio({ kind: "youtube", videoId: "dQw4w9WgXcQ" });
      expect(useAudioStore.getState()).toMatchObject({ youtubeLoadError: null, youtubeLoadFailure: null });
    });

    it("reset forgets the expected audio", () => {
      useAudioStore.getState().expectProjectAudio({ kind: "file", name: "city.wav" });
      useAudioStore.getState().reset();
      expect(useAudioStore.getState().expectedAudio).toBeNull();
    });

    it("keeps the first expected audio across videos that never loaded", () => {
      useAudioStore.getState().expectProjectAudio({ kind: "file", name: "city.wav" });
      useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
      useAudioStore.getState().setYouTubeSource("9bZkp7q19f0");
      useAudioStore.getState().failYouTubeLoad("boom");
      expect(useAudioStore.getState().expectedAudio).toEqual({ kind: "file", name: "city.wav" });
    });
  });

  describe("regressions", () => {
    it("regression: a failed replacement load restores the file it was replacing", () => {
      useAudioStore.getState().expectProjectAudio({ kind: "file", name: "city.wav" });
      useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
      useAudioStore.getState().failYouTubeLoad("boom");
      expect(useAudioStore.getState().expectedAudio).toEqual({ kind: "file", name: "city.wav" });
    });

    it("regression: a failed replacement load restores the YouTube video it was replacing", () => {
      useAudioStore.getState().expectProjectAudio({ kind: "youtube", videoId: "9bZkp7q19f0" });
      useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
      useAudioStore.getState().failYouTubeLoad("boom");
      expect(useAudioStore.getState().expectedAudio).toEqual({ kind: "youtube", videoId: "9bZkp7q19f0" });
    });

    it("regression: a successful replacement load leaves no expected audio to restore", () => {
      useAudioStore.getState().expectProjectAudio({ kind: "file", name: "city.wav" });
      useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
      useAudioStore.getState().setYouTubeFile(new File([new Uint8Array([1])], "song.opus"));
      expect(useAudioStore.getState().expectedAudio).toBeNull();
    });
  });
});
