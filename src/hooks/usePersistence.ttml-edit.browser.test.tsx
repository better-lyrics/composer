import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { usePersistence } from "@/hooks/usePersistence";
import { clearCurrentProject, loadCurrentProject } from "@/lib/persistence";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { seedProject } from "@/test/idb";
import { render } from "@/test/render";

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

  beforeEach(async () => {
    useSettingsStore.setState({ autoSaveDelay: 30 });
    await clearCurrentProject();
  });
  afterEach(async () => {
    useSettingsStore.setState({ autoSaveDelay: initialAutoSaveDelay });
    await clearCurrentProject();
  });

  it("saves the edit with the project", async () => {
    await mountPersistence();

    useProjectStore.getState().setLines([{ id: "L1", text: "hi", agentId: DEFAULT_AGENTS[0].id }]);
    useProjectStore.getState().setTtmlEditState(EDIT);

    await expect.poll(async () => (await loadCurrentProject())?.ttmlEditState, { timeout: 2000 }).toEqual(EDIT);
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

    await expect.poll(async () => (await loadCurrentProject())?.ttmlEditState, { timeout: 2000 }).toBeNull();
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
