import { describe, expect, it } from "vitest";
import type { LibraryProject } from "@/domain/project/library-project";
import { type AudioBlobStore, MemoryAudioBlobStore } from "@/lib/audio-blob-store";
import { getLibraryProject, putLibraryProject } from "@/lib/library-persistence";
import { saveActiveProject, saveActiveProjectAudio } from "@/lib/library-save";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
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

async function seedAndActivate(id: string, overrides: Partial<LibraryProject> = {}): Promise<void> {
  await putLibraryProject(makeProject(id, overrides));
  await useProjectStore.getState().setActiveProject(id, { audioBlobs: new MemoryAudioBlobStore() });
}

// -- Happy paths --------------------------------------------------------------

describe("library-save · happy paths", () => {
  it("saveActiveProject writes store state to the library record", async () => {
    await seedAndActivate("p1");
    useProjectStore.getState().setMetadata({ title: "New Title" });

    await saveActiveProject();

    const reloaded = await getLibraryProject("p1");
    expect(reloaded?.metadata.title).toBe("New Title");
  });

  it("saveActiveProjectAudio(file) puts bytes via the blob store and sets audioBytesCached true", async () => {
    await seedAndActivate("p1");
    const audioBlobs = new MemoryAudioBlobStore();
    const file = new File([new Uint8Array([1, 2, 3])], "song.mp3", { type: "audio/mpeg" });

    await saveActiveProjectAudio(file, { audioBlobs });

    const bytes = await audioBlobs.get("p1");
    expect(bytes).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(bytes as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));

    const reloaded = await getLibraryProject("p1");
    expect(reloaded?.audioBytesCached).toBe(true);
  });

  it("saveActiveProjectAudio(null) deletes bytes and sets audioBytesCached false", async () => {
    await seedAndActivate("p1", { audioBytesCached: true });
    const audioBlobs = new MemoryAudioBlobStore();
    await audioBlobs.put("p1", new Uint8Array([9, 8, 7]).buffer);

    await saveActiveProjectAudio(null, { audioBlobs });

    expect(await audioBlobs.has("p1")).toBe(false);
    const reloaded = await getLibraryProject("p1");
    expect(reloaded?.audioBytesCached).toBe(false);
  });
});

// -- Edge cases ---------------------------------------------------------------

describe("library-save · edge cases", () => {
  it("no-op when activeProjectId is undefined (save)", async () => {
    await putLibraryProject(
      makeProject("p1", { metadata: { title: "Untouched", artist: "", album: "", duration: 0 } }),
    );
    expect(useProjectStore.getState().activeProjectId).toBeUndefined();

    await saveActiveProject();

    const reloaded = await getLibraryProject("p1");
    expect(reloaded?.metadata.title).toBe("Untouched");
  });

  it("no-op when activeProjectId is undefined (audio save)", async () => {
    const audioBlobs = new MemoryAudioBlobStore();
    const file = new File([new Uint8Array([1])], "x.mp3", { type: "audio/mpeg" });

    await saveActiveProjectAudio(file, { audioBlobs });

    expect(await audioBlobs.has("any")).toBe(false);
    expect(await audioBlobs.listIds()).toEqual([]);
  });

  it("preserves createdAt, pinned, cachedWaveformDataUrl across save", async () => {
    await seedAndActivate("p1", {
      createdAt: 1000,
      pinned: true,
      cachedWaveformDataUrl: "data:image/svg+xml;base64,abc",
    });

    useProjectStore.getState().setMetadata({ title: "Changed" });
    await saveActiveProject();

    const reloaded = await getLibraryProject("p1");
    expect(reloaded?.createdAt).toBe(1000);
    expect(reloaded?.pinned).toBe(true);
    expect(reloaded?.cachedWaveformDataUrl).toBe("data:image/svg+xml;base64,abc");
    expect(reloaded?.metadata.title).toBe("Changed");
  });

  it("creates a fresh record when activeProjectId points at a deleted library entry", async () => {
    await seedAndActivate("p1");
    useProjectStore.setState({ activeProjectId: "ghost" });
    useProjectStore.getState().setMetadata({ title: "Resurrected" });

    await saveActiveProject();

    const reloaded = await getLibraryProject("ghost");
    expect(reloaded?.id).toBe("ghost");
    expect(reloaded?.metadata.title).toBe("Resurrected");
  });
});

// -- Invariants ---------------------------------------------------------------

describe("library-save · invariants", () => {
  it("updatedAt advances on every saveActiveProject call", async () => {
    await seedAndActivate("p1", { updatedAt: 100 });

    await saveActiveProject();
    const first = (await getLibraryProject("p1"))?.updatedAt ?? 0;
    expect(first).toBeGreaterThan(100);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await saveActiveProject();
    const second = (await getLibraryProject("p1"))?.updatedAt ?? 0;
    expect(second).toBeGreaterThanOrEqual(first);
  });

  it("audio save preserves the rest of the library record", async () => {
    await seedAndActivate("p1", {
      createdAt: 1000,
      pinned: true,
      cachedWaveformDataUrl: "data:image/svg+xml;base64,abc",
      metadata: { title: "Persisted", artist: "X", album: "Y", duration: 60 },
    });

    const audioBlobs = new MemoryAudioBlobStore();
    const file = new File([new Uint8Array([5])], "song.mp3", { type: "audio/mpeg" });
    await saveActiveProjectAudio(file, { audioBlobs });

    const reloaded = await getLibraryProject("p1");
    expect(reloaded?.createdAt).toBe(1000);
    expect(reloaded?.pinned).toBe(true);
    expect(reloaded?.cachedWaveformDataUrl).toBe("data:image/svg+xml;base64,abc");
    expect(reloaded?.metadata.title).toBe("Persisted");
  });
});

// -- Races --------------------------------------------------------------------

class SlowAudioBlobStore implements AudioBlobStore {
  private readonly inner = new MemoryAudioBlobStore();
  private readonly delayMs: number;
  private readonly onPut?: () => void;

  constructor(delayMs: number, onPut?: () => void) {
    this.delayMs = delayMs;
    this.onPut = onPut;
  }

  async get(projectId: string) {
    return this.inner.get(projectId);
  }
  async put(projectId: string, bytes: ArrayBuffer) {
    this.onPut?.();
    await new Promise((r) => setTimeout(r, this.delayMs));
    await this.inner.put(projectId, bytes);
  }
  async delete(projectId: string) {
    await new Promise((r) => setTimeout(r, this.delayMs));
    await this.inner.delete(projectId);
  }
  async has(projectId: string) {
    return this.inner.has(projectId);
  }
  async listIds() {
    return this.inner.listIds();
  }
}

describe("library-save · concurrency races", () => {
  it("regression: concurrent saveActiveProjectAudio does not get audioBytesCached clobbered to false by saveActiveProject", async () => {
    await putLibraryProject(
      makeProject("p1", {
        metadata: { title: "race", artist: "", album: "", duration: 0 },
        audioBytesCached: false,
      }),
    );

    await useProjectStore.getState().setActiveProject("p1", { audioBlobs: new MemoryAudioBlobStore() });
    useProjectStore.getState().setMetadata({ title: "Edited" });

    const audioSavePromise = saveActiveProjectAudio(
      new File([new Uint8Array([1, 2, 3])], "song.mp3", { type: "audio/mpeg" }),
      { audioBlobs: new MemoryAudioBlobStore() },
    );
    const projectSavePromise = saveActiveProject();
    await audioSavePromise;
    await projectSavePromise;

    const reloaded = await getLibraryProject("p1");
    expect(reloaded?.audioBytesCached).toBe(true);
    expect(reloaded?.metadata.title).toBe("Edited");
  });

  it("regression: setActiveProject during audio save does not leak the new project's audio source into the old record", async () => {
    await putLibraryProject(makeProject("A", { metadata: { title: "A song", artist: "", album: "", duration: 0 } }));
    await putLibraryProject(makeProject("B", { metadata: { title: "B song", artist: "", album: "", duration: 0 } }));

    const audioBlobs = new MemoryAudioBlobStore();
    await useProjectStore.getState().setActiveProject("A", { audioBlobs });

    const aFile = new File([new Uint8Array([1, 2, 3])], "a-track.mp3", { type: "audio/mpeg" });
    useAudioStore.getState().setSource({ type: "file", file: aFile });

    const slow = new SlowAudioBlobStore(40, () => {
      void (async () => {
        await useProjectStore.getState().setActiveProject("B", { audioBlobs });
        useAudioStore
          .getState()
          .setSource({ type: "file", file: new File([new Uint8Array([9])], "b-track.mp3", { type: "audio/mpeg" }) });
      })();
    });

    await saveActiveProjectAudio(aFile, { audioBlobs: slow });
    await new Promise((r) => setTimeout(r, 20));

    const reloadedA = await getLibraryProject("A");
    expect(reloadedA?.audioSource).toEqual({ kind: "file", name: "a-track.mp3" });
    expect(reloadedA?.audioBytesCached).toBe(true);
  });
});
