import { usePersistence } from "@/hooks/usePersistence";
import { restoreOpenProject } from "@/lib/open-project";
import { PROJECT_INDEX_STORE_NAME, setInStore } from "@/lib/persistence-idb";
import { flushPendingSave } from "@/lib/persistence-debounce";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { loadProjectIndexEntry, setProjectLastTab } from "@/lib/project-repository";
import {
  EMPTY_RESTORE,
  applyProjectToStores,
  hasRestorableContent,
  hasStoredProject,
  isRestoringProject,
  loadProjectForRestore,
} from "@/lib/project-restore";
import { loadProjectRecord } from "@/lib/project-storage";
import { SAVED_PROJECT_VERSION } from "@/lib/saved-project";
import { getSaveStatus } from "@/lib/save-status";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { seedStoredProject } from "@/test/projects";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const PersistenceHost: React.FC = () => {
  usePersistence();
  return null;
};

// -- Tests --------------------------------------------------------------------

describe("project-restore", () => {
  it("loadProjectForRestore returns the record, its audio and its last tab", async () => {
    await seedStoredProject("p1", { audio: createAudioFile("city.wav") });
    await setProjectLastTab("p1", "sync");
    const payload = await loadProjectForRestore("p1");
    expect(payload.project?.metadata.title).toBe("Midnight City");
    expect(payload.audio?.name).toBe("city.wav");
    expect(payload.lastTab).toBe("sync");
  });

  it("applyProjectToStores fills every store from the payload and leaves the project clean", async () => {
    await seedStoredProject("p1", {
      audio: createAudioFile("city.wav"),
      project: { currentStem: "vocals", audioSource: { kind: "file", name: "city.wav" } },
    });
    await setProjectLastTab("p1", "timeline");
    applyProjectToStores(await loadProjectForRestore("p1"));
    const project = useProjectStore.getState();
    expect(project.metadata.title).toBe("Midnight City");
    expect(project.lines.map((line) => line.text)).toEqual(["Waiting in a car", "Waiting for a ride"]);
    expect(project.activeTab).toBe("timeline");
    expect(project.isDirty).toBe(false);
    expect(useSeparationStore.getState().currentStem).toBe("vocals");
    const source = useAudioStore.getState().source;
    expect(source?.type === "file" ? source.file.name : null).toBe("city.wav");
  });

  it("applying EMPTY_RESTORE clears the previous project from every store", async () => {
    await seedStoredProject("p1", {
      audio: createAudioFile("city.wav"),
      project: { audioSource: { kind: "file", name: "city.wav" } },
    });
    applyProjectToStores(await loadProjectForRestore("p1"));
    useTimelineStore.getState().setSelectedWords([{ lineId: "x", lineIndex: 0, wordIndex: 0, type: "word" }]);
    applyProjectToStores(EMPTY_RESTORE);
    expect(useProjectStore.getState().lines).toEqual([]);
    expect(useProjectStore.getState().metadata.title).toBe("");
    expect(useProjectStore.getState().activeTab).toBe("import");
    expect(useAudioStore.getState().source).toBeNull();
    expect(useTimelineStore.getState().selectedWords).toEqual([]);
  });

  it("restoreOpenProject records when the project was opened", async () => {
    await seedStoredProject("p1", { open: true, project: { savedAt: 100 } });
    await restoreOpenProject();
    await expect.poll(async () => (await loadProjectIndexEntry("p1"))?.openedAt ?? 0).toBeGreaterThan(100);
    expect((await loadProjectIndexEntry("p1"))?.updatedAt).toBe(100);
  });

  describe("edge cases", () => {
    it("loadProjectForRestore on an unknown id returns an empty payload", async () => {
      expect(await loadProjectForRestore("missing")).toEqual(EMPTY_RESTORE);
    });

    it("ignores a stored last tab that is not a tab", async () => {
      await seedStoredProject("p1");
      await setProjectLastTab("p1", "sync");
      expect((await loadProjectForRestore("p1")).lastTab).toBe("sync");
      const entry = await loadProjectIndexEntry("p1");
      await setInStore(PROJECT_INDEX_STORE_NAME, "p1", { ...entry, lastTab: "library" });
      expect((await loadProjectForRestore("p1")).lastTab).toBeUndefined();
    });

    it("falls back to safe defaults and warns on a malformed record", async () => {
      allowConsole(/malformed fields/);
      await seedStoredProject("p1", { project: { agents: [] } });
      applyProjectToStores(await loadProjectForRestore("p1"));
      expect(useProjectStore.getState().agents.length).toBeGreaterThan(0);
    });

    it("upgrades an old record without moving its edit time", async () => {
      await seedStoredProject("p1", { project: { version: 1, lines: [createLine({ text: "hello" })] } });
      await loadProjectForRestore("p1");
      expect((await loadProjectRecord("p1"))?.version).toBe(SAVED_PROJECT_VERSION);
      expect((await loadProjectRecord("p1"))?.savedAt).toBe(1_758_900_000_000);
    });

    it("hasStoredProject requires a project record; hasRestorableContent accepts audio alone", () => {
      expect(hasStoredProject(EMPTY_RESTORE)).toBe(false);
      expect(hasRestorableContent(EMPTY_RESTORE)).toBe(false);
      const audioOnly = { ...EMPTY_RESTORE, audio: createAudioFile("a.wav") };
      expect(hasStoredProject(audioOnly)).toBe(false);
      expect(hasRestorableContent(audioOnly)).toBe(true);
    });
  });

  describe("invariants", () => {
    it("isRestoringProject is true inside store subscribers during a restore and false after", async () => {
      await seedStoredProject("p1");
      const seen: boolean[] = [];
      const unsubscribe = useProjectStore.subscribe(() => seen.push(isRestoringProject()));
      applyProjectToStores(await loadProjectForRestore("p1"));
      unsubscribe();
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every(Boolean)).toBe(true);
      expect(isRestoringProject()).toBe(false);
    });
  });

  describe("regressions", () => {
    it("regression: a boot restore does not save the project again or move its last edited time", async () => {
      useSettingsStore.setState({ autoSaveDelay: 60_000 });
      await seedStoredProject("p1", { open: true, project: { savedAt: 111, currentStem: "vocals" } });
      await render(<PersistenceHost />);
      await getPersistenceSettled();
      expect(getSaveStatus()).toBe("saved");
      await flushPendingSave();
      expect((await loadProjectRecord("p1"))?.savedAt).toBe(111);
      expect((await loadProjectIndexEntry("p1"))?.updatedAt).toBe(111);
    });

    it("regression: switching tabs after boot remembers the tab without saving the record", async () => {
      useSettingsStore.setState({ autoSaveDelay: 20 });
      await seedStoredProject("p1", { open: true, project: { savedAt: 222 } });
      await render(<PersistenceHost />);
      await getPersistenceSettled();
      useProjectStore.getState().setActiveTab("sync");
      await expect.poll(async () => (await loadProjectIndexEntry("p1"))?.lastTab).toBe("sync");
      expect((await loadProjectRecord("p1"))?.savedAt).toBe(222);
    });
  });
});
