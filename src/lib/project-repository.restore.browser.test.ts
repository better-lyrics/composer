import { subscribeProjectIndexChanges } from "@/lib/project-index-changes";
import {
  listProjectIndex,
  loadProjectIndexEntry,
  removeProjectData,
  restoreDeletedProjectRecord,
  saveProjectRecord,
} from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { ProjectDeletedError, isProjectDeleted } from "@/lib/project-tombstones";
import { songTitled, storedProject } from "@/test/projects";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("restoreDeletedProjectRecord", () => {
  it("brings a deleted project back under its own id with its index entry", async () => {
    await saveProjectRecord("gone", storedProject(songTitled("Before")));
    await removeProjectData("gone");
    await restoreDeletedProjectRecord("gone", storedProject({ ...songTitled("Gone"), savedAt: 1_758_000_000_001 }));
    expect((await loadProjectRecord("gone"))?.savedAt).toBe(1_758_000_000_001);
    expect((await loadProjectIndexEntry("gone"))?.title).toBe("Gone");
    expect(await isProjectDeleted("gone")).toBe(false);
  });

  it("leaves the restored project writable by normal saves", async () => {
    await saveProjectRecord("gone", storedProject());
    await removeProjectData("gone");
    await restoreDeletedProjectRecord("gone", storedProject(songTitled("Gone")));
    await saveProjectRecord("gone", storedProject(songTitled("Edited")));
    expect((await loadProjectIndexEntry("gone"))?.title).toBe("Edited");
  });

  it("notifies index listeners", async () => {
    await saveProjectRecord("gone", storedProject());
    await removeProjectData("gone");
    const listener = vi.fn();
    const stop = subscribeProjectIndexChanges(listener);
    await restoreDeletedProjectRecord("gone", storedProject());
    stop();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("asks the browser to protect storage when it brings back the first project", async () => {
    await saveProjectRecord("gone", storedProject());
    await removeProjectData("gone");
    const persist = vi.spyOn(navigator.storage, "persist");
    await restoreDeletedProjectRecord("gone", storedProject());
    await expect.poll(() => persist.mock.calls.length).toBe(1);
  });

  describe("invariants", () => {
    it("keeps every other deleted id unwritable", async () => {
      await saveProjectRecord("gone", storedProject());
      await saveProjectRecord("other", storedProject());
      await removeProjectData("gone");
      await removeProjectData("other");
      await restoreDeletedProjectRecord("gone", storedProject());
      expect(await isProjectDeleted("other")).toBe(true);
      await expect(saveProjectRecord("other", storedProject())).rejects.toBeInstanceOf(ProjectDeletedError);
      expect((await listProjectIndex()).map((entry) => entry.id)).toEqual(["gone"]);
    });
  });

  describe("edge cases", () => {
    it("does not ask for protection when the library already has a project", async () => {
      await saveProjectRecord("live", storedProject());
      await saveProjectRecord("gone", storedProject());
      await removeProjectData("gone");
      const persist = vi.spyOn(navigator.storage, "persist");
      await restoreDeletedProjectRecord("gone", storedProject());
      expect(persist).not.toHaveBeenCalled();
    });
  });
});
