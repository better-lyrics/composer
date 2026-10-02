import { deleteAllProjects } from "@/lib/delete-all-projects";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { schedulePendingDeletion } from "@/lib/pending-deletions";
import { buildProjectBundle } from "@/lib/project-bundle";
import { type BundleRestore, importProjectFile, showBundleRestoreToast } from "@/lib/project-import";
import { listProjectIndex, removeProjectData, saveProjectRecord } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { ProjectDeletedError, isProjectDeleted } from "@/lib/project-tombstones";
import { allowConsole } from "@/test/console-guard";
import { seedStoredProject, songTitled, storedProject } from "@/test/projects";
import { render } from "@/test/render";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function backupOf(...projects: [id: string, title: string, savedAt?: number][]): File {
  const bundle = buildProjectBundle(
    projects.map(([id, title, savedAt = 1_758_000_000_000]) => ({
      id,
      project: storedProject({ ...songTitled(title), savedAt }),
    })),
    1_759_000_000_000,
  );
  return new File([JSON.stringify(bundle)], "composer-backup-2026-09-27.ttml-projects.json");
}

function backupWithUnreadable(...projects: [id: string, title: string][]): File {
  const bundle = buildProjectBundle(
    projects.map(([id, title]) => ({ id, project: storedProject(songTitled(title)) })),
    1_759_000_000_000,
  );
  const broken = { ...bundle, projects: [...bundle.projects, { nope: true }] };
  return new File([JSON.stringify(broken)], "composer-backup-2026-09-27.ttml-projects.json");
}

async function titles(): Promise<string[]> {
  return (await listProjectIndex()).map((entry) => entry.title).toSorted();
}

function restoreResult(overrides: Partial<BundleRestore> = {}): BundleRestore {
  return { restored: 0, alreadyInLibrary: 0, unreadable: 0, failed: 0, ...overrides };
}

// -- Tests --------------------------------------------------------------------

describe("importProjectFile · backups", () => {
  it("restores every project with its id and its saved time, and opens none", async () => {
    const screen = await render(<Toaster />);
    expect(await importProjectFile(backupOf(["a", "Alpha", 1_758_000_000_001], ["b", "Bravo"]))).toBeNull();
    expect(await titles()).toEqual(["Alpha", "Bravo"]);
    expect((await loadProjectRecord("a"))?.savedAt).toBe(1_758_000_000_001);
    expect(openProjectIdSnapshot()).toBeUndefined();
    await expect.element(screen.getByText("Restored 2 projects")).toBeInTheDocument();
  });

  it("skips projects already in the library and says so", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha here") });
    const screen = await render(<Toaster />);
    await importProjectFile(backupOf(["a", "Alpha old"], ["b", "Bravo"]));
    expect(await titles()).toEqual(["Alpha here", "Bravo"]);
    await expect.element(screen.getByText("Restored 1 project")).toBeInTheDocument();
    await expect.element(screen.getByText("1 project already in your library.")).toBeInTheDocument();
  });

  it("says when every project is already there", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha") });
    const screen = await render(<Toaster />);
    await importProjectFile(backupOf(["a", "Alpha"]));
    await expect
      .element(screen.getByText("Every project in this backup is already in your library"))
      .toBeInTheDocument();
  });

  it("mentions unreadable projects alongside a successful restore", async () => {
    allowConsole(/skipped a project the backup could not read/);
    const screen = await render(<Toaster />);
    await importProjectFile(backupWithUnreadable(["a", "Alpha"]));
    await expect.element(screen.getByText("Restored 1 project")).toBeInTheDocument();
    await expect.element(screen.getByText("1 project couldn't be read.")).toBeInTheDocument();
  });

  describe("regressions", () => {
    it("regression: a project deleted on this device comes back under its own id", async () => {
      await seedStoredProject("gone", { project: songTitled("Gone") });
      await removeProjectData("gone");
      await render(<Toaster />);
      await importProjectFile(backupOf(["gone", "Gone"]));
      expect((await listProjectIndex()).map((entry) => entry.id)).toEqual(["gone"]);
    });

    it("regression: restoring after Delete all keeps the original ids", async () => {
      await seedStoredProject("a", { project: songTitled("Alpha") });
      await seedStoredProject("b", { project: songTitled("Bravo") });
      await deleteAllProjects();
      await render(<Toaster />);
      await importProjectFile(backupOf(["a", "Alpha"], ["b", "Bravo"]));
      expect((await listProjectIndex()).map((entry) => entry.id).toSorted()).toEqual(["a", "b"]);
    });

    it("regression: importing the same backup twice after Delete all adds nothing the second time", async () => {
      await seedStoredProject("a", { project: songTitled("Alpha") });
      await seedStoredProject("b", { project: songTitled("Bravo") });
      await deleteAllProjects();
      const screen = await render(<Toaster />);
      await importProjectFile(backupOf(["a", "Alpha"], ["b", "Bravo"]));
      await importProjectFile(backupOf(["a", "Alpha"], ["b", "Bravo"]));
      expect(await titles()).toEqual(["Alpha", "Bravo"]);
      await expect
        .element(screen.getByText("Every project in this backup is already in your library"))
        .toBeInTheDocument();
    });

    it("regression: a project restored after Delete all takes normal saves", async () => {
      await seedStoredProject("a", { project: songTitled("Alpha") });
      await deleteAllProjects();
      await render(<Toaster />);
      await importProjectFile(backupOf(["a", "Alpha"]));
      await saveProjectRecord("a", storedProject(songTitled("Alpha edited")));
      expect(await titles()).toEqual(["Alpha edited"]);
    });

    it("regression: deleted projects that are not in the backup stay deleted", async () => {
      await seedStoredProject("a", { project: songTitled("Alpha") });
      await seedStoredProject("left-out", { project: songTitled("Left out") });
      await deleteAllProjects();
      await render(<Toaster />);
      await importProjectFile(backupOf(["a", "Alpha"]));
      expect(await isProjectDeleted("left-out")).toBe(true);
      await expect(saveProjectRecord("left-out", storedProject())).rejects.toBeInstanceOf(ProjectDeletedError);
    });

    it("regression: a project waiting to be deleted is restored as a copy that survives the delete", async () => {
      await seedStoredProject("pending", { project: songTitled("Pending") });
      const deletion = schedulePendingDeletion(["pending"]);
      await render(<Toaster />);
      await importProjectFile(backupOf(["pending", "Pending"]));
      await deletion.commit();
      const entries = await listProjectIndex();
      expect(entries.map((entry) => entry.title)).toEqual(["Pending"]);
      expect(entries[0]?.id).not.toBe("pending");
    });

    it("regression: a mix of duplicates and unreadable entries never claims every project is already in your library", async () => {
      allowConsole(/skipped a project the backup could not read/);
      await seedStoredProject("a", { project: songTitled("Alpha") });
      const screen = await render(<Toaster />);
      await importProjectFile(backupWithUnreadable(["a", "Alpha"]));
      expect(screen.getByText("Every project in this backup is already in your library").query()).toBeNull();
      await expect.element(screen.getByText("Couldn't restore that backup")).toBeInTheDocument();
      await expect
        .element(screen.getByText("1 project already in your library. 1 project couldn't be read."))
        .toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("says when nothing in the backup could be read", async () => {
      const screen = await render(<Toaster />);
      const empty = new File([JSON.stringify(buildProjectBundle([], 1))], "empty.ttml-projects.json");
      await importProjectFile(empty);
      await expect.element(screen.getByText("Couldn't read any project in that backup")).toBeInTheDocument();
    });
  });
});

describe("showBundleRestoreToast · copy", () => {
  it("names a failed count alongside a successful restore", async () => {
    const screen = await render(<Toaster />);
    showBundleRestoreToast(restoreResult({ restored: 2, failed: 1 }));
    await expect.element(screen.getByText("Restored 2 projects")).toBeInTheDocument();
    await expect.element(screen.getByText("1 project couldn't be saved.")).toBeInTheDocument();
  });

  it("is honest when every project failed to save", async () => {
    const screen = await render(<Toaster />);
    showBundleRestoreToast(restoreResult({ failed: 3 }));
    await expect.element(screen.getByText("Couldn't restore that backup")).toBeInTheDocument();
    await expect.element(screen.getByText("3 projects couldn't be saved.")).toBeInTheDocument();
  });

  describe("edge cases", () => {
    it("mentions every non-zero count when nothing new was restored", async () => {
      const screen = await render(<Toaster />);
      showBundleRestoreToast(restoreResult({ alreadyInLibrary: 1, unreadable: 1, failed: 1 }));
      await expect.element(screen.getByText("Couldn't restore that backup")).toBeInTheDocument();
      await expect
        .element(
          screen.getByText(
            "1 project already in your library. 1 project couldn't be read. 1 project couldn't be saved.",
          ),
        )
        .toBeInTheDocument();
    });
  });
});
