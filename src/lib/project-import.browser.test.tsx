import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { restoreOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { schedulePendingDeletion } from "@/lib/pending-deletions";
import { debouncedSave, flushPendingSave } from "@/lib/persistence-debounce";
import { type ProjectFile, projectFileFrom } from "@/lib/project-file";
import { importProjectFile, replaceProjectFromFile } from "@/lib/project-import";
import { listProjectIndex, removeProjectData } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { ProjectDeletedError } from "@/lib/project-tombstones";
import { getSaveStatus } from "@/lib/save-status";
import { SAVED_PROJECT_VERSION } from "@/lib/saved-project";
import { useImportConflictStore } from "@/stores/import-conflict-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { allowConsole } from "@/test/console-guard";
import { createLine } from "@/test/factories";
import { saveInputTitled, seedStoredProject, songTitled, storedProject } from "@/test/projects";
import { render } from "@/test/render";
import { ImportConflictModalHost } from "@/ui/projects/import-conflict-modal";
import { Toaster } from "sonner";
import { describe, expect, it, vi } from "vitest";

// -- Helpers ------------------------------------------------------------------

function fileFor(projectId: string | undefined, title: string): File {
  const project = storedProject({ ...songTitled(title), lines: [createLine({ text: `${title} line` })] });
  return new File([JSON.stringify(projectFileFrom(projectId, project))], `${title}.ttml-project.json`);
}

function fileWithLine(text: string): ProjectFile {
  return {
    version: SAVED_PROJECT_VERSION,
    savedAt: Date.now(),
    metadata: { title: "File", artists: [], album: "", duration: 0 },
    agents: DEFAULT_AGENTS,
    lines: [createLine({ text })],
    granularity: "word",
  };
}

const TTML_DOCUMENT =
  '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:title>Cynic</ttm:title></metadata></head><body><div><p begin="0:01.458" end="0:03.324">Now</p></div></body></tt>';

function captureLoggedErrors(pattern: RegExp): { text: () => string; stop: () => void } {
  allowConsole(pattern);
  const spy = vi.spyOn(console, "error");
  return {
    text: () =>
      spy.mock.calls
        .flat()
        .map((arg) => (arg instanceof Error ? `${arg.name}: ${arg.message}` : String(arg)))
        .join(" "),
    stop: () => spy.mockRestore(),
  };
}

class UnreadableFile extends File {
  override text(): Promise<string> {
    return Promise.reject(new DOMException("The file was moved after it was picked", "NotReadableError"));
  }
}

function newerProjectWithExportEdit(): File {
  const project = {
    ...storedProject(songTitled("From the future")),
    version: SAVED_PROJECT_VERSION + 1,
    ttmlEditState: { source: TTML_DOCUMENT, content: TTML_DOCUMENT },
  };
  return new File([JSON.stringify(project)], "Future.ttml-project.json");
}

// -- Tests --------------------------------------------------------------------

describe("importProjectFile", () => {
  it("imports a file with no match as a new project and opens it", async () => {
    await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
    await restoreOpenProject();
    const id = await importProjectFile(fileFor(undefined, "Bravo"));
    expect(id).not.toBeNull();
    expect(id).not.toBe("a");
    expect(openProjectIdSnapshot()).toBe(id);
    expect(useProjectStore.getState().metadata.title).toBe("Bravo");
    expect((await loadProjectRecord(id as string))?.hasUnexportedImport).toBe(true);
    expect((await loadProjectRecord("a"))?.metadata.title).toBe("Alpha");
  });

  describe("regressions", () => {
    it("regression: a file whose project was deleted imports as a new project, never under the deleted id", async () => {
      await seedStoredProject("gone", { project: songTitled("Gone") });
      await removeProjectData("gone");
      const id = await importProjectFile(fileFor("gone", "Gone"));
      expect(id).not.toBe("gone");
      expect(await loadProjectRecord("gone")).toBeUndefined();
    });

    it("regression: a project pending deletion is not offered as a conflict", async () => {
      await seedStoredProject("a", { project: songTitled("Alpha") });
      const deletion = schedulePendingDeletion(["a"]);
      const id = await importProjectFile(fileFor("a", "Alpha"));
      expect(id).not.toBe("a");
      deletion.undo();
    });

    it("regression: falls back to importing as a new project when the replace target is deleted while the conflict dialog is open", async () => {
      allowConsole(/no longer exists/);
      await seedStoredProject("a", { project: songTitled("Alpha") });
      const pending = importProjectFile(fileFor("a", "Alpha"));
      await expect.poll(() => useImportConflictStore.getState().conflict).not.toBeNull();
      await removeProjectData("a");
      useImportConflictStore.getState().answer("replace");
      const id = await pending;
      expect(id).not.toBeNull();
      expect(id).not.toBe("a");
      expect(await loadProjectRecord("a")).toBeUndefined();
      expect((await loadProjectRecord(id as string))?.metadata.title).toBe("Alpha");
    });

    it("regression: a second import while a conflict prompt is open shows a toast and does not proceed", async () => {
      allowConsole(/a conflict prompt is already open/);
      await seedStoredProject("a", { project: songTitled("Alpha") });
      const screen = await render(<Toaster />);
      const first = importProjectFile(fileFor("a", "Alpha"));
      await expect.poll(() => useImportConflictStore.getState().conflict).not.toBeNull();
      const second = importProjectFile(fileFor("a", "Alpha"));
      expect(await second).toBeNull();
      await expect.element(screen.getByText("Finish the current import first")).toBeInTheDocument();
      useImportConflictStore.getState().answer("cancel");
      await first;
    });
  });

  describe("TTML under a project file name", () => {
    it("opens a valid TTML document named .json as a new project", async () => {
      await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
      await restoreOpenProject();
      const id = await importProjectFile(new File([TTML_DOCUMENT], "Cynic.json"));
      expect(id).not.toBeNull();
      expect(id).not.toBe("a");
      expect(openProjectIdSnapshot()).toBe(id);
      expect(useProjectStore.getState().lines.map((line) => line.text)).toEqual(["Now"]);
    });

    it("starts the opened TTML project with nothing to undo", async () => {
      const id = await importProjectFile(new File([TTML_DOCUMENT], "Cynic.json"));
      expect(id).not.toBeNull();
      expect(useProjectStore.getState().canUndo()).toBe(false);
      expect(useProjectStore.getState().lines.map((line) => line.text)).toEqual(["Now"]);
    });

    it("regression: a newer project file whose export edit holds TTML shows the project file error, not TTML", async () => {
      const logged = captureLoggedErrors(/could not read the project file/);
      const screen = await render(<Toaster />);
      const id = await importProjectFile(newerProjectWithExportEdit());
      expect(id).toBeNull();
      await expect.element(screen.getByText("Couldn't read that project file")).toBeInTheDocument();
      expect(screen.getByText(/as a new project from its TTML/).elements()).toHaveLength(0);
      expect(logged.text()).toMatch(/Unsupported project version/);
      logged.stop();
      expect(await listProjectIndex()).toEqual([]);
    });
  });

  describe("error paths", () => {
    it("says so and imports nothing when the file cannot be read", async () => {
      allowConsole(/could not read the project file/);
      const screen = await render(<Toaster />);
      const id = await importProjectFile(new File(["not json"], "broken.ttml-project.json"));
      expect(id).toBeNull();
      await expect.element(screen.getByText("Couldn't read that project file")).toBeInTheDocument();
      expect(await listProjectIndex()).toEqual([]);
    });

    it("says so, logs the cause and resolves when the file itself cannot be read", async () => {
      const logged = captureLoggedErrors(/could not read the project file/);
      const screen = await render(<Toaster />);
      await expect(importProjectFile(new UnreadableFile(["{}"], "moved.ttml-project.json"))).resolves.toBeNull();
      await expect.element(screen.getByText("Couldn't read that project file")).toBeInTheDocument();
      expect(logged.text()).toMatch(/NotReadableError/);
      logged.stop();
      expect(await listProjectIndex()).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("renders no conflict dialog when nothing matches", async () => {
      await render(<ImportConflictModalHost />);
      await importProjectFile(fileFor(undefined, "Solo"));
      expect(document.querySelector("dialog")).toBeNull();
    });
  });
});

describe("replaceProjectFromFile", () => {
  it("flushes the open project's pending save before replacing, leaving no later overwrite", async () => {
    await seedStoredProject("a", {
      open: true,
      project: { ...songTitled("Alpha"), lines: [createLine({ text: "Library line", begin: 1, end: 2 })] },
    });
    await restoreOpenProject();
    useSettingsStore.setState({ autoSaveDelay: 60_000 });
    debouncedSave(saveInputTitled("StaleEdit"));

    await replaceProjectFromFile("a", fileWithLine("File line"));

    expect((await loadProjectRecord("a"))?.lines[0]?.text).toBe("File line");
    await flushPendingSave();
    expect((await loadProjectRecord("a"))?.lines[0]?.text).toBe("File line");
  });

  describe("regressions", () => {
    it("regression: a failed flush stops the replace write and marks the save as failed instead of silently dropping the edit", async () => {
      await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
      await restoreOpenProject();
      useSettingsStore.setState({ autoSaveDelay: 60_000 });
      debouncedSave(saveInputTitled("StaleEdit"));
      await removeProjectData("a");

      await expect(replaceProjectFromFile("a", fileWithLine("File line"))).rejects.toBeInstanceOf(ProjectDeletedError);
      expect(getSaveStatus()).toBe("failed");
      expect(await loadProjectRecord("a")).toBeUndefined();
    });
  });
});
