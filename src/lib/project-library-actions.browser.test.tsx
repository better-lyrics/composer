import { usePersistence } from "@/hooks/usePersistence";
import { restoreOpenProject } from "@/lib/open-project";
import { hiddenProjectIdsSnapshot } from "@/lib/pending-deletions";
import { debouncedSave, flushPendingSave } from "@/lib/persistence-debounce";
import { DB_NAME, DB_VERSION } from "@/lib/persistence-idb";
import { loadProjectAudio } from "@/lib/project-audio";
import {
  deleteProjectsWithUndo,
  duplicateProject,
  exportProjectFiles,
  renameProject,
} from "@/lib/project-library-actions";
import { loadProjectIndexEntry, removeProjectData } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { ProjectDeletedError } from "@/lib/project-tombstones";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { deleteDatabase, openAndCloseAtVersion } from "@/test/idb";
import { saveInputTitled, seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

// -- Helpers ------------------------------------------------------------------

function watchDownloads(): { names: () => string[]; stop: () => void } {
  const names: string[] = [];
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) if (node instanceof HTMLAnchorElement) names.push(node.download);
    }
  });
  observer.observe(document.body, { childList: true });
  return { names: () => names, stop: () => observer.disconnect() };
}

async function bytesOf(file: File | undefined): Promise<Uint8Array> {
  return file ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array();
}

// -- Tests --------------------------------------------------------------------

describe("renameProject", () => {
  it("renames a closed project in its record and index, as an edit", async () => {
    await seedStoredProject("a", { project: { ...songTitled("Alpha"), savedAt: 10 } });
    await renameProject("a", "  Renamed  ");
    expect((await loadProjectRecord("a"))?.metadata.title).toBe("Renamed");
    const entry = await loadProjectIndexEntry("a");
    expect(entry?.title).toBe("Renamed");
    expect(entry?.updatedAt).toBeGreaterThan(10);
  });

  it("renames the open project through the store and saves it", async () => {
    await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
    await renderHook(() => usePersistence());
    await restoreOpenProject();
    await renameProject("a", "Renamed");
    expect(useProjectStore.getState().metadata.title).toBe("Renamed");
    await expect.poll(async () => (await loadProjectIndexEntry("a"))?.title).toBe("Renamed");
  });

  describe("regressions", () => {
    it("regression: renames the open project even when nothing is listening for the edit", async () => {
      await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
      await restoreOpenProject();
      await renameProject("a", "Renamed");
      expect((await loadProjectRecord("a"))?.metadata.title).toBe("Renamed");
    });
  });

  describe("error paths", () => {
    it("rejects a project deleted in the meantime", async () => {
      await seedStoredProject("a");
      await removeProjectData("a");
      await expect(renameProject("a", "Late")).rejects.toBeInstanceOf(ProjectDeletedError);
    });

    it("regression: reports a failed save instead of succeeding silently", async () => {
      await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
      await restoreOpenProject();
      await openAndCloseAtVersion(DB_NAME, DB_VERSION + 1);
      await expect(renameProject("a", "Renamed")).rejects.toThrow();
      await deleteDatabase(DB_NAME);
    });
  });
});

describe("duplicateProject", () => {
  it("copies the record and the audio under a new id with a copy title", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha"), audio: createAudioFile("alpha.wav") });
    const copyId = await duplicateProject("a");
    expect(copyId).not.toBe("a");
    expect((await loadProjectRecord(copyId))?.metadata.title).toBe("Alpha copy");
    const [originalAudio, copyAudio] = await Promise.all([loadProjectAudio("a"), loadProjectAudio(copyId)]);
    expect(copyAudio?.name).toBe("alpha.wav");
    expect(await bytesOf(copyAudio)).toEqual(await bytesOf(originalAudio));
    const [original, copy] = await Promise.all([loadProjectIndexEntry("a"), loadProjectIndexEntry(copyId)]);
    expect(copy?.storedAudioBytes).toBe(original?.storedAudioBytes);
    expect((await loadProjectRecord("a"))?.metadata.title).toBe("Alpha");
  });

  describe("edge cases", () => {
    it("names the copy of an untitled project after the fallback", async () => {
      await seedStoredProject("a", { project: songTitled("") });
      expect((await loadProjectRecord(await duplicateProject("a")))?.metadata.title).toBe("Untitled copy");
    });
  });

  describe("regressions", () => {
    it("regression: duplicating the open project includes the edit that was still waiting to save", async () => {
      useSettingsStore.setState({ autoSaveDelay: 60_000 });
      await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
      await restoreOpenProject();
      debouncedSave(saveInputTitled("Edited"));
      const copyId = await duplicateProject("a");
      expect((await loadProjectRecord(copyId))?.metadata.title).toBe("Edited copy");
      await flushPendingSave();
    });
  });

  describe("error paths", () => {
    it("rejects a project that is not stored", async () => {
      await expect(duplicateProject("missing")).rejects.toThrow(/not stored/);
    });

    it("regression: reports a failed save instead of copying a stale record", async () => {
      await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
      await restoreOpenProject();
      await openAndCloseAtVersion(DB_NAME, DB_VERSION + 1);
      await expect(duplicateProject("a")).rejects.toThrow();
      await deleteDatabase(DB_NAME);
    });
  });
});

describe("exportProjectFiles", () => {
  it("downloads one file per project", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha") });
    await seedStoredProject("b", { project: songTitled("Bravo") });
    const downloads = watchDownloads();
    await exportProjectFiles(["a", "b"]);
    await expect.poll(() => downloads.names().length).toBe(2);
    downloads.stop();
    expect(downloads.names()[0]).toMatch(/^Alpha-/);
    expect(downloads.names()[1]).toMatch(/^Bravo-/);
  });

  describe("regressions", () => {
    it("regression: exporting the open project includes the edit that was still waiting to save", async () => {
      useSettingsStore.setState({ autoSaveDelay: 60_000 });
      await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
      await restoreOpenProject();
      debouncedSave(saveInputTitled("Edited"));
      const downloads = watchDownloads();
      await exportProjectFiles(["a"]);
      await expect.poll(() => downloads.names().length).toBe(1);
      downloads.stop();
      expect(downloads.names()[0]).toMatch(/^Edited-/);
      await flushPendingSave();
    });
  });

  describe("error paths", () => {
    it("downloads every loadable file, then throws the first failure", async () => {
      await seedStoredProject("a", { project: songTitled("Alpha") });
      const downloads = watchDownloads();
      await expect(exportProjectFiles(["a", "missing"])).rejects.toThrow(/not stored/);
      await expect.poll(() => downloads.names().length).toBe(1);
      downloads.stop();
      expect(downloads.names()[0]).toMatch(/^Alpha-/);
    });

    it("still downloads the files after a failure that comes first", async () => {
      await seedStoredProject("b", { project: songTitled("Bravo") });
      const downloads = watchDownloads();
      await expect(exportProjectFiles(["missing", "b"])).rejects.toThrow(/not stored/);
      await expect.poll(() => downloads.names().length).toBe(1);
      downloads.stop();
      expect(downloads.names()[0]).toMatch(/^Bravo-/);
    });

    it("regression: reports a failed save instead of exporting a stale record", async () => {
      await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
      await restoreOpenProject();
      await openAndCloseAtVersion(DB_NAME, DB_VERSION + 1);
      await expect(exportProjectFiles(["a"])).rejects.toThrow();
      await deleteDatabase(DB_NAME);
    });
  });
});

describe("deleteProjectsWithUndo", () => {
  it("hides the projects and shows the undo toast", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha") });
    const screen = await render(<Toaster />);
    deleteProjectsWithUndo([{ id: "a", title: "Alpha" }]);
    expect(hiddenProjectIdsSnapshot().has("a")).toBe(true);
    await expect.element(screen.getByText("Deleted “Alpha”")).toBeInTheDocument();
  });

  describe("edge cases", () => {
    it("does nothing for an empty list", async () => {
      await seedStoredProject("a", { project: songTitled("Alpha") });
      const screen = await render(<Toaster />);
      deleteProjectsWithUndo([]);
      deleteProjectsWithUndo([{ id: "a", title: "Alpha" }]);
      await expect.element(screen.getByText("Deleted “Alpha”")).toBeInTheDocument();
      expect(hiddenProjectIdsSnapshot()).toEqual(new Set(["a"]));
      expect(screen.getByText("Deleted 0 projects").query()).toBeNull();
    });
  });
});
