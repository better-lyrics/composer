import { schedulePendingDeletion } from "@/lib/pending-deletions";
import type { ProjectFile } from "@/lib/project-file";
import { restoreProjectBundle } from "@/lib/project-import";
import { listProjectIndex, removeProjectData } from "@/lib/project-repository";
import { type StorageSignal, subscribeStorageSignals } from "@/lib/storage-signals";
import { allowConsole } from "@/test/console-guard";
import { seedStoredProject, songTitled, storedProject } from "@/test/projects";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function projectFileNamed(id: string, title: string): ProjectFile {
  return { ...storedProject(songTitled(title)), projectId: id };
}

function poisonedProjectFile(id: string, title: string): ProjectFile {
  const project = storedProject(songTitled(title));
  const poisonedLine = new Proxy(project.lines[0] ?? { id: "l", text: "", begin: 0, end: 0 }, {});
  return { ...project, projectId: id, lines: [poisonedLine, ...project.lines.slice(1)] };
}

async function titles(): Promise<string[]> {
  return (await listProjectIndex()).map((entry) => entry.title).toSorted();
}

// -- Tests --------------------------------------------------------------------

describe("restoreProjectBundle · per-project failures", () => {
  it("keeps earlier restores and counts a mid-bundle failure without aborting the rest", async () => {
    allowConsole(/could not restore a project from the backup/);
    const signals: StorageSignal[] = [];
    const unsubscribe = subscribeStorageSignals((signal) => signals.push(signal));
    const result = await restoreProjectBundle(
      [projectFileNamed("a", "Alpha"), poisonedProjectFile("b", "Bravo"), projectFileNamed("c", "Charlie")],
      0,
    );
    unsubscribe();
    expect(result).toEqual({ restored: 2, alreadyInLibrary: 0, unreadable: 0, failed: 1 });
    expect(await titles()).toEqual(["Alpha", "Charlie"]);
    expect(signals).toEqual([]);
  });

  describe("regressions", () => {
    it("regression: a duplicate pending-delete id is restored once, not as two copies", async () => {
      await seedStoredProject("pending", { project: songTitled("Pending") });
      const deletion = schedulePendingDeletion(["pending"]);
      const result = await restoreProjectBundle(
        [projectFileNamed("pending", "Pending A"), projectFileNamed("pending", "Pending B")],
        0,
      );
      await deletion.commit();
      expect(result).toEqual({ restored: 1, alreadyInLibrary: 1, unreadable: 0, failed: 0 });
      const entries = await listProjectIndex();
      expect(entries.map((entry) => entry.title)).toEqual(["Pending A"]);
      expect(entries[0]?.id).not.toBe("pending");
    });

    it("regression: a duplicate tombstoned id is restored once, not counted as a second real copy", async () => {
      await seedStoredProject("gone", { project: songTitled("Gone") });
      await removeProjectData("gone");
      const result = await restoreProjectBundle(
        [projectFileNamed("gone", "Gone A"), projectFileNamed("gone", "Gone B")],
        0,
      );
      expect(result).toEqual({ restored: 1, alreadyInLibrary: 1, unreadable: 0, failed: 0 });
      const entries = await listProjectIndex();
      expect(entries.map((entry) => entry.title)).toEqual(["Gone A"]);
      expect(entries[0]?.id).toBe("gone");
    });
  });
});
