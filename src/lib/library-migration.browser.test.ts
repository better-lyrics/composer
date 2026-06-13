import { describe, expect, it } from "vitest";
import type { LibraryProject } from "@/domain/project/library-project";
import { MemoryAudioBlobStore } from "@/lib/audio-blob-store";
import { listLibraryProjects, putLibraryProject } from "@/lib/library-persistence";
import { migrateSingleSlotToLibrary } from "@/lib/library-migration";
import { clearCurrentProject, loadCurrentProject, saveAudioFile, saveCurrentProject } from "@/lib/persistence";
import { DEFAULT_SYLLABLE_SPLIT_DEFAULTS } from "@/stores/project/types";

// -- Helpers ------------------------------------------------------------------

async function seedOldSlot(
  opts: {
    title?: string;
    artist?: string;
    audioSource?: { kind: "file"; name: string } | { kind: "youtube"; videoId: string } | undefined;
  } = {},
): Promise<void> {
  await saveCurrentProject(
    { title: opts.title ?? "Old Song", artist: opts.artist ?? "Test", album: "", duration: 0 },
    [],
    [],
    [],
    "word",
    DEFAULT_SYLLABLE_SPLIT_DEFAULTS,
    opts.audioSource === undefined ? undefined : opts.audioSource,
    [],
    [],
    "original",
    false,
  );
}

function makeLibraryProject(id: string, overrides: Partial<LibraryProject> = {}): LibraryProject {
  const now = Date.now();
  return {
    version: 1,
    id,
    metadata: { title: id, artist: "", album: "", duration: 0 },
    agents: [],
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

// -- Happy paths --------------------------------------------------------------

describe("library-migration · happy paths", () => {
  it("migrates an existing single-slot project to a LibraryProject and copies audio bytes", async () => {
    await seedOldSlot({ title: "Old Song", audioSource: { kind: "file", name: "old.mp3" } });
    await saveAudioFile(new File([new Uint8Array([1, 2, 3])], "old.mp3", { type: "audio/mpeg" }));

    const audioBlobs = new MemoryAudioBlobStore();
    const result = await migrateSingleSlotToLibrary({ audioBlobs });

    expect(typeof result.migratedId).toBe("string");

    const list = await listLibraryProjects();
    expect(list.length).toBe(1);
    expect(list[0].metadata.title).toBe("Old Song");
    expect(list[0].audioBytesCached).toBe(true);
    expect(list[0].audioSource).toEqual({ kind: "file", name: "old.mp3" });

    const bytes = await audioBlobs.get(result.migratedId as string);
    expect(bytes).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(bytes as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));

    expect(await loadCurrentProject()).toBeUndefined();
  });

  it("returns {} when there is no single-slot data", async () => {
    const result = await migrateSingleSlotToLibrary({ audioBlobs: new MemoryAudioBlobStore() });
    expect(result).toEqual({});
    expect(result.migratedId).toBeUndefined();
  });

  it("is idempotent: running twice does not create duplicates", async () => {
    await seedOldSlot({ audioSource: { kind: "file", name: "old.mp3" } });
    await saveAudioFile(new File([new Uint8Array([9])], "old.mp3", { type: "audio/mpeg" }));

    const audioBlobs = new MemoryAudioBlobStore();
    await migrateSingleSlotToLibrary({ audioBlobs });
    await migrateSingleSlotToLibrary({ audioBlobs });

    const list = await listLibraryProjects();
    expect(list.length).toBe(1);
  });
});

// -- Edge cases ---------------------------------------------------------------

describe("library-migration · edge cases", () => {
  it("migrates a project that has no audioSource (lyrics-only)", async () => {
    await seedOldSlot({ title: "Lyrics Only", audioSource: undefined });

    const audioBlobs = new MemoryAudioBlobStore();
    const result = await migrateSingleSlotToLibrary({ audioBlobs });

    const list = await listLibraryProjects();
    expect(list.length).toBe(1);
    expect(list[0].audioBytesCached).toBe(false);
    expect(list[0].audioSource).toBeUndefined();
    expect(await audioBlobs.has(result.migratedId as string)).toBe(false);
  });

  it("uses old savedAt as the new createdAt and now() for updatedAt/lastOpenedAt", async () => {
    const before = Date.now();
    await seedOldSlot({ audioSource: undefined });
    const after = Date.now();

    const result = await migrateSingleSlotToLibrary({ audioBlobs: new MemoryAudioBlobStore() });
    expect(result.migratedId).toBeDefined();

    const list = await listLibraryProjects();
    const project = list[0];

    expect(project.createdAt).toBeGreaterThanOrEqual(before);
    expect(project.createdAt).toBeLessThanOrEqual(after);
    expect(project.updatedAt).toBeGreaterThanOrEqual(project.createdAt);
    expect(project.lastOpenedAt).toBeGreaterThanOrEqual(project.createdAt);
  });

  it("migrates a YouTube audio source without an audio file blob", async () => {
    await seedOldSlot({
      title: "YT Song",
      audioSource: { kind: "youtube", videoId: "abc123" },
    });

    const audioBlobs = new MemoryAudioBlobStore();
    const result = await migrateSingleSlotToLibrary({ audioBlobs });

    const list = await listLibraryProjects();
    expect(list[0].audioSource).toEqual({ kind: "youtube", videoId: "abc123" });
    expect(list[0].audioBytesCached).toBe(false);
    expect(await audioBlobs.has(result.migratedId as string)).toBe(false);
  });
});

// -- Invariants ---------------------------------------------------------------

describe("library-migration · invariants", () => {
  it("when the library already has entries, returns the most-recent existing id without disturbing the old slot", async () => {
    const existing = makeLibraryProject("existing-1", {
      lastOpenedAt: 999,
      metadata: { title: "Existing", artist: "", album: "", duration: 0 },
    });
    await putLibraryProject(existing);

    await seedOldSlot({ title: "Should Not Migrate", audioSource: { kind: "file", name: "x.mp3" } });

    const result = await migrateSingleSlotToLibrary({ audioBlobs: new MemoryAudioBlobStore() });

    expect(result.migratedId).toBe("existing-1");

    const list = await listLibraryProjects();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("existing-1");

    const oldSlot = await loadCurrentProject();
    expect(oldSlot).toBeDefined();
    expect(oldSlot?.metadata.title).toBe("Should Not Migrate");
  });

  it("returns the pinned/most-recent project when multiple library entries exist", async () => {
    await putLibraryProject(makeLibraryProject("a", { lastOpenedAt: 100, pinned: false }));
    await putLibraryProject(makeLibraryProject("b", { lastOpenedAt: 500, pinned: false }));
    await putLibraryProject(makeLibraryProject("c", { lastOpenedAt: 50, pinned: true }));

    const result = await migrateSingleSlotToLibrary({ audioBlobs: new MemoryAudioBlobStore() });
    expect(result.migratedId).toBe("c");
  });

  it("after a successful migration, a subsequent call falls through the library-non-empty branch", async () => {
    await seedOldSlot({ audioSource: undefined });
    const audioBlobs = new MemoryAudioBlobStore();
    const first = await migrateSingleSlotToLibrary({ audioBlobs });
    expect(first.migratedId).toBeDefined();

    const second = await migrateSingleSlotToLibrary({ audioBlobs });
    expect(second.migratedId).toBe(first.migratedId);

    expect((await listLibraryProjects()).length).toBe(1);
  });

  it("flags justMigrated only on the call that actually moved data, not on subsequent resumes", async () => {
    await seedOldSlot({ audioSource: undefined });
    const audioBlobs = new MemoryAudioBlobStore();
    const first = await migrateSingleSlotToLibrary({ audioBlobs });
    expect(first.justMigrated).toBe(true);

    const second = await migrateSingleSlotToLibrary({ audioBlobs });
    expect(second.justMigrated).toBeUndefined();
  });

  it("clears both the old project slot and the old audio file after migration", async () => {
    await seedOldSlot({ audioSource: { kind: "file", name: "old.mp3" } });
    await saveAudioFile(new File([new Uint8Array([42])], "old.mp3", { type: "audio/mpeg" }));

    await migrateSingleSlotToLibrary({ audioBlobs: new MemoryAudioBlobStore() });

    expect(await loadCurrentProject()).toBeUndefined();

    await clearCurrentProject();
    expect(await loadCurrentProject()).toBeUndefined();
  });
});
