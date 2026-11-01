import { listStemJobs, putStem } from "@/audio/separation/stem-store";
import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import {
  APP_STATE_STORE_NAME,
  PROJECT_INDEX_STORE_NAME,
  PROJECT_RECORD_STORE_NAME,
  PROJECT_STORE_NAME,
  getFromStore,
  setInStore,
} from "@/lib/persistence-idb";
import { removeProjectData, saveProjectRecord } from "@/lib/project-repository";
import {
  LEGACY_PROJECT_KEY,
  OPEN_PROJECT_KEY,
  clearAllProjects,
  getOpenProjectId,
  listProjectRecords,
  loadProjectRecord,
  onProjectsCleared,
} from "@/lib/project-storage";
import { ProjectDeletedError, isProjectDeleted } from "@/lib/project-tombstones";
import type { SavedProject } from "@/lib/saved-project";
import { allowConsole } from "@/test/console-guard";
import { seedStoredProject, songTitled } from "@/test/projects";
import { describe, expect, it } from "vitest";

function project(): SavedProject {
  return {
    version: 1,
    savedAt: 1,
    metadata: { title: "Test", artists: [], album: "", duration: 0 },
    agents: DEFAULT_AGENTS,
    lines: [],
    granularity: "word",
  };
}

describe("project-storage", () => {
  it("getOpenProjectId reads whatever id sits under the app-state key", async () => {
    expect(await getOpenProjectId()).toBeUndefined();
    await setInStore(APP_STATE_STORE_NAME, OPEN_PROJECT_KEY, "p1");
    expect(await getOpenProjectId()).toBe("p1");
  });

  it("loadProjectRecord reads a record written directly to the record store", async () => {
    await setInStore(PROJECT_RECORD_STORE_NAME, "p1", project());
    expect((await loadProjectRecord("p1"))?.metadata.title).toBe("Test");
  });

  it("clearAllProjects empties every project store, the legacy keys included", async () => {
    await setInStore(PROJECT_RECORD_STORE_NAME, "p1", project());
    await setInStore(PROJECT_INDEX_STORE_NAME, "p1", { id: "p1" });
    await setInStore(APP_STATE_STORE_NAME, OPEN_PROJECT_KEY, "p1");
    await setInStore(PROJECT_STORE_NAME, LEGACY_PROJECT_KEY, project());

    await clearAllProjects();

    expect(await loadProjectRecord("p1")).toBeUndefined();
    expect(await getFromStore(PROJECT_INDEX_STORE_NAME, "p1")).toBeUndefined();
    expect(await getOpenProjectId()).toBeUndefined();
    expect(await getFromStore(PROJECT_STORE_NAME, LEGACY_PROJECT_KEY)).toBeUndefined();
  });

  it("clearing all projects also clears the vocal stems", async () => {
    await putStem("h1", "vocals", "fp32", new Blob([new Uint8Array(4)]));
    await clearAllProjects();
    expect(await listStemJobs()).toEqual([]);
  });

  describe("tombstones", () => {
    it("clearAllProjects tombstones every project it removes and the pointer's project", async () => {
      await saveProjectRecord("p1", project());
      await saveProjectRecord("p2", project());
      await setInStore(APP_STATE_STORE_NAME, OPEN_PROJECT_KEY, "p3");
      await clearAllProjects();
      expect(await isProjectDeleted("p1")).toBe(true);
      expect(await isProjectDeleted("p2")).toBe(true);
      expect(await isProjectDeleted("p3")).toBe(true);
    });

    it("a save to a cleared project writes nothing, and a new project saves normally", async () => {
      await saveProjectRecord("p1", project());
      await clearAllProjects();
      await expect(saveProjectRecord("p1", project())).rejects.toBeInstanceOf(ProjectDeletedError);
      await saveProjectRecord("fresh", project());
      expect(await loadProjectRecord("p1")).toBeUndefined();
      expect((await loadProjectRecord("fresh"))?.metadata.title).toBe("Test");
    });

    it("clearAllProjects keeps the tombstones of projects removed earlier", async () => {
      await saveProjectRecord("old", project());
      await removeProjectData("old");
      await clearAllProjects();
      expect(await isProjectDeleted("old")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("getOpenProjectId ignores a pointer left on a removed project", async () => {
      await removeProjectData("p1");
      await setInStore(APP_STATE_STORE_NAME, OPEN_PROJECT_KEY, "p1");
      expect(await getOpenProjectId()).toBeUndefined();
    });

    it("loadProjectRecord returns undefined for a missing id", async () => {
      expect(await loadProjectRecord("missing")).toBeUndefined();
    });

    it("clearAllProjects on an empty database resolves without throwing", async () => {
      await expect(clearAllProjects()).resolves.toBeUndefined();
    });
  });

  describe("listProjectRecords", () => {
    it("reads every stored record with its id", async () => {
      await seedStoredProject("a", { project: songTitled("Alpha") });
      await seedStoredProject("b", { project: songTitled("Bravo") });
      const records = await listProjectRecords();
      expect(records.map((record) => [record.id, record.project.metadata.title]).toSorted()).toEqual([
        ["a", "Alpha"],
        ["b", "Bravo"],
      ]);
    });

    describe("edge cases", () => {
      it("excludes a project once its data has been removed, starting from an empty store", async () => {
        expect(await listProjectRecords()).toEqual([]);
        await seedStoredProject("a");
        await removeProjectData("a");
        expect(await listProjectRecords()).toEqual([]);
      });
    });
  });

  describe("onProjectsCleared", () => {
    it("returns an unsubscribe function that stops further notifications", async () => {
      let calls = 0;
      const unsubscribe = onProjectsCleared(() => calls++);
      unsubscribe();
      await clearAllProjects();
      expect(calls).toBe(0);
    });
  });

  describe("regressions", () => {
    it("regression: clearAllProjects still resolves and notifies other listeners when one throws", async () => {
      allowConsole(/onProjectsCleared listener failed/);
      let calls = 0;
      const unsubscribeThrow = onProjectsCleared(() => {
        throw new Error("boom");
      });
      const unsubscribeCount = onProjectsCleared(() => calls++);
      await expect(clearAllProjects()).resolves.toBeUndefined();
      expect(calls).toBe(1);
      unsubscribeThrow();
      unsubscribeCount();
    });
  });
});
