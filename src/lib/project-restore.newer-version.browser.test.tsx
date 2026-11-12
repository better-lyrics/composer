import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "@/App";
import { openProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { flushPendingSave } from "@/lib/persistence-debounce";
import { getFromStore, PROJECT_RECORD_STORE_NAME, setInStore } from "@/lib/persistence-idb";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import {
  loadProjectIndexEntry,
  saveProjectRecord,
  setProjectResumePosition,
  updateProjectRecord,
} from "@/lib/project-repository";
import { NewerProjectError, SAVED_PROJECT_VERSION } from "@/lib/saved-project";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { allowConsole } from "@/test/console-guard";
import { createLine } from "@/test/factories";
import { seedStoredProject, songTitled, storedProject } from "@/test/projects";
import { render } from "@/test/render";

// -- Helpers ------------------------------------------------------------------

async function seedNewerProject(id: string, options: { open?: boolean } = {}): Promise<unknown> {
  await seedStoredProject(id, { project: songTitled("From a newer build"), open: options.open });
  const newer = {
    ...storedProject({ ...songTitled("From a newer build"), lines: [createLine({ text: "Shape we cannot read" })] }),
    version: SAVED_PROJECT_VERSION + 1,
    tracks: { main: ["s1", "s2"] },
  };
  await setInStore(PROJECT_RECORD_STORE_NAME, id, newer);
  return newer;
}

function storedRecord(id: string): Promise<unknown> {
  return getFromStore(PROJECT_RECORD_STORE_NAME, id);
}

// -- Tests --------------------------------------------------------------------

describe("a project saved by a newer Composer", () => {
  const initialAutoSaveDelay = useSettingsStore.getState().autoSaveDelay;

  beforeEach(() => {
    allowConsole(/cannot be a descendant of/);
    allowConsole(/cannot contain a nested/);
    allowConsole(/newer version of Composer/);
    useSettingsStore.setState({ autoSaveDelay: 30 });
  });
  afterEach(() => {
    useSettingsStore.setState({ autoSaveDelay: initialAutoSaveDelay });
  });

  it("regression: a reload with it open neither loads it nor saves over it", async () => {
    const newer = await seedNewerProject("future", { open: true });
    const resumePosition = { time: 42, zoom: 180 };
    await setProjectResumePosition("future", resumePosition);
    await render(<App />, { withRouter: { initialEntries: ["/editor"] } });
    await getPersistenceSettled();

    expect(useProjectStore.getState().metadata.title).not.toBe("From a newer build");
    expect(openProjectIdSnapshot()).not.toBe("future");
    useProjectStore.getState().setLines([createLine({ text: "Typed after the reload" })]);
    await flushPendingSave();
    expect(await storedRecord("future")).toEqual(newer);
    expect((await loadProjectIndexEntry("future"))?.resumePosition).toEqual(resumePosition);
  });

  it("refuses to open it from the library", async () => {
    const newer = await seedNewerProject("future");
    await expect(openProject("future")).rejects.toBeInstanceOf(NewerProjectError);
    expect(openProjectIdSnapshot()).not.toBe("future");
    expect(await storedRecord("future")).toEqual(newer);
  });

  it("refuses every write over it", async () => {
    const newer = await seedNewerProject("future");
    await expect(saveProjectRecord("future", storedProject())).rejects.toBeInstanceOf(NewerProjectError);
    await expect(
      updateProjectRecord("future", (project) => ({ ...project, metadata: { ...project.metadata, title: "Renamed" } })),
    ).rejects.toBeInstanceOf(NewerProjectError);
    expect(await storedRecord("future")).toEqual(newer);
  });
});
