import { subscribeProjectIndexChanges } from "@/lib/project-index-changes";
import { loadProjectAudio, saveProjectAudio } from "@/lib/project-audio";
import {
  loadProjectIndexEntry,
  markProjectOpened,
  removeProjectData,
  saveProjectRecord,
  saveProjectRecordWithAudio,
  setProjectLastTab,
  updateProjectRecord,
} from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { ProjectDeletedError } from "@/lib/project-tombstones";
import { createAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject, songTitled, storedProject } from "@/test/projects";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function countChanges(): { read: () => number; stop: () => void } {
  let changes = 0;
  const stop = subscribeProjectIndexChanges(() => {
    changes += 1;
  });
  return { read: () => changes, stop };
}

// -- Tests --------------------------------------------------------------------

describe("updateProjectRecord", () => {
  it("rewrites the record and its index entry in one step", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha") });
    await updateProjectRecord("a", (project) => ({ ...project, metadata: { ...project.metadata, title: "Renamed" } }));
    expect((await loadProjectRecord("a"))?.metadata.title).toBe("Renamed");
    expect((await loadProjectIndexEntry("a"))?.title).toBe("Renamed");
  });

  it("keeps the fields the record does not own", async () => {
    await seedStoredProject("a", { audio: createAudioFile("alpha.wav") });
    await markProjectOpened("a", 777);
    await setProjectLastTab("a", "sync");
    const before = await loadProjectIndexEntry("a");
    await updateProjectRecord("a", (project) => ({ ...project, savedAt: 999 }));
    const after = await loadProjectIndexEntry("a");
    expect(after).toMatchObject({ openedAt: 777, lastTab: "sync", updatedAt: 999 });
    expect(after?.storedAudioBytes).toBe(before?.storedAudioBytes);
    expect(after?.storedAudioBytes).toBeGreaterThan(0);
  });

  describe("error paths", () => {
    it("rejects a project that is not stored and writes nothing", async () => {
      await expect(updateProjectRecord("missing", (project) => project)).rejects.toThrow(/not stored/);
      expect(await loadProjectRecord("missing")).toBeUndefined();
    });

    it("rejects a deleted project with ProjectDeletedError", async () => {
      await seedStoredProject("a");
      await removeProjectData("a");
      await expect(updateProjectRecord("a", (project) => project)).rejects.toBeInstanceOf(ProjectDeletedError);
    });

    it("aborts and writes nothing when the update throws", async () => {
      await seedStoredProject("a", { project: songTitled("Alpha") });
      await expect(
        updateProjectRecord("a", () => {
          throw new Error("bad update");
        }),
      ).rejects.toThrow("bad update");
      expect((await loadProjectRecord("a"))?.metadata.title).toBe("Alpha");
    });
  });
});

describe("index change notices", () => {
  it("notifies once after each write that changes the index", async () => {
    const changes = countChanges();
    await seedStoredProject("a");
    await saveProjectAudio("a", createAudioFile("alpha.wav"));
    await markProjectOpened("a", 5);
    await updateProjectRecord("a", (project) => project);
    await removeProjectData("a");
    expect(changes.read()).toBe(5);
    changes.stop();
  });

  describe("regressions", () => {
    it("regression: a write refused for a deleted project does not notify", async () => {
      await seedStoredProject("a");
      await removeProjectData("a");
      const changes = countChanges();
      await expect(updateProjectRecord("a", (project) => project)).rejects.toBeInstanceOf(ProjectDeletedError);
      expect(changes.read()).toBe(0);
      changes.stop();
    });

    it("regression: patching a project with no index entry does not notify", async () => {
      const changes = countChanges();
      await markProjectOpened("ghost", 1);
      await setProjectLastTab("ghost", "sync");
      expect(changes.read()).toBe(0);
      changes.stop();
    });
  });
});

describe("saveProjectRecordWithAudio", () => {
  it("writes the record, the audio and the index entry in one transaction", async () => {
    await saveProjectRecordWithAudio("c", storedProject(songTitled("Copy")), createAudioFile("copy.wav"));
    expect((await loadProjectRecord("c"))?.metadata.title).toBe("Copy");
    expect((await loadProjectAudio("c"))?.name).toBe("copy.wav");
    expect((await loadProjectIndexEntry("c"))?.storedAudioBytes).toBeGreaterThan(0);
  });

  describe("edge cases", () => {
    it("writes the record with no audio when there is none to copy", async () => {
      await saveProjectRecordWithAudio("c", storedProject(songTitled("Copy")), undefined);
      expect(await loadProjectAudio("c")).toBeUndefined();
      expect((await loadProjectIndexEntry("c"))?.storedAudioBytes).toBe(0);
    });
  });

  describe("error paths", () => {
    it("regression: a refused write leaves no orphan audio blob", async () => {
      await seedStoredProject("a", { project: songTitled("Alpha") });
      await removeProjectData("a");
      await expect(
        saveProjectRecordWithAudio("a", storedProject(songTitled("Alpha")), createAudioFile("orphan.wav")),
      ).rejects.toBeInstanceOf(ProjectDeletedError);
      expect(await loadProjectAudio("a")).toBeUndefined();
      expect(await loadProjectIndexEntry("a")).toBeUndefined();
    });
  });
});

describe("saveProjectRecord: last tab", () => {
  it("writes the tab on the first save of a project", async () => {
    await saveProjectRecord("a", storedProject(songTitled("Alpha")), "edit");
    expect((await loadProjectIndexEntry("a"))?.lastTab).toBe("edit");
  });

  it("replaces the remembered tab when a save carries one", async () => {
    await seedStoredProject("a");
    await setProjectLastTab("a", "sync");
    await saveProjectRecord("a", storedProject(), "timeline");
    expect((await loadProjectIndexEntry("a"))?.lastTab).toBe("timeline");
  });

  describe("invariants", () => {
    it("keeps the remembered tab when a save carries none", async () => {
      await seedStoredProject("a");
      await setProjectLastTab("a", "sync");
      await saveProjectRecord("a", storedProject());
      expect((await loadProjectIndexEntry("a"))?.lastTab).toBe("sync");
    });
  });
});
