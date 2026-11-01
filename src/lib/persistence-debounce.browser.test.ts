import { restoreOpenProject } from "@/lib/open-project";
import { adoptOpenProjectId, openProjectIdSnapshot } from "@/lib/open-project-session";
import { saveAudioFile, saveCurrentProject } from "@/lib/persistence";
import {
  cancelPendingSave,
  debouncedSave,
  flushPendingSave,
  flushPendingSaveQuietly,
  saveOpenProjectNow,
} from "@/lib/persistence-debounce";
import { DB_NAME, DB_VERSION, PROJECT_RECORD_STORE_NAME, getAllFromStore } from "@/lib/persistence-idb";
import { loadProjectAudio } from "@/lib/project-audio";
import { listProjectIndex, removeProjectData } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { clearRecoveryStorage } from "@/lib/recovery";
import { getSaveStatus, subscribeSaveStatus, trackSave } from "@/lib/save-status";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { allowConsole } from "@/test/console-guard";
import { deleteDatabase, openAndCloseAtVersion } from "@/test/idb";
import { saveInputTitled, seedStoredProject, songTitled } from "@/test/projects";
import { beforeEach, describe, expect, it } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("persistence-debounce · save target", () => {
  beforeEach(() => {
    useSettingsStore.setState({ autoSaveDelay: 60_000 });
  });

  it("a debounced save lands in the project it was scheduled for after another is adopted", async () => {
    adoptOpenProjectId("project-a");
    debouncedSave(saveInputTitled("Alpha"));
    adoptOpenProjectId("project-b");
    await flushPendingSave();
    expect((await loadProjectRecord("project-a"))?.metadata.title).toBe("Alpha");
    expect(await loadProjectRecord("project-b")).toBeUndefined();
  });

  it("the timer writes into the project it was scheduled for", async () => {
    useSettingsStore.setState({ autoSaveDelay: 10 });
    adoptOpenProjectId("project-a");
    debouncedSave(saveInputTitled("Alpha"));
    adoptOpenProjectId("project-b");
    await expect.poll(async () => (await loadProjectRecord("project-a"))?.metadata.title).toBe("Alpha");
    expect(await loadProjectRecord("project-b")).toBeUndefined();
  });

  it("an audio save started before a switch lands in the project it started in", async () => {
    adoptOpenProjectId("project-a");
    const pending = saveAudioFile(new File([new Uint8Array(24)], "a.mp3", { type: "audio/mpeg" }));
    adoptOpenProjectId("project-b");
    await pending;
    expect((await loadProjectAudio("project-a"))?.size).toBe(24);
    expect(await loadProjectAudio("project-b")).toBeUndefined();
  });

  it("the latest schedule wins and writes once", async () => {
    adoptOpenProjectId("project-a");
    debouncedSave(saveInputTitled("First"));
    debouncedSave(saveInputTitled("Second"));
    await flushPendingSave();
    expect((await loadProjectRecord("project-a"))?.metadata.title).toBe("Second");
  });

  describe("edge cases", () => {
    it("flushing with nothing pending resolves and writes nothing", async () => {
      await flushPendingSave();
      expect(await listProjectIndex()).toEqual([]);
    });

    it("cancelPendingSave drops the pending save", async () => {
      adoptOpenProjectId("project-a");
      debouncedSave(saveInputTitled("Dropped"));
      cancelPendingSave();
      await flushPendingSave();
      expect(await loadProjectRecord("project-a")).toBeUndefined();
    });

    it("a first debounced save on a fresh install creates the open project", async () => {
      debouncedSave(saveInputTitled("Fresh"));
      await flushPendingSave();
      const id = openProjectIdSnapshot();
      expect(id).toBeDefined();
      expect((await loadProjectRecord(id ?? ""))?.metadata.title).toBe("Fresh");
    });
  });

  describe("regressions", () => {
    it("regression: the unload flush after a recovery clear writes no orphan record", async () => {
      await saveCurrentProject(saveInputTitled("Before clear"));
      debouncedSave(saveInputTitled("After clear"));
      await clearRecoveryStorage();
      await flushPendingSave();
      expect(await listProjectIndex()).toEqual([]);
      expect(await getAllFromStore(PROJECT_RECORD_STORE_NAME)).toEqual([]);
    });

    it("regression: the first save after a recovery clear starts a fresh project", async () => {
      await saveCurrentProject(saveInputTitled("Before clear"));
      const cleared = openProjectIdSnapshot();
      await clearRecoveryStorage();
      await saveCurrentProject(saveInputTitled("After clear"));
      const fresh = openProjectIdSnapshot();
      expect(fresh).toBeDefined();
      expect(fresh).not.toBe(cleared);
      expect((await listProjectIndex()).map((entry) => entry.title)).toEqual(["After clear"]);
    });

    it("regression: a save bound during creation never lands in a project adopted before the flush", async () => {
      debouncedSave(saveInputTitled("Fresh session"));
      adoptOpenProjectId("x");
      await flushPendingSave();
      expect(await loadProjectRecord("x")).toBeUndefined();
      const [entry] = await listProjectIndex();
      expect(entry?.title).toBe("Fresh session");
      expect(entry?.id).not.toBe("x");
    });
  });

  describe("save status", () => {
    it("reads saving while a save waits and saved once it is written", async () => {
      adoptOpenProjectId("project-a");
      debouncedSave(saveInputTitled("Alpha"));
      expect(getSaveStatus()).toBe("saving");
      await flushPendingSave();
      expect(getSaveStatus()).toBe("saved");
    });

    it("reads saved again after the pending save is cancelled", () => {
      adoptOpenProjectId("project-a");
      debouncedSave(saveInputTitled("Alpha"));
      cancelPendingSave();
      expect(getSaveStatus()).toBe("saved");
    });

    it("never notifies saved while flushing a pending save", async () => {
      adoptOpenProjectId("project-a");
      debouncedSave(saveInputTitled("Alpha"));
      const statuses: string[] = [];
      const unsubscribe = subscribeSaveStatus(() => statuses.push(getSaveStatus()));
      const flushed = flushPendingSave();
      expect(statuses).not.toContain("saved");
      await flushed;
      unsubscribe();
      expect(getSaveStatus()).toBe("saved");
    });

    describe("regressions", () => {
      it("regression: a rejected debounced write is reported as failed", async () => {
        await openAndCloseAtVersion(DB_NAME, DB_VERSION + 1);
        adoptOpenProjectId("project-a");
        debouncedSave(saveInputTitled("Alpha"));
        await expect(flushPendingSave()).rejects.toThrow();
        expect(getSaveStatus()).toBe("failed");
        await deleteDatabase(DB_NAME);
      });

      it("regression: edits to an open project deleted elsewhere are reported as not saved", async () => {
        adoptOpenProjectId("d");
        await removeProjectData("d");
        debouncedSave(saveInputTitled("Lost edit"));
        await expect(flushPendingSave()).rejects.toThrow();
        expect(getSaveStatus()).toBe("failed");
        expect(await loadProjectRecord("d")).toBeUndefined();
      });

      it("regression: a refused save for a project that is no longer open stays quiet", async () => {
        adoptOpenProjectId("abandoned");
        debouncedSave(saveInputTitled("Abandoned"));
        await removeProjectData("abandoned");
        adoptOpenProjectId("kept");
        await flushPendingSave();
        expect(getSaveStatus()).toBe("saved");
        expect(await loadProjectRecord("abandoned")).toBeUndefined();
      });

      it("regression: a failed status from a previous test never leaks into the next one", () => {
        expect(getSaveStatus()).toBe("saved");
      });
    });
  });

  describe("saveOpenProjectNow", () => {
    it("writes the open project's current state at once", async () => {
      useSettingsStore.setState({ autoSaveDelay: 60_000 });
      await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
      await restoreOpenProject();
      useProjectStore.getState().setMetadata({ title: "Alpha now" });
      await saveOpenProjectNow();
      expect((await loadProjectRecord("a"))?.metadata.title).toBe("Alpha now");
    });

    describe("error paths", () => {
      it("rejects when the write fails", async () => {
        allowConsole(/Auto-save failed|Flush save failed/);
        await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
        await restoreOpenProject();
        await removeProjectData("a");
        await expect(saveOpenProjectNow()).rejects.toThrow();
      });
    });
  });

  describe("in-flight writes", () => {
    it("flush waits for a write that was already in flight before it started", async () => {
      adoptOpenProjectId("project-a");
      let resolveOther: () => void = () => undefined;
      const other = new Promise<void>((resolve) => {
        resolveOther = resolve;
      });
      trackSave("audio", other);
      debouncedSave(saveInputTitled("Alpha"));
      let flushed = false;
      const flushing = flushPendingSave().then(() => {
        flushed = true;
      });
      await expect.poll(async () => (await loadProjectRecord("project-a"))?.metadata.title).toBe("Alpha");
      expect(flushed).toBe(false);
      resolveOther();
      await flushing;
      expect(flushed).toBe(true);
    });
  });

  describe("flushPendingSaveQuietly", () => {
    it("writes a pending save without returning a promise the caller must handle", async () => {
      adoptOpenProjectId("project-a");
      debouncedSave(saveInputTitled("Alpha"));
      flushPendingSaveQuietly();
      await expect.poll(async () => (await loadProjectRecord("project-a"))?.metadata.title).toBe("Alpha");
    });

    describe("error paths", () => {
      it("logs and swallows a failed write instead of throwing", async () => {
        allowConsole(/Flush save failed/);
        await openAndCloseAtVersion(DB_NAME, DB_VERSION + 1);
        adoptOpenProjectId("project-a");
        debouncedSave(saveInputTitled("Alpha"));
        expect(() => flushPendingSaveQuietly()).not.toThrow();
        await expect.poll(() => getSaveStatus()).toBe("failed");
        await deleteDatabase(DB_NAME);
      });
    });
  });
});
