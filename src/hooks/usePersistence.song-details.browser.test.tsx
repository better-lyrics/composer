import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { usePersistence } from "@/hooks/usePersistence";
import { clearCurrentProject, loadCurrentProject } from "@/lib/persistence";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { seedProject } from "@/test/idb";
import { render } from "@/test/render";

// -- Helpers -------------------------------------------------------------------

const PersistenceHost: React.FC = () => {
  usePersistence();
  return null;
};

function savedProject(extra: Record<string, unknown> = {}) {
  return {
    version: 1,
    savedAt: Date.now(),
    metadata: { title: "Lovefield", artists: [], album: "", duration: 0 },
    lines: [{ id: "L1", text: "hi", agentId: DEFAULT_AGENTS[0].id }],
    agents: DEFAULT_AGENTS,
    granularity: "word" as const,
    ...extra,
  };
}

// -- Tests ---------------------------------------------------------------------

describe("usePersistence · unexported imported song details", () => {
  const initialAutoSaveDelay = useSettingsStore.getState().autoSaveDelay;

  beforeEach(async () => {
    useSettingsStore.setState({ autoSaveDelay: 30 });
    await clearCurrentProject();
  });
  afterEach(async () => {
    useSettingsStore.setState({ autoSaveDelay: initialAutoSaveDelay });
    await clearCurrentProject();
  });

  it("restores an unexported import across a reload", async () => {
    await seedProject(savedProject({ hasUnexportedImport: true }));

    await render(<PersistenceHost />);
    await getPersistenceSettled();

    expect(useProjectStore.getState().hasUnexportedImport).toBe(true);
  });

  it("saves the flag with the project", async () => {
    await render(<PersistenceHost />);
    await getPersistenceSettled();

    useProjectStore.getState().setLines([{ id: "L1", text: "hi", agentId: DEFAULT_AGENTS[0].id }]);
    useProjectStore.getState().markSongDetailsImported();

    await expect.poll(async () => (await loadCurrentProject())?.hasUnexportedImport, { timeout: 2000 }).toBe(true);
  });

  describe("edge cases", () => {
    it("treats a project saved before the flag existed as exported", async () => {
      await seedProject(savedProject());

      await render(<PersistenceHost />);
      await getPersistenceSettled();

      expect(useProjectStore.getState().lines).toHaveLength(1);
      expect(useProjectStore.getState().hasUnexportedImport).toBe(false);
    });
  });
});
