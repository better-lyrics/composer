import {
  clearCachedYouTubeAudio,
  deleteProjectAudio,
  loadProjectAudio,
  removeCachedYouTubeAudio,
  saveProjectAudio,
  unindexedAudioBytes,
} from "@/lib/project-audio";
import { subscribeProjectIndexChanges } from "@/lib/project-index-changes";
import { loadProjectIndexEntry, removeProjectData, saveProjectRecordWithAudio } from "@/lib/project-repository";
import { type StorageSignal, subscribeStorageSignals } from "@/lib/storage-signals";
import { createAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject, storedProject } from "@/test/projects";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

async function seedYouTube(id: string): Promise<File> {
  const audio = createAudioFile(`${id}.opus`);
  await seedStoredProject(id, { project: { audioSource: { kind: "youtube", videoId: `v-${id}` } }, audio });
  return audio;
}

async function seedLocal(id: string): Promise<File> {
  const audio = createAudioFile(`${id}.wav`);
  await seedStoredProject(id, { project: { audioSource: { kind: "file", name: `${id}.wav` } }, audio });
  return audio;
}

function recordSignals(): { seen: StorageSignal[]; stop: () => void } {
  const seen: StorageSignal[] = [];
  const stop = subscribeStorageSignals((signal) => seen.push(signal));
  return { seen, stop };
}

function recordIndexChanges(): { calls: () => number; stop: () => void } {
  let calls = 0;
  const stop = subscribeProjectIndexChanges(() => {
    calls++;
  });
  return { calls: () => calls, stop };
}

// -- Tests --------------------------------------------------------------------

describe("removeCachedYouTubeAudio", () => {
  it("removes the blob and zeroes the index size together, keeping the project a YouTube project", async () => {
    const audio = await seedYouTube("yt");
    const { seen, stop: stopSignals } = recordSignals();
    const { calls, stop: stopIndex } = recordIndexChanges();
    expect(await removeCachedYouTubeAudio(["yt"])).toEqual({ projects: 1, bytes: audio.size });
    stopSignals();
    stopIndex();
    expect(await loadProjectAudio("yt")).toBeUndefined();
    expect(await loadProjectIndexEntry("yt")).toMatchObject({ audioKind: "youtube", storedAudioBytes: 0 });
    expect(seen).toEqual(["media-removed"]);
    expect(calls()).toBe(1);
  });

  it("removes several projects' audio in one call and reports the total", async () => {
    const first = await seedYouTube("yt-a");
    const second = await seedYouTube("yt-b");
    await seedYouTube("yt-kept");
    const { calls, stop } = recordIndexChanges();
    expect(await removeCachedYouTubeAudio(["yt-a", "yt-b"])).toEqual({
      projects: 2,
      bytes: first.size + second.size,
    });
    stop();
    expect(calls()).toBe(1);
    expect(await loadProjectAudio("yt-kept")).toBeDefined();
  });

  it("never removes a local file", async () => {
    await seedLocal("local");
    const { seen, stop: stopSignals } = recordSignals();
    const { calls, stop: stopIndex } = recordIndexChanges();
    expect(await removeCachedYouTubeAudio(["local"])).toEqual({ projects: 0, bytes: 0 });
    stopSignals();
    stopIndex();
    expect(await loadProjectAudio("local")).toBeDefined();
    expect(seen).toEqual([]);
    expect(calls()).toBe(0);
  });

  describe("edge cases", () => {
    it("frees nothing when the YouTube audio is not stored", async () => {
      await seedStoredProject("streamed", { project: { audioSource: { kind: "youtube", videoId: "v" } } });
      expect(await removeCachedYouTubeAudio(["streamed"])).toEqual({ projects: 0, bytes: 0 });
    });

    it("frees nothing for an empty list", async () => {
      await seedYouTube("untouched");
      expect(await removeCachedYouTubeAudio([])).toEqual({ projects: 0, bytes: 0 });
      expect(await loadProjectAudio("untouched")).toBeDefined();
    });

    it("frees nothing for an unknown project", async () => {
      expect(await removeCachedYouTubeAudio(["nobody"])).toEqual({ projects: 0, bytes: 0 });
    });

    it("never removes audio the guard reports as in use, checked inside the same transaction", async () => {
      await seedYouTube("guarded");
      const checked: string[] = [];
      let inUse = false;
      const removal = removeCachedYouTubeAudio(["guarded"], (id) => {
        checked.push(id);
        return inUse;
      });
      inUse = true;
      expect(await removal).toEqual({ projects: 0, bytes: 0 });
      expect(checked).toEqual(["guarded"]);
      expect(await loadProjectAudio("guarded")).toBeDefined();
    });
  });

  describe("regressions", () => {
    it("regression: removing audio of a project deleted in the meantime never brings its index entry back", async () => {
      await seedYouTube("gone");
      await removeProjectData("gone");
      expect(await removeCachedYouTubeAudio(["gone"])).toEqual({ projects: 0, bytes: 0 });
      expect(await loadProjectIndexEntry("gone")).toBeUndefined();
    });
  });
});

describe("clearCachedYouTubeAudio", () => {
  it("removes every cached YouTube audio except the in-use project's and never local files", async () => {
    const first = await seedYouTube("yt1");
    const second = await seedYouTube("yt2");
    const kept = await seedYouTube("open");
    const local = await seedLocal("local");
    const { seen, stop: stopSignals } = recordSignals();
    const { calls, stop: stopIndex } = recordIndexChanges();
    expect(await clearCachedYouTubeAudio((id) => id === "open")).toEqual({
      projects: 2,
      bytes: first.size + second.size,
    });
    stopSignals();
    stopIndex();
    expect(await loadProjectAudio("yt1")).toBeUndefined();
    expect(await loadProjectAudio("yt2")).toBeUndefined();
    expect(await loadProjectAudio("open")).toBeDefined();
    expect(await loadProjectAudio("local")).toBeDefined();
    expect((await loadProjectIndexEntry("yt1"))?.storedAudioBytes).toBe(0);
    expect((await loadProjectIndexEntry("open"))?.storedAudioBytes).toBe(kept.size);
    expect((await loadProjectIndexEntry("local"))?.storedAudioBytes).toBe(local.size);
    expect(seen).toEqual(["media-removed"]);
    expect(calls()).toBe(1);
  });

  describe("edge cases", () => {
    it("removes nothing on an empty device", async () => {
      const { seen, stop: stopSignals } = recordSignals();
      const { calls, stop: stopIndex } = recordIndexChanges();
      expect(await clearCachedYouTubeAudio(() => false)).toEqual({ projects: 0, bytes: 0 });
      stopSignals();
      stopIndex();
      expect(seen).toEqual([]);
      expect(calls()).toBe(0);
    });
  });
});

describe("deleteProjectAudio", () => {
  it("removes the blob, zeroes the index size, and signals both storage and index change", async () => {
    await seedLocal("a");
    const { seen, stop: stopSignals } = recordSignals();
    const { calls, stop: stopIndex } = recordIndexChanges();
    await deleteProjectAudio("a");
    stopSignals();
    stopIndex();
    expect(await loadProjectAudio("a")).toBeUndefined();
    expect((await loadProjectIndexEntry("a"))?.storedAudioBytes).toBe(0);
    expect(seen).toEqual(["media-removed"]);
    expect(calls()).toBe(1);
  });

  describe("edge cases", () => {
    it("stays quiet when there is no audio to remove", async () => {
      await seedStoredProject("a");
      const { seen, stop: stopSignals } = recordSignals();
      const { calls, stop: stopIndex } = recordIndexChanges();
      await deleteProjectAudio("a");
      stopSignals();
      stopIndex();
      expect(seen).toEqual([]);
      expect(calls()).toBe(0);
    });

    it("stays quiet for an unknown project", async () => {
      const { seen, stop: stopSignals } = recordSignals();
      const { calls, stop: stopIndex } = recordIndexChanges();
      await deleteProjectAudio("nobody");
      stopSignals();
      stopIndex();
      expect(seen).toEqual([]);
      expect(calls()).toBe(0);
    });
  });

  describe("error paths", () => {
    it("keeps the audio and stays quiet when the guard reports the project in use inside the transaction", async () => {
      await seedLocal("a");
      const { seen, stop: stopSignals } = recordSignals();
      expect(await deleteProjectAudio("a", (id) => id === "a")).toBe("in-use");
      stopSignals();
      expect(await loadProjectAudio("a")).toBeDefined();
      expect(seen).toEqual([]);
    });
  });
});

describe("unindexedAudioBytes", () => {
  it("counts audio that has no index entry yet and ignores indexed audio", async () => {
    await seedLocal("indexed");
    const early = createAudioFile("early.wav");
    await saveProjectAudio("fresh", early);
    expect(await unindexedAudioBytes()).toBe(early.size);
  });

  describe("edge cases", () => {
    it("is zero when every blob is indexed", async () => {
      await seedLocal("indexed");
      expect(await unindexedAudioBytes()).toBe(0);
    });
  });
});

describe("media signals", () => {
  it("saving audio signals media stored", async () => {
    await seedStoredProject("a");
    const { seen, stop } = recordSignals();
    await saveProjectAudio("a", createAudioFile("a.wav"));
    stop();
    expect(seen).toEqual(["media-stored"]);
  });

  it("a record saved with audio signals media stored, and without audio does not", async () => {
    const { seen, stop } = recordSignals();
    await saveProjectRecordWithAudio("a", storedProject(), createAudioFile("a.wav"));
    await saveProjectRecordWithAudio("b", storedProject(), undefined);
    stop();
    expect(seen).toEqual(["media-stored"]);
  });
});
