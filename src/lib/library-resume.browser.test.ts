import { describe, expect, it } from "vitest";
import type { LibraryProject } from "@/domain/project/library-project";
import { MemoryAudioBlobStore } from "@/lib/audio-blob-store";
import { putLibraryProject } from "@/lib/library-persistence";
import { openLibraryProject, restoreAudioForProject } from "@/lib/library-resume";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { DEFAULT_SYLLABLE_SPLIT_DEFAULTS } from "@/stores/project/types";

// -- Helpers ------------------------------------------------------------------

function makeProject(id: string, overrides: Partial<LibraryProject> = {}): LibraryProject {
  const now = Date.now();
  return {
    version: 1,
    id,
    metadata: { title: id, artist: "", album: "", duration: 0 },
    agents: [{ id: "v1", type: "person", name: "Lead" }],
    lines: [],
    groups: [],
    granularity: "line",
    syllableSplitDefaults: DEFAULT_SYLLABLE_SPLIT_DEFAULTS,
    audioBytesCached: false,
    dismissedSuggestions: [],
    dismissedExplicitSuggestions: [],
    currentStem: "original",
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    ...overrides,
  };
}

// -- Tests --------------------------------------------------------------------

describe("library-resume", () => {
  describe("restoreAudioForProject", () => {
    it("loads cached audio bytes from the blob store into the audio source", async () => {
      const audioBlobs = new MemoryAudioBlobStore();
      const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
      await audioBlobs.put("with-bytes", bytes);
      await putLibraryProject(
        makeProject("with-bytes", {
          audioBytesCached: true,
          audioSource: { kind: "file", name: "tune.mp3" },
        }),
      );

      await restoreAudioForProject("with-bytes", { audioBlobs });

      const src = useAudioStore.getState().source;
      expect(src?.type).toBe("file");
      if (src?.type === "file") {
        expect(src.file.name).toBe("tune.mp3");
      }
    });

    it("falls back to youtube source when bytes are not cached", async () => {
      const audioBlobs = new MemoryAudioBlobStore();
      await putLibraryProject(
        makeProject("yt-only", {
          audioBytesCached: false,
          audioSource: { kind: "youtube", videoId: "abc123" },
        }),
      );

      await restoreAudioForProject("yt-only", { audioBlobs });

      const src = useAudioStore.getState().source;
      expect(src?.type).toBe("youtube");
      if (src?.type === "youtube") {
        expect(src.videoId).toBe("abc123");
      }
    });

    it("restores the saved stem onto the separation store", async () => {
      const audioBlobs = new MemoryAudioBlobStore();
      await putLibraryProject(makeProject("with-stem", { currentStem: "vocals" }));

      await restoreAudioForProject("with-stem", { audioBlobs });

      expect(useSeparationStore.getState().currentStem).toBe("vocals");
    });

    it("is a noop when the project does not exist", async () => {
      const audioBlobs = new MemoryAudioBlobStore();
      const before = useAudioStore.getState().source;
      await restoreAudioForProject("missing", { audioBlobs });
      expect(useAudioStore.getState().source).toBe(before);
    });

    it("uses the youtube video id as a fallback filename when audioSource is youtube and bytes are cached", async () => {
      const audioBlobs = new MemoryAudioBlobStore();
      await audioBlobs.put("yt-cached", new Uint8Array([9]).buffer);
      await putLibraryProject(
        makeProject("yt-cached", {
          audioBytesCached: true,
          audioSource: { kind: "youtube", videoId: "xyz" },
        }),
      );

      await restoreAudioForProject("yt-cached", { audioBlobs });

      const src = useAudioStore.getState().source;
      expect(src?.type).toBe("youtube");
      if (src?.type === "youtube") {
        expect(src.videoId).toBe("xyz");
        expect(src.file?.name).toBe("xyz.opus");
      }
    });
  });

  describe("openLibraryProject", () => {
    it("activates the project and restores its audio", async () => {
      const audioBlobs = new MemoryAudioBlobStore();
      const bytes = new Uint8Array([5, 6, 7]).buffer;
      await audioBlobs.put("open", bytes);
      await putLibraryProject(
        makeProject("open", {
          metadata: { title: "Opened", artist: "", album: "", duration: 0 },
          audioBytesCached: true,
          audioSource: { kind: "file", name: "opened.mp3" },
        }),
      );

      await openLibraryProject("open", { audioBlobs });

      expect(useProjectStore.getState().activeProjectId).toBe("open");
      expect(useProjectStore.getState().metadata.title).toBe("Opened");
      expect(useAudioStore.getState().source?.type).toBe("file");
    });
  });
});
