import {
  beginLoadingStemJob,
  endLoadingStemJob,
  isStemJobLoading,
  listStemJobs,
  putStem,
  stemJobKey,
} from "@/audio/separation/stem-store";
import { storageUsage } from "@/domain/storage/usage";
import { openProject } from "@/lib/open-project";
import { adoptOpenProjectId } from "@/lib/open-project-session";
import { PROJECT_INDEX_STORE_NAME, setInStore } from "@/lib/persistence-idb";
import { loadProjectAudio } from "@/lib/project-audio";
import { listProjectIndex, loadProjectIndexEntry } from "@/lib/project-repository";
import { type CleanupContext, runSmartCleanup } from "@/lib/storage-cleanup";
import { subscribeStorageSignals } from "@/lib/storage-signals";
import { createAudioFile } from "@/test/audio-fixtures";
import { indexEntry } from "@/test/index-entries";
import { seedStoredProject } from "@/test/projects";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const EVERYTHING: Omit<CleanupContext, "limitBytes"> = {
  smartCleanup: true,
  isStemJobInUse: () => false,
  storageFull: false,
};

function onFirstMediaRemoved(callback: () => void): void {
  const stop = subscribeStorageSignals((signal) => {
    if (signal !== "media-removed") return;
    stop();
    callback();
  });
}

async function seedYouTube(id: string, openedAt: number): Promise<void> {
  await seedStoredProject(id, {
    project: { audioSource: { kind: "youtube", videoId: `v-${id}` } },
    audio: createAudioFile(`${id}.opus`),
  });
  await setInStore(PROJECT_INDEX_STORE_NAME, id, { ...(await loadProjectIndexEntry(id)), openedAt });
}

async function seedLocal(id: string): Promise<void> {
  await seedStoredProject(id, {
    project: { audioSource: { kind: "file", name: `${id}.wav` } },
    audio: createAudioFile(`${id}.wav`),
  });
}

async function seedStems(hash: string): Promise<void> {
  await putStem(hash, "vocals", "fp32", new Blob([new Uint8Array(64)]));
  await putStem(hash, "instrumental", "fp32", new Blob([new Uint8Array(64)]));
}

async function usedBytes(): Promise<number> {
  return storageUsage(await listProjectIndex(), await listStemJobs()).totalBytes;
}

// -- Tests --------------------------------------------------------------------

describe("runSmartCleanup", () => {
  it("frees space past the limit by removing stems first", async () => {
    await seedStems("h1");
    await seedYouTube("yt", 10);
    const result = await runSmartCleanup({ ...EVERYTHING, limitBytes: (await usedBytes()) - 1 });
    expect(result).toEqual({ freedBytes: 128, removedStemJobs: 1, removedYouTubeAudio: 0 });
    expect(await listStemJobs()).toEqual([]);
    expect(await loadProjectAudio("yt")).toBeDefined();
  });

  it("then removes YouTube audio least recently opened first", async () => {
    await seedYouTube("recent", 900);
    await seedYouTube("stale", 100);
    const staleBytes = (await loadProjectIndexEntry("stale"))?.storedAudioBytes ?? 0;
    const result = await runSmartCleanup({ ...EVERYTHING, limitBytes: (await usedBytes()) - 1 });
    expect(result).toEqual({ freedBytes: staleBytes, removedStemJobs: 0, removedYouTubeAudio: 1 });
    expect(await loadProjectAudio("stale")).toBeUndefined();
    expect(await loadProjectAudio("recent")).toBeDefined();
  });

  it("frees plenty after a quota error even with no limit", async () => {
    await seedStems("h1");
    await seedYouTube("yt", 10);
    const result = await runSmartCleanup({ ...EVERYTHING, limitBytes: undefined, storageFull: true });
    expect(result.removedStemJobs).toBe(1);
    expect(result.removedYouTubeAudio).toBe(1);
  });

  describe("never removes", () => {
    it("local files", async () => {
      await seedLocal("local");
      await runSmartCleanup({ ...EVERYTHING, limitBytes: 0 });
      expect(await loadProjectAudio("local")).toBeDefined();
    });

    it("the open project's audio", async () => {
      await seedYouTube("open", 1);
      adoptOpenProjectId("open");
      await runSmartCleanup({ ...EVERYTHING, limitBytes: 0 });
      expect(await loadProjectAudio("open")).toBeDefined();
    });

    it("the open project's stems", async () => {
      await seedStems("mine");
      const key = stemJobKey("mine", "fp32");
      await runSmartCleanup({ ...EVERYTHING, limitBytes: 0, isStemJobInUse: (jobKey) => jobKey === key });
      expect((await listStemJobs()).map((job) => job.jobKey)).toEqual([key]);
    });

    it("a stem job's stems if it starts loading while the cleanup reads what is stored", async () => {
      await seedStems("mine");
      const key = stemJobKey("mine", "fp32");
      const resultPromise = runSmartCleanup({ ...EVERYTHING, limitBytes: 0, isStemJobInUse: isStemJobLoading });
      beginLoadingStemJob(key);
      try {
        await resultPromise;
      } finally {
        endLoadingStemJob(key);
      }
      expect((await listStemJobs()).map((job) => job.jobKey)).toEqual([key]);
    });

    it("a stem job's stems if it comes into use after planning, checked inside the removal", async () => {
      await seedStems("mine");
      const key = stemJobKey("mine", "fp32");
      let planned = false;
      const isStemJobInUse = (jobKey: string): boolean => {
        if (!planned) {
          planned = true;
          return false;
        }
        return jobKey === key;
      };
      const result = await runSmartCleanup({ ...EVERYTHING, limitBytes: 0, isStemJobInUse });
      expect(result.removedStemJobs).toBe(0);
      expect((await listStemJobs()).map((job) => job.jobKey)).toEqual([key]);
    });

    it("a project's audio if it starts opening after planning, while the stems are still being removed", async () => {
      await seedStems("h1");
      await seedYouTube("decoy", 1);
      await seedYouTube("opening", 50);
      let opening: Promise<void> | undefined;
      onFirstMediaRemoved(() => {
        opening = openProject("opening");
      });
      const result = await runSmartCleanup({ ...EVERYTHING, limitBytes: 0 });
      expect(result.removedStemJobs).toBe(1);
      expect(result.removedYouTubeAudio).toBe(1);
      expect(await loadProjectAudio("decoy")).toBeUndefined();
      expect(await loadProjectAudio("opening")).toBeDefined();
      await opening;
    });

    it("a project's audio if it becomes the open project after planning, while the stems are still being removed", async () => {
      await seedStems("h1");
      await seedYouTube("decoy", 1);
      await seedYouTube("switching", 50);
      onFirstMediaRemoved(() => {
        adoptOpenProjectId("switching");
      });
      const result = await runSmartCleanup({ ...EVERYTHING, limitBytes: 0 });
      expect(result.removedStemJobs).toBe(1);
      expect(result.removedYouTubeAudio).toBe(1);
      expect(await loadProjectAudio("decoy")).toBeUndefined();
      expect(await loadProjectAudio("switching")).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("does nothing with Smart cleanup off", async () => {
      await seedStems("h1");
      await seedYouTube("yt", 1);
      const result = await runSmartCleanup({ ...EVERYTHING, smartCleanup: false, limitBytes: 0, storageFull: true });
      expect(result).toEqual({ freedBytes: 0, removedStemJobs: 0, removedYouTubeAudio: 0 });
      expect(await listStemJobs()).toHaveLength(1);
    });

    it("does nothing under the limit", async () => {
      await seedYouTube("yt", 1);
      const result = await runSmartCleanup({ ...EVERYTHING, limitBytes: (await usedBytes()) + 1 });
      expect(result.freedBytes).toBe(0);
    });

    it("handles entries saved before openedAt existed", async () => {
      await seedYouTube("old", 1);
      const { openedAt: _openedAt, ...withoutOpenedAt } = (await loadProjectIndexEntry("old")) ?? indexEntry("old");
      await setInStore(PROJECT_INDEX_STORE_NAME, "old", withoutOpenedAt);
      const result = await runSmartCleanup({ ...EVERYTHING, limitBytes: 0 });
      expect(result.removedYouTubeAudio).toBe(1);
    });
  });

  describe("invariants", () => {
    it("the index and the blobs agree after cleanup", async () => {
      await seedYouTube("a", 1);
      await seedYouTube("b", 2);
      await runSmartCleanup({ ...EVERYTHING, limitBytes: 0 });
      for (const id of ["a", "b"]) {
        const stored = (await loadProjectIndexEntry(id))?.storedAudioBytes ?? 0;
        expect(stored === 0).toBe((await loadProjectAudio(id)) === undefined);
      }
    });
  });
});
