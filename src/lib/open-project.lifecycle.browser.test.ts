import { createProject, deleteProject, openProject, restoreOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { saveCurrentProject } from "@/lib/persistence";
import { debouncedSave, flushPendingSave } from "@/lib/persistence-debounce";
import { listProjectIndex } from "@/lib/project-repository";
import { getOpenProjectId, loadProjectRecord } from "@/lib/project-storage";
import { ProjectDeletedError } from "@/lib/project-tombstones";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { saveInputTitled, seedStoredProject, songTitled } from "@/test/projects";
import { beforeEach, describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

async function seedOpenProject(): Promise<void> {
  await seedStoredProject("a", {
    open: true,
    audio: createAudioFile("a.wav"),
    project: { ...songTitled("Alpha"), audioSource: { kind: "file", name: "a.wav" } },
  });
  await restoreOpenProject();
}

// -- createProject ------------------------------------------------------------

describe("createProject", () => {
  beforeEach(() => {
    useSettingsStore.setState({ autoSaveDelay: 60_000 });
  });

  it("opens a blank project and keeps the previous one", async () => {
    await seedOpenProject();
    const id = createProject();
    expect(id).not.toBe("a");
    expect(openProjectIdSnapshot()).toBe(id);
    expect(useProjectStore.getState().lines).toEqual([]);
    expect(useProjectStore.getState().metadata.title).toBe("");
    expect(useAudioStore.getState().source).toBeNull();
    expect((await loadProjectRecord("a"))?.metadata.title).toBe("Alpha");
    await expect.poll(getOpenProjectId).toBe(id);
  });

  it("a blank project stays out of the index until something is saved", async () => {
    await seedOpenProject();
    const id = createProject();
    await expect.poll(getOpenProjectId).toBe(id);
    expect((await listProjectIndex()).map((entry) => entry.id)).toEqual(["a"]);
    await saveCurrentProject(saveInputTitled("Fresh"));
    expect((await listProjectIndex()).map((entry) => entry.id).toSorted()).toEqual(["a", id].toSorted());
  });

  it("flushes the previous project's pending save into it", async () => {
    await seedOpenProject();
    debouncedSave(saveInputTitled("Alpha (edited)"));
    createProject();
    await expect.poll(async () => (await loadProjectRecord("a"))?.metadata.title).toBe("Alpha (edited)");
  });

  it("a project switch that was still loading does not replace the new project", async () => {
    await seedOpenProject();
    await seedStoredProject("b", { project: songTitled("Bravo") });
    const switching = openProject("b");
    const id = createProject();
    await switching;
    expect(openProjectIdSnapshot()).toBe(id);
    expect(useProjectStore.getState().metadata.title).toBe("");
  });
});

// -- deleteProject ------------------------------------------------------------

describe("deleteProject", () => {
  beforeEach(() => {
    useSettingsStore.setState({ autoSaveDelay: 60_000 });
  });

  it("deleting the open project clears the stores and removes it", async () => {
    await seedOpenProject();
    await deleteProject("a");
    expect(openProjectIdSnapshot()).toBeUndefined();
    expect(useProjectStore.getState().lines).toEqual([]);
    expect(useAudioStore.getState().source).toBeNull();
    expect(await loadProjectRecord("a")).toBeUndefined();
    expect(await getOpenProjectId()).toBeUndefined();
  });

  it("the next save after deleting the open project starts a new project", async () => {
    await seedOpenProject();
    await deleteProject("a");
    await saveCurrentProject(saveInputTitled("Fresh"));
    const index = await listProjectIndex();
    expect(index.map((entry) => entry.title)).toEqual(["Fresh"]);
    expect(index[0].id).not.toBe("a");
  });

  it("deleting another project keeps the open one untouched", async () => {
    await seedOpenProject();
    await seedStoredProject("b", { project: songTitled("Bravo") });
    await deleteProject("b");
    expect(openProjectIdSnapshot()).toBe("a");
    expect(useProjectStore.getState().metadata.title).toBe("Alpha");
    expect((await listProjectIndex()).map((entry) => entry.id)).toEqual(["a"]);
  });

  describe("regressions", () => {
    it("regression: a pending save of the deleted open project never resurrects it", async () => {
      await seedOpenProject();
      debouncedSave(saveInputTitled("Alpha (edited)"));
      await deleteProject("a");
      await flushPendingSave();
      expect(await loadProjectRecord("a")).toBeUndefined();
      expect(await listProjectIndex()).toEqual([]);
    });

    it("regression: an immediate save already in flight when the project is deleted writes nothing", async () => {
      await seedOpenProject();
      const inFlight = saveCurrentProject(saveInputTitled("Alpha (late)"));
      await deleteProject("a");
      await expect(inFlight).rejects.toBeInstanceOf(ProjectDeletedError);
      expect(await loadProjectRecord("a")).toBeUndefined();
    });

    it("regression: opening a project deleted mid-flight never adopts it", async () => {
      await seedOpenProject();
      await seedStoredProject("b", { project: songTitled("Bravo") });
      const opening = openProject("b").catch(() => undefined);
      await deleteProject("b");
      await opening;
      expect(openProjectIdSnapshot()).not.toBe("b");
      useProjectStore.getState().setMetadata({ title: "Still writable" });
      debouncedSave(saveInputTitled("Still writable"));
      await flushPendingSave();
      const currentId = openProjectIdSnapshot();
      expect(currentId).toBeDefined();
      expect((await loadProjectRecord(currentId as string))?.metadata.title).toBe("Still writable");
    });
  });
});
