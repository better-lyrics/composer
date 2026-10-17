import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import type { SnapPoint } from "@/domain/snap-point/model";
import { saveCurrentProject } from "@/lib/persistence";
import { PROJECT_STORE_NAME, setInStore } from "@/lib/persistence-idb";
import type { SavedProject } from "@/lib/saved-project";
import { createProjectSaveInput, snapPoints } from "@/test/factories";
import { loadOpenProjectRecord } from "@/test/projects";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function saveWithSnapPoints(customSnapPoints: SnapPoint[]): Promise<void> {
  return saveCurrentProject(
    createProjectSaveInput({
      metadata: { title: "snap", artists: [], album: "", duration: 0 },
      lines: [{ id: "L1", text: "hello", agentId: DEFAULT_AGENTS[0].id }],
      customSnapPoints,
    }),
  );
}

// -- Tests --------------------------------------------------------------------

describe("persistence · customSnapPoints", () => {
  it("saveCurrentProject persists customSnapPoints and the stored record reads them back", async () => {
    await saveWithSnapPoints(snapPoints([5, 12]));
    const loaded = await loadOpenProjectRecord();
    expect(loaded?.customSnapPoints?.map((p) => (typeof p === "number" ? p : p.time))).toEqual([5, 12]);
  });

  it("saveCurrentProject persists an empty customSnapPoints array", async () => {
    await saveWithSnapPoints([]);
    const loaded = await loadOpenProjectRecord();
    expect(loaded?.customSnapPoints).toEqual([]);
  });

  it("round-trips a longer sorted array with numeric fidelity", async () => {
    await saveWithSnapPoints(snapPoints([0, 1.5, 3.25, 99]));
    const loaded = await loadOpenProjectRecord();
    expect(loaded?.customSnapPoints?.map((p) => (typeof p === "number" ? p : p.time))).toEqual([0, 1.5, 3.25, 99]);
  });

  describe("regressions", () => {
    it("round-trips snap point ids and times unchanged", async () => {
      const saved = snapPoints([5, 12]);
      await saveWithSnapPoints(saved);
      const loaded = await loadOpenProjectRecord();
      // Persistence must preserve the stable id, not just the time, so reloaded
      // pins keep their AnimatePresence identity.
      expect(loaded?.customSnapPoints).toEqual(saved);
    });
  });

  it("a legacy record saved without customSnapPoints loads with the field undefined", async () => {
    const legacyRecord: SavedProject = {
      version: 1,
      savedAt: Date.now(),
      metadata: { title: "legacy", artists: [], album: "", duration: 0 },
      agents: DEFAULT_AGENTS,
      lines: [{ id: "L1", text: "hello", agentId: DEFAULT_AGENTS[0].id }],
      groups: [],
      granularity: "word",
      syllableSplitDefaults: { applyToAll: false, caseInsensitive: false },
      audioFileName: "silence.mp3",
      audioSource: { kind: "file", name: "silence.mp3" },
      dismissedSuggestions: [],
      dismissedExplicitSuggestions: [],
      currentStem: "original",
      primingStripped: false,
    };
    await setInStore(PROJECT_STORE_NAME, "current", legacyRecord);

    const loaded = await loadOpenProjectRecord();
    expect(loaded?.customSnapPoints).toBeUndefined();
  });
});
