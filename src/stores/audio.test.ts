import { beforeEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";

beforeEach(() => {
  useAudioStore.getState().reset();
});

describe("useAudioStore - setYouTubeSource", () => {
  it("sets a youtube source with tunnel info", () => {
    useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ", "https://example.com/tunnel/abc", 1_700_000_000);
    const { source } = useAudioStore.getState();
    expect(source).toEqual({
      type: "youtube",
      videoId: "dQw4w9WgXcQ",
      tunnelUrl: "https://example.com/tunnel/abc",
      tunnelExpiresAt: 1_700_000_000,
    });
  });

  it("sets a youtube source without tunnel info (rehydrate case)", () => {
    useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
    const { source } = useAudioStore.getState();
    expect(source).toEqual({
      type: "youtube",
      videoId: "dQw4w9WgXcQ",
      tunnelUrl: undefined,
      tunnelExpiresAt: undefined,
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

describe("useAudioStore - setYouTubeTunnel", () => {
  it("updates tunnel fields on an existing youtube source", () => {
    useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
    useAudioStore.getState().setYouTubeTunnel("https://example.com/tunnel/new", 1_700_000_999);
    const { source } = useAudioStore.getState();
    expect(source).toEqual({
      type: "youtube",
      videoId: "dQw4w9WgXcQ",
      tunnelUrl: "https://example.com/tunnel/new",
      tunnelExpiresAt: 1_700_000_999,
    });
  });

  it("preserves the videoId when refreshing tunnel", () => {
    useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ", "https://example.com/old", 100);
    useAudioStore.getState().setYouTubeTunnel("https://example.com/new", 999);
    const { source } = useAudioStore.getState();
    if (!source || source.type !== "youtube") throw new Error("expected youtube source");
    expect(source.videoId).toBe("dQw4w9WgXcQ");
    expect(source.tunnelUrl).toBe("https://example.com/new");
    expect(source.tunnelExpiresAt).toBe(999);
  });

  it("is a no-op when no source is set", () => {
    useAudioStore.getState().setYouTubeTunnel("https://example.com/tunnel", 100);
    const { source } = useAudioStore.getState();
    expect(source).toBeNull();
  });

  it("is a no-op when source is a file source", () => {
    const file = new File(["audio"], "test.mp3", { type: "audio/mp3" });
    useAudioStore.getState().setSource({ type: "file", file });
    useAudioStore.getState().setYouTubeTunnel("https://example.com/tunnel", 100);
    const { source } = useAudioStore.getState();
    if (!source || source.type !== "file") throw new Error("expected file source preserved");
    expect(source.file).toBe(file);
  });
});

describe("useAudioStore - reset", () => {
  it("clears youtube source", () => {
    useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ", "https://example.com/tunnel", 100);
    useAudioStore.getState().reset();
    expect(useAudioStore.getState().source).toBeNull();
  });
});
