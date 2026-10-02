import { restoreOpenProject } from "@/lib/open-project";
import { adoptOpenProjectId } from "@/lib/open-project-session";
import { debouncedSave, flushPendingSave, saveNow } from "@/lib/persistence-debounce";
import { removeProjectData } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { ProjectDeletedError } from "@/lib/project-tombstones";
import { getSaveStatus } from "@/lib/save-status";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { allowConsole } from "@/test/console-guard";
import { saveInputTitled, seedStoredProject, songTitled } from "@/test/projects";
import { beforeEach, describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

async function openAlpha(): Promise<void> {
  await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
  await restoreOpenProject();
}

// -- Tests --------------------------------------------------------------------

describe("saveNow", () => {
  beforeEach(() => {
    useSettingsStore.setState({ autoSaveDelay: 60_000 });
  });

  it("writes a pending save at once instead of waiting for the delay", async () => {
    await openAlpha();
    debouncedSave(saveInputTitled("Pending edit"));
    expect(getSaveStatus()).toBe("saving");
    await saveNow();
    expect((await loadProjectRecord("a"))?.metadata.title).toBe("Pending edit");
    expect(getSaveStatus()).toBe("saved");
  });

  it("saves the open project's current state when nothing is pending", async () => {
    await openAlpha();
    useProjectStore.getState().setMetadata({ title: "Typed just now" });
    await saveNow();
    expect((await loadProjectRecord("a"))?.metadata.title).toBe("Typed just now");
    expect(getSaveStatus()).toBe("saved");
  });

  describe("invariants", () => {
    it("writes a pending save into the project it was scheduled for, not the one open now", async () => {
      adoptOpenProjectId("project-a");
      debouncedSave(saveInputTitled("Alpha"));
      adoptOpenProjectId("project-b");
      await saveNow();
      expect((await loadProjectRecord("project-a"))?.metadata.title).toBe("Alpha");
      expect(await loadProjectRecord("project-b")).toBeUndefined();
    });

    it("leaves nothing pending, so the delayed timer never writes again", async () => {
      await openAlpha();
      debouncedSave(saveInputTitled("Pending edit"));
      await saveNow();
      const saved = await loadProjectRecord("a");
      await flushPendingSave();
      expect(getSaveStatus()).toBe("saved");
      expect(await loadProjectRecord("a")).toEqual(saved);
      expect(saved?.metadata.title).toBe("Pending edit");
    });
  });

  describe("error paths", () => {
    it("rejects and marks the save failed when a pending save targets a deleted project", async () => {
      allowConsole(/Auto-save failed|Flush save failed/);
      await openAlpha();
      debouncedSave(saveInputTitled("Too late"));
      await removeProjectData("a");
      await expect(saveNow()).rejects.toBeInstanceOf(ProjectDeletedError);
      expect(getSaveStatus()).toBe("failed");
      expect(await loadProjectRecord("a")).toBeUndefined();
    });

    it("rejects and marks the save failed when the open project was deleted and nothing is pending", async () => {
      allowConsole(/Auto-save failed|Flush save failed/);
      await openAlpha();
      await removeProjectData("a");
      await expect(saveNow()).rejects.toBeInstanceOf(ProjectDeletedError);
      expect(getSaveStatus()).toBe("failed");
      expect(await loadProjectRecord("a")).toBeUndefined();
    });
  });
});
