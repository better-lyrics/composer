import { openProject, restoreOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import {
  commitAllPendingDeletions,
  hiddenProjectIdsSnapshot,
  schedulePendingDeletion,
  subscribeHiddenProjectIds,
} from "@/lib/pending-deletions";
import { DB_NAME, DB_VERSION } from "@/lib/persistence-idb";
import { saveProjectRecord } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { sleep } from "@/test/async";
import { allowConsole } from "@/test/console-guard";
import { deleteDatabase, openAndCloseAtVersion } from "@/test/idb";
import { seedStoredProject, storedProject } from "@/test/projects";
import { describe, expect, it } from "vitest";

describe("schedulePendingDeletion", () => {
  it("hides the projects at once and deletes nothing yet", async () => {
    await seedStoredProject("a");
    const deletion = schedulePendingDeletion(["a"]);
    expect(hiddenProjectIdsSnapshot().has("a")).toBe(true);
    expect(await loadProjectRecord("a")).toBeDefined();
    deletion.undo();
  });

  it("undo shows the projects again and leaves them writable", async () => {
    await seedStoredProject("a");
    const deletion = schedulePendingDeletion(["a"]);
    deletion.undo();
    expect(hiddenProjectIdsSnapshot().has("a")).toBe(false);
    await expect(saveProjectRecord("a", storedProject())).resolves.toBeUndefined();
  });

  it("commit deletes the projects and keeps them hidden", async () => {
    await seedStoredProject("a");
    await seedStoredProject("b");
    const deletion = schedulePendingDeletion(["a", "b"]);
    await deletion.commit();
    expect(await loadProjectRecord("a")).toBeUndefined();
    expect(await loadProjectRecord("b")).toBeUndefined();
    expect(hiddenProjectIdsSnapshot().has("a")).toBe(true);
  });

  it("commit closes the open project when it is one of them", async () => {
    await seedStoredProject("a", { open: true });
    await restoreOpenProject();
    expect(openProjectIdSnapshot()).toBe("a");
    await schedulePendingDeletion(["a"]).commit();
    expect(openProjectIdSnapshot()).toBeUndefined();
  });

  it("notifies listeners when the hidden set changes", async () => {
    let notices = 0;
    const stop = subscribeHiddenProjectIds(() => {
      notices += 1;
    });
    const deletion = schedulePendingDeletion(["a"]);
    deletion.undo();
    stop();
    expect(notices).toBe(2);
  });

  it("commitAllPendingDeletions commits every open batch", async () => {
    await seedStoredProject("a");
    await seedStoredProject("b");
    schedulePendingDeletion(["a"]);
    schedulePendingDeletion(["b"]);
    await commitAllPendingDeletions();
    expect(await loadProjectRecord("a")).toBeUndefined();
    expect(await loadProjectRecord("b")).toBeUndefined();
  });

  describe("invariants", () => {
    it("settles a batch once: commit after undo and undo after commit do nothing", async () => {
      await seedStoredProject("a");
      await seedStoredProject("b");
      const undone = schedulePendingDeletion(["a"]);
      undone.undo();
      await undone.commit();
      expect(await loadProjectRecord("a")).toBeDefined();
      const committed = schedulePendingDeletion(["b"]);
      await committed.commit();
      committed.undo();
      expect(hiddenProjectIdsSnapshot().has("b")).toBe(true);
    });

    it("drops duplicate ids", () => {
      expect(schedulePendingDeletion(["a", "a", "b"]).ids).toEqual(["a", "b"]);
    });
  });

  describe("regressions", () => {
    it("regression: opening a pending project takes it out of the batch so the commit keeps it", async () => {
      await seedStoredProject("a");
      await seedStoredProject("b", { open: true });
      await restoreOpenProject();
      const deletion = schedulePendingDeletion(["a"]);
      await openProject("a");
      expect(hiddenProjectIdsSnapshot().has("a")).toBe(false);
      await deletion.commit();
      expect(await loadProjectRecord("a")).toBeDefined();
    });
  });

  describe("error paths", () => {
    it("a failed commit rejects and shows the projects again", async () => {
      allowConsole(/could not delete a project/);
      allowConsole(/blocked/);
      await seedStoredProject("a");
      const deletion = schedulePendingDeletion(["a"]);
      await openAndCloseAtVersion(DB_NAME, DB_VERSION + 1);
      await expect(deletion.commit()).rejects.toThrow(/could not be deleted/);
      expect(hiddenProjectIdsSnapshot().has("a")).toBe(false);
      await deleteDatabase(DB_NAME);
    });
  });
});

describe("pagehide", () => {
  it("commits every pending batch when the page is being unloaded", async () => {
    await seedStoredProject("a");
    schedulePendingDeletion(["a"]);
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
    await expect.poll(() => loadProjectRecord("a")).toBeUndefined();
  });

  describe("edge cases", () => {
    it("does not commit while the page is entering the back/forward cache, so a restored tab can still undo", async () => {
      await seedStoredProject("a");
      const deletion = schedulePendingDeletion(["a"]);
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      await sleep(0);
      expect(await loadProjectRecord("a")).toBeDefined();
      deletion.undo();
      expect(hiddenProjectIdsSnapshot().has("a")).toBe(false);
      expect(await loadProjectRecord("a")).toBeDefined();
    });
  });
});
