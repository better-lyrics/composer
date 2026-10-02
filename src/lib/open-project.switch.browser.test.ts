import { forkOpenProject, openProject, restoreOpenProject } from "@/lib/open-project";
import {
  findOpenProjectId,
  isProjectInUse,
  openProjectIdSnapshot,
  subscribeOpenProjectId,
} from "@/lib/open-project-session";
import { debouncedSave } from "@/lib/persistence-debounce";
import { loadProjectIndexEntry, removeProjectData, setProjectLastTab } from "@/lib/project-repository";
import { buildSaveInput } from "@/lib/project-snapshot";
import { getOpenProjectId, loadProjectRecord } from "@/lib/project-storage";
import { getSaveStatus } from "@/lib/save-status";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { sleep } from "@/test/async";
import { createAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject, songTitled } from "@/test/projects";
import { beforeEach, describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

async function seedTwoProjects(): Promise<void> {
  await seedStoredProject("a", {
    open: true,
    audio: createAudioFile("a.wav"),
    project: { ...songTitled("Alpha"), audioSource: { kind: "file", name: "a.wav" } },
  });
  await seedStoredProject("b", {
    audio: createAudioFile("b.wav"),
    project: { ...songTitled("Bravo"), audioSource: { kind: "file", name: "b.wav" } },
  });
  await restoreOpenProject();
}

function scheduleSaveOfStores(): void {
  const args = buildSaveInput();
  if (!args) throw new Error("expected something to save");
  debouncedSave(args);
}

function openTitle(): string {
  return useProjectStore.getState().metadata.title;
}

// -- Tests --------------------------------------------------------------------

describe("openProject", () => {
  beforeEach(() => {
    useSettingsStore.setState({ autoSaveDelay: 60_000 });
  });

  it("loads the other project into the stores and makes it the open project", async () => {
    await seedTwoProjects();
    await openProject("b");
    expect(openProjectIdSnapshot()).toBe("b");
    expect(openTitle()).toBe("Bravo");
    const source = useAudioStore.getState().source;
    expect(source?.type === "file" ? source.file.name : null).toBe("b.wav");
    expect(await getOpenProjectId()).toBe("b");
    expect((await loadProjectIndexEntry("b"))?.openedAt).toBeGreaterThan(1_758_900_000_000);
  });

  it("restores the tab the project was last on", async () => {
    await seedTwoProjects();
    await setProjectLastTab("b", "sync");
    await openProject("b");
    expect(useProjectStore.getState().activeTab).toBe("sync");
  });

  it("an edit waiting to save lands in the project it was made in", async () => {
    await seedTwoProjects();
    useProjectStore.getState().setMetadata({ title: "Alpha (edited)" });
    scheduleSaveOfStores();
    await openProject("b");
    await expect.poll(async () => (await loadProjectRecord("a"))?.metadata.title).toBe("Alpha (edited)");
    expect((await loadProjectRecord("b"))?.metadata.title).toBe("Bravo");
  });

  it("switching back shows the saved edit", async () => {
    await seedTwoProjects();
    useProjectStore.getState().setMetadata({ title: "Alpha (edited)" });
    scheduleSaveOfStores();
    await openProject("b");
    await expect.poll(async () => (await loadProjectRecord("a"))?.metadata.title).toBe("Alpha (edited)");
    await openProject("a");
    expect(openTitle()).toBe("Alpha (edited)");
  });

  describe("edge cases", () => {
    it("opening the project that is already open changes nothing", async () => {
      await seedTwoProjects();
      useProjectStore.getState().setMetadata({ title: "Unsaved change" });
      await openProject("a");
      expect(openTitle()).toBe("Unsaved change");
    });

    it("regression: a project deleted while the switch lands is closed instead of left open", async () => {
      await seedTwoProjects();
      const unsubscribe = subscribeOpenProjectId(() => {
        if (openProjectIdSnapshot() === "b") void removeProjectData("b");
      });
      await openProject("b");
      unsubscribe();
      expect(openProjectIdSnapshot()).toBeUndefined();
      expect(openTitle()).toBe("");
      expect(await getOpenProjectId()).not.toBe("b");
    });

    it("an unknown id rejects and keeps the open project", async () => {
      await seedTwoProjects();
      await expect(openProject("missing")).rejects.toThrow();
      expect(openProjectIdSnapshot()).toBe("a");
      expect(openTitle()).toBe("Alpha");
    });
  });

  describe("invariants", () => {
    it("the last of two quick switches wins", async () => {
      await seedTwoProjects();
      await seedStoredProject("c", { project: songTitled("Charlie") });
      const first = openProject("b");
      await openProject("c");
      await first;
      expect(openProjectIdSnapshot()).toBe("c");
      expect(openTitle()).toBe("Charlie");
    });

    it("regression: a switch requested while another is loading wins", async () => {
      await seedTwoProjects();
      await seedStoredProject("c", { project: songTitled("Charlie") });
      const first = openProject("b");
      await sleep(0);
      await Promise.all([first, openProject("c")]);
      expect(openProjectIdSnapshot()).toBe("c");
      expect(openTitle()).toBe("Charlie");
    });

    it("the stores hold no history from the previous project", async () => {
      await seedTwoProjects();
      useProjectStore.getState().setLinesWithHistory(useProjectStore.getState().lines);
      expect(useProjectStore.getState().history.length).toBeGreaterThan(0);
      await openProject("b");
      expect(useProjectStore.getState().history).toEqual([]);
      expect(useProjectStore.getState().isDirty).toBe(false);
    });

    it("A, B, A: the most recently requested target wins, even back to the project already open", async () => {
      await seedTwoProjects();
      useProjectStore.getState().setMetadata({ title: "Unsaved change" });
      const switchingToB = openProject("b");
      await openProject("a");
      await switchingToB;
      expect(openProjectIdSnapshot()).toBe("a");
      expect(openTitle()).toBe("Unsaved change");
    });
  });

  describe("supersession", () => {
    it("regression: opening the project a boot restore is loading keeps the restored content", async () => {
      await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
      const boot = restoreOpenProject();
      await findOpenProjectId();
      await openProject("a");
      await boot;
      expect(openTitle()).toBe("Alpha");
    });

    it("a superseded open of a missing id resolves quietly instead of rejecting", async () => {
      await seedTwoProjects();
      const superseded = openProject("missing");
      await openProject("b");
      await expect(superseded).resolves.toBeUndefined();
      expect(openProjectIdSnapshot()).toBe("b");
    });

    it("a failed open does not cancel an in-flight legitimate switch", async () => {
      await seedTwoProjects();
      const switchingToB = openProject("b");
      await expect(openProject("missing")).rejects.toThrow();
      await switchingToB;
      expect(openProjectIdSnapshot()).toBe("b");
      expect(openTitle()).toBe("Bravo");
    });
  });

  describe("isProjectInUse", () => {
    it("is false before opening starts", async () => {
      await seedTwoProjects();
      expect(isProjectInUse("b")).toBe(false);
    });

    it("is true while a project loads and stays true once it is open", async () => {
      await seedTwoProjects();
      const opening = openProject("b");
      expect(isProjectInUse("b")).toBe(true);
      await opening;
      expect(isProjectInUse("b")).toBe(true);
    });

    it("is false again after a failed open", async () => {
      await expect(openProject("missing")).rejects.toThrow();
      expect(isProjectInUse("missing")).toBe(false);
    });

    it("is false again once a superseded open settles", async () => {
      await seedTwoProjects();
      await seedStoredProject("c", { project: songTitled("Charlie") });
      const first = openProject("b");
      await openProject("c");
      await first;
      expect(isProjectInUse("b")).toBe(false);
      expect(isProjectInUse("c")).toBe(true);
    });
  });

  describe("forkOpenProject", () => {
    it("saves to the id it created even if another switch happens while it is still saving", async () => {
      await seedTwoProjects();
      useProjectStore.getState().setMetadata({ title: "Kept edit" });
      const forking = forkOpenProject();
      await openProject("b");
      const keptId = await forking;
      expect(keptId).not.toBe("b");
      expect((await loadProjectRecord(keptId))?.metadata.title).toBe("Kept edit");
      expect((await loadProjectRecord("b"))?.metadata.title).toBe("Bravo");
    });

    it("moves the save status while it writes the kept copy", async () => {
      await seedTwoProjects();
      useProjectStore.getState().setMetadata({ title: "Kept edit" });
      const forking = forkOpenProject();
      expect(getSaveStatus()).toBe("saving");
      await forking;
      expect(getSaveStatus()).toBe("saved");
    });
  });
});
