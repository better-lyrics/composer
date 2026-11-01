import { listStemJobs, putStem } from "@/audio/separation/stem-store";
import { deleteAllProjects } from "@/lib/delete-all-projects";
import { restoreOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { hiddenProjectIdsSnapshot, schedulePendingDeletion } from "@/lib/pending-deletions";
import { debouncedSave, flushPendingSave } from "@/lib/persistence-debounce";
import { listProjectIndex } from "@/lib/project-repository";
import { currentSaveInput } from "@/lib/project-snapshot";
import { isProjectDeleted } from "@/lib/project-tombstones";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine } from "@/test/factories";
import { seedStoredProject, songTitled } from "@/test/projects";
import { describe, expect, it } from "vitest";

describe("deleteAllProjects", () => {
  it("removes every project, all audio and all stems, and closes the open project", async () => {
    await seedStoredProject("a", { open: true, project: songTitled("Alpha"), audio: createAudioFile("a.wav") });
    await seedStoredProject("b", { project: songTitled("Bravo") });
    await putStem("h1", "vocals", "fp32", new Blob([new Uint8Array(4)]));
    await restoreOpenProject();
    await deleteAllProjects();
    expect(await listProjectIndex()).toEqual([]);
    expect(await listStemJobs()).toEqual([]);
    expect(openProjectIdSnapshot()).toBeUndefined();
    expect(useProjectStore.getState().metadata.title).toBe("");
    expect(useProjectStore.getState().lines).toEqual([]);
  });

  describe("regressions", () => {
    it("regression: an edit after deleting everything starts a new project instead of writing under a deleted id", async () => {
      await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
      await restoreOpenProject();
      await deleteAllProjects();
      useProjectStore.getState().setLines([createLine({ text: "Fresh start" })]);
      debouncedSave(currentSaveInput());
      await flushPendingSave();
      const entries = await listProjectIndex();
      expect(entries).toHaveLength(1);
      expect(entries[0]?.id).not.toBe("a");
      expect(await isProjectDeleted("a")).toBe(true);
    });

    it("regression: a new project's first save that is still in flight does not come back after the clear", async () => {
      useProjectStore.getState().setLines([createLine({ text: "Brand new" })]);
      debouncedSave(currentSaveInput());
      const firstSave = flushPendingSave();
      await deleteAllProjects();
      await firstSave;
      expect(await listProjectIndex()).toEqual([]);
    });

    it("regression: an edit saved while the clear runs does not bring a project back", async () => {
      useSettingsStore.setState({ autoSaveDelay: 60_000 });
      const deleting = deleteAllProjects();
      useProjectStore.getState().setLines([createLine({ text: "Typed during the clear" })]);
      debouncedSave(currentSaveInput());
      await deleting;
      await flushPendingSave();
      expect(await listProjectIndex()).toEqual([]);
    });

    it("regression: commits a deletion still waiting for its Undo first, so a late Undo changes nothing", async () => {
      await seedStoredProject("a", { project: songTitled("Alpha") });
      const deletion = schedulePendingDeletion(["a"]);
      await deleteAllProjects();
      deletion.undo();
      expect(hiddenProjectIdsSnapshot().has("a")).toBe(true);
      expect(await listProjectIndex()).toEqual([]);
      expect(await isProjectDeleted("a")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("works on an empty device", async () => {
      await deleteAllProjects();
      expect(await listProjectIndex()).toEqual([]);
    });
  });
});
