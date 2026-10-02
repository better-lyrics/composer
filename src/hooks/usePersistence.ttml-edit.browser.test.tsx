import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { usePersistence } from "@/hooks/usePersistence";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { seedProject } from "@/test/idb";
import { loadOpenProjectRecord } from "@/test/projects";
import { render } from "@/test/render";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const PersistenceHost: React.FC = () => {
  usePersistence();
  return null;
};

const EDIT = { source: "<tt>generated</tt>", content: "<tt>hand edited</tt>" };

function savedProject(extra: Record<string, unknown> = {}) {
  return {
    version: 3,
    savedAt: Date.now(),
    metadata: { title: "Lovefield", artists: [], album: "", duration: 0 },
    lines: [{ id: "L1", text: "hi", agentId: DEFAULT_AGENTS[0].id }],
    agents: DEFAULT_AGENTS,
    granularity: "word" as const,
    ...extra,
  };
}

async function mountPersistence(): Promise<void> {
  await render(<PersistenceHost />);
  await getPersistenceSettled();
}

describe("usePersistence · hand-edited TTML", () => {
  const initialAutoSaveDelay = useSettingsStore.getState().autoSaveDelay;

  beforeEach(() => {
    useSettingsStore.setState({ autoSaveDelay: 30 });
  });
  afterEach(() => {
    useSettingsStore.setState({ autoSaveDelay: initialAutoSaveDelay });
  });

  it("saves the edit with the project", async () => {
    await mountPersistence();

    useProjectStore.getState().setLines([{ id: "L1", text: "hi", agentId: DEFAULT_AGENTS[0].id }]);
    useProjectStore.getState().setTtmlEditState(EDIT);

    await expect.poll(async () => (await loadOpenProjectRecord())?.ttmlEditState, { timeout: 2000 }).toEqual(EDIT);
  });

  it("restores the edit across a reload", async () => {
    await seedProject(savedProject({ ttmlEditState: EDIT }));
    await mountPersistence();

    expect(useProjectStore.getState().ttmlEditState).toEqual(EDIT);
    expect(useProjectStore.getState().isDirty).toBe(false);
  });

  it("saves a regenerate so the edit does not come back", async () => {
    await seedProject(savedProject({ ttmlEditState: EDIT }));
    await mountPersistence();

    useProjectStore.getState().setTtmlEditState(null);

    await expect.poll(async () => (await loadOpenProjectRecord())?.ttmlEditState, { timeout: 2000 }).toBeNull();
  });

  describe("regressions", () => {
    it("regression: saves and restores that the lyrics changed under the edit", async () => {
      const kept = { ...EDIT, lyricsChanged: true as const };
      await seedProject(savedProject({ ttmlEditState: kept }));
      await mountPersistence();

      expect(useProjectStore.getState().ttmlEditState).toEqual(kept);

      const typedAgain = { ...kept, content: "<tt>hand edited again</tt>" };
      useProjectStore.getState().setTtmlEditState(typedAgain);
      await expect
        .poll(async () => (await loadOpenProjectRecord())?.ttmlEditState, { timeout: 2000 })
        .toEqual(typedAgain);
    });

    it("regression: loads an edit saved with a line key map by an earlier build", async () => {
      await seedProject(savedProject({ ttmlEditState: { ...EDIT, lineKeyIds: { L1: "L1" } } }));
      await mountPersistence();

      expect(useProjectStore.getState().ttmlEditState).toMatchObject(EDIT);
      expect(useProjectStore.getState().lines).toHaveLength(1);
    });
  });

  describe("edge cases", () => {
    it("restores no edit for a project saved before the field existed", async () => {
      await seedProject(savedProject());
      await mountPersistence();

      expect(useProjectStore.getState().lines).toHaveLength(1);
      expect(useProjectStore.getState().ttmlEditState).toBeNull();
    });
  });
});
