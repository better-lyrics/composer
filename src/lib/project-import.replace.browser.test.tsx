import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { restoreOpenProject } from "@/lib/open-project";
import { debouncedSave, flushPendingSave } from "@/lib/persistence-debounce";
import type { ProjectFile } from "@/lib/project-file";
import { replaceProjectFromFile } from "@/lib/project-import";
import { removeProjectData } from "@/lib/project-repository";
import { loadProjectForRestore } from "@/lib/project-restore";
import { loadProjectRecord } from "@/lib/project-storage";
import { ProjectDeletedError } from "@/lib/project-tombstones";
import { getSaveStatus } from "@/lib/save-status";
import { SAVED_PROJECT_VERSION, type SavedProject, savedLines } from "@/lib/saved-project";
import { useSettingsStore } from "@/stores/settings";
import { createMp3File } from "@/test/audio-fixtures";
import { createLine } from "@/test/factories";
import { saveInputTitled, seedStoredProject, songTitled } from "@/test/projects";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function fileWithLine(text: string): ProjectFile {
  return {
    version: SAVED_PROJECT_VERSION,
    savedAt: Date.now(),
    metadata: { title: "File", artists: [], album: "", duration: 0 },
    agents: DEFAULT_AGENTS,
    lines: savedLines([createLine({ text })]),
    granularity: "word",
  };
}

// -- Tests --------------------------------------------------------------------

describe("replaceProjectFromFile", () => {
  it("flushes the open project's pending save before replacing, leaving no later overwrite", async () => {
    await seedStoredProject("a", {
      open: true,
      project: { ...songTitled("Alpha"), lines: savedLines([createLine({ text: "Library line", begin: 1, end: 2 })]) },
    });
    await restoreOpenProject();
    useSettingsStore.setState({ autoSaveDelay: 60_000 });
    debouncedSave(saveInputTitled("StaleEdit"));

    await replaceProjectFromFile("a", fileWithLine("File line"));

    expect((await loadProjectRecord("a"))?.lines[0]?.text).toBe("File line");
    await flushPendingSave();
    expect((await loadProjectRecord("a"))?.lines[0]?.text).toBe("File line");
  });

  describe("MP3 priming flags", () => {
    const P = 1104 / 44_100;

    async function replaceTimedLine(local: Partial<SavedProject>, file: Partial<ProjectFile>): Promise<number> {
      await seedStoredProject("a", {
        audio: createMp3File(),
        project: { audioSource: { kind: "file", name: "silence.mp3" }, ...local },
      });
      await replaceProjectFromFile("a", {
        ...fileWithLine("File line"),
        ...file,
        lines: savedLines([createLine({ text: "File line", begin: 1, end: 2 })]),
      });
      const reloaded = (await loadProjectForRestore("a")).project;
      return reloaded?.lines[0]?.begin ?? Number.NaN;
    }

    it("regression: an older export into a corrected project still moves to the corrected decode", async () => {
      const begin = await replaceTimedLine(
        { primingStripped: true, primingCorrected: true },
        { primingStripped: true, primingCorrected: undefined },
      );
      expect(begin).toBeCloseTo(1 + P, 9);
    });

    it("regression: a corrected export into an old project is not moved again", async () => {
      const begin = await replaceTimedLine(
        { primingStripped: true, primingCorrected: false },
        { primingStripped: true, primingCorrected: true },
      );
      expect(begin).toBeCloseTo(1, 9);
    });
  });

  describe("regressions", () => {
    it("regression: a file saved before the unison submit keeps the project's unison link", async () => {
      await seedStoredProject("a", { project: { ...songTitled("Alpha"), unisonLyricId: "4821" } });
      await replaceProjectFromFile("a", fileWithLine("File line"));
      expect((await loadProjectRecord("a"))?.unisonLyricId).toBe("4821");
    });

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
