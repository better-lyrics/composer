import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useLoadYouTubeSource } from "@/hooks/useLoadYouTubeSource";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";

const VIDEO_ID = "dQw4w9WgXcQ";
const OTHER_VIDEO_ID = "9bZkp7q19f0";

function createAudioFile(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], `${name}.opus`, { type: "audio/ogg" });
}

describe("useLoadYouTubeSource", () => {
  it("resolves when the tunnel populates source.file for the requested videoId", async () => {
    const { result } = await renderHook(() => useLoadYouTubeSource());
    const loadYouTubeSource = result.current;

    const pending = loadYouTubeSource(VIDEO_ID);
    useAudioStore.getState().setYouTubeFile(createAudioFile(VIDEO_ID));
    await expect(pending).resolves.toBeUndefined();
  });

  it("rejects when youtubeLoadError is set after kickoff", async () => {
    const { result } = await renderHook(() => useLoadYouTubeSource());
    const loadYouTubeSource = result.current;

    const pending = loadYouTubeSource(VIDEO_ID);
    useAudioStore.getState().setYouTubeLoadError("Could not load that video. Try again.");
    await expect(pending).rejects.toThrow("Could not load that video. Try again.");
  });

  it("rejects when source is replaced before the file lands", async () => {
    const { result } = await renderHook(() => useLoadYouTubeSource());
    const loadYouTubeSource = result.current;

    const pending = loadYouTubeSource(VIDEO_ID);
    useAudioStore.getState().setSource(null);
    await expect(pending).rejects.toThrow("youtube_load_superseded");
  });

  it("handles concurrent calls for different videoIds without cross-talk", async () => {
    const { result } = await renderHook(() => useLoadYouTubeSource());
    const loadYouTubeSource = result.current;

    const firstPending = loadYouTubeSource(VIDEO_ID);
    const secondPending = loadYouTubeSource(OTHER_VIDEO_ID);

    await expect(firstPending).rejects.toThrow("youtube_load_superseded");

    useAudioStore.getState().setYouTubeFile(createAudioFile(OTHER_VIDEO_ID));
    await expect(secondPending).resolves.toBeUndefined();
  });

  it("preserves the project title when one already exists and the videoId is unchanged", async () => {
    useAudioStore.getState().setYouTubeSource(VIDEO_ID);
    useProjectStore.getState().setMetadata({ title: "Custom Title" });

    const { result } = await renderHook(() => useLoadYouTubeSource());
    const pending = result.current(VIDEO_ID);
    pending.catch(() => {});

    expect(useProjectStore.getState().metadata.title).toBe("Custom Title");
  });

  it("sets the project title to the videoId on a fresh load", async () => {
    useProjectStore.getState().setMetadata({ title: "" });

    const { result } = await renderHook(() => useLoadYouTubeSource());
    const pending = result.current(VIDEO_ID);
    pending.catch(() => {});

    expect(useProjectStore.getState().metadata.title).toBe(VIDEO_ID);
  });

  describe("replacing the song", () => {
    const previousSong = {
      title: "Lovefield",
      artists: ["underscores"],
      album: "U",
      duration: 0,
      isrc: "USQE92600028",
      songwriters: ["April Harper Grey"],
      extra: { producer: "someone" },
      language: "en",
      thumbnailDataUrl: "data:image/png;base64,AAAA",
      thumbnailForVideoId: VIDEO_ID,
    };

    async function load(videoId: string) {
      const { result } = await renderHook(() => useLoadYouTubeSource());
      result.current(videoId).catch(() => {});
    }

    it("regression: loading a different video resets the previous song's singer names", async () => {
      useAudioStore.getState().setYouTubeSource(VIDEO_ID);
      useProjectStore.setState({
        metadata: previousSong,
        agents: [
          { id: "v1", type: "person", name: "April Harper Grey" },
          { id: "v2", type: "person", name: "Guest" },
        ],
      });

      await load(OTHER_VIDEO_ID);

      expect(useProjectStore.getState().agents).toEqual([
        { id: "v1", type: "person", name: "Lead" },
        { id: "v2", type: "person" },
      ]);
    });

    it("keeps singer names when the same video is loaded again", async () => {
      useAudioStore.getState().setYouTubeSource(VIDEO_ID);
      const agents = [{ id: "v1", type: "person" as const, name: "April Harper Grey" }];
      useProjectStore.setState({ metadata: previousSong, agents });

      await load(VIDEO_ID);

      expect(useProjectStore.getState().agents).toEqual(agents);
    });

    it("regression: loading a different video clears the previous song's metadata", async () => {
      useAudioStore.getState().setYouTubeSource(VIDEO_ID);
      useProjectStore.setState({ metadata: previousSong });

      await load(OTHER_VIDEO_ID);

      const metadata = useProjectStore.getState().metadata;
      expect(metadata.title).toBe(OTHER_VIDEO_ID);
      expect(metadata.artists).toEqual([]);
      expect(metadata.album).toBe("");
      expect(metadata.isrc).toBeUndefined();
      expect(metadata.songwriters).toBeUndefined();
      expect(metadata.extra).toBeUndefined();
      expect(metadata.language).toBeUndefined();
      expect(metadata.thumbnailDataUrl).toBeUndefined();
      expect(metadata.thumbnailForVideoId).toBeUndefined();
    });

    it("clears the previous song's metadata when a video replaces a file source", async () => {
      useAudioStore.setState({ source: { type: "file", file: createAudioFile("Lovefield") } });
      useProjectStore.setState({ metadata: previousSong });

      await load(VIDEO_ID);

      expect(useProjectStore.getState().metadata.artists).toEqual([]);
      expect(useProjectStore.getState().metadata.isrc).toBeUndefined();
    });

    it("keeps all metadata when the same video is loaded again", async () => {
      useAudioStore.getState().setYouTubeSource(VIDEO_ID);
      useProjectStore.setState({ metadata: previousSong });

      await load(VIDEO_ID);

      expect(useProjectStore.getState().metadata).toEqual(previousSong);
    });

    it("keeps metadata entered before the first audio source is loaded", async () => {
      useAudioStore.setState({ source: null });
      useProjectStore.setState({ metadata: previousSong });

      await load(VIDEO_ID);

      expect(useProjectStore.getState().metadata.artists).toEqual(["underscores"]);
      expect(useProjectStore.getState().metadata.isrc).toBe("USQE92600028");
    });
  });
});
