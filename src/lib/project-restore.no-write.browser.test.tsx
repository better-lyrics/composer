import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "@/App";
import type { ProjectTab } from "@/domain/project/tab";
import { openProject } from "@/lib/open-project";
import { flushPendingSave } from "@/lib/persistence-debounce";
import { loadProjectIndexEntry, setProjectLastTab } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { getSaveStatus } from "@/lib/save-status";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile, createMp3File } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { createLine } from "@/test/factories";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { TOUR_SEEN_KEY } from "@/tour/use-tour";

// -- Constants ----------------------------------------------------------------

const SAVED_AT = 1_758_900_000_000;

// -- Helpers ------------------------------------------------------------------

async function seedAudioProject(id: string, audio: File, options: { open?: boolean; lastTab?: ProjectTab } = {}) {
  await seedStoredProject(id, {
    project: { ...songTitled(id), savedAt: SAVED_AT, lines: [createLine({ text: `${id} line` })] },
    audio,
    open: options.open,
  });
  if (options.lastTab) await setProjectLastTab(id, options.lastTab);
}

async function waitForAudioOf(title: string): Promise<void> {
  await expect.poll(() => useProjectStore.getState().metadata.title).toBe(title);
  await expect.poll(() => useAudioStore.getState().duration).toBeGreaterThan(0);
}

async function expectUntouched(id: string): Promise<void> {
  expect(useProjectStore.getState().isDirty).toBe(false);
  expect(getSaveStatus()).toBe("saved");
  await flushPendingSave();
  expect((await loadProjectRecord(id))?.savedAt).toBe(SAVED_AT);
  expect((await loadProjectIndexEntry(id))?.updatedAt).toBe(SAVED_AT);
}

async function bootApp(): Promise<void> {
  localStorage.setItem(TOUR_SEEN_KEY, "true");
  await render(<App />, { withRouter: { initialEntries: ["/editor"] } });
}

// -- Tests --------------------------------------------------------------------

describe("restoring a project writes nothing", () => {
  const initialAutoSaveDelay = useSettingsStore.getState().autoSaveDelay;

  beforeEach(() => {
    allowConsole(/cannot be a descendant of/);
    allowConsole(/cannot contain a nested/);
    useSettingsStore.setState({ autoSaveDelay: 30 });
  });
  afterEach(() => {
    useSettingsStore.setState({ autoSaveDelay: initialAutoSaveDelay });
  });

  describe("happy paths", () => {
    it("regression: a reload on the Import tab with MP3 audio does not move Last edited", async () => {
      await seedAudioProject("alpha", createMp3File("alpha.mp3"), { open: true, lastTab: "import" });
      await bootApp();
      await waitForAudioOf("alpha");
      expect(useProjectStore.getState().activeTab).toBe("import");
      await expectUntouched("alpha");
    });

    it("regression: a reload on the Sync tab with MP3 audio does not move Last edited", async () => {
      await seedAudioProject("alpha", createMp3File("alpha.mp3"), { open: true, lastTab: "sync" });
      await bootApp();
      await waitForAudioOf("alpha");
      expect(useProjectStore.getState().activeTab).toBe("sync");
      await expectUntouched("alpha");
    });

    it("regression: opening another project from the switcher does not move its Last edited", async () => {
      await seedAudioProject("alpha", createMp3File("alpha.mp3"), { open: true });
      await seedAudioProject("beta", createMp3File("beta.mp3"));
      await bootApp();
      await waitForAudioOf("alpha");

      await openProject("beta");
      await waitForAudioOf("beta");
      await expectUntouched("beta");
      expect((await loadProjectRecord("alpha"))?.savedAt).toBe(SAVED_AT);
    });
  });

  describe("edge cases", () => {
    it("a reload with WAV audio does not move Last edited", async () => {
      await seedAudioProject("wave", createAudioFile("wave.wav"), { open: true });
      await bootApp();
      await waitForAudioOf("wave");
      await expectUntouched("wave");
    });
  });

  describe("invariants", () => {
    it("a real edit after the restore still saves", async () => {
      await seedAudioProject("alpha", createMp3File("alpha.mp3"), { open: true });
      await bootApp();
      await waitForAudioOf("alpha");

      useProjectStore.getState().setMetadata({ title: "alpha edited" });
      await flushPendingSave();
      const record = await loadProjectRecord("alpha");
      expect(record?.metadata.title).toBe("alpha edited");
      expect(record?.savedAt).toBeGreaterThan(SAVED_AT);
    });
  });
});
