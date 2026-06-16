import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { clearCurrentProject, loadCurrentProject, type SavedProject, saveCurrentProject } from "@/lib/persistence";
import { PROJECT_STORE_NAME, setInStore } from "@/lib/persistence-idb";

// The shared browser setup (src/test/setup-browser.ts) deletes the entire
// `ttml-composer` database before every test. We also clear the current
// project record explicitly to mirror the existing IDB test style.

// -- Helpers ------------------------------------------------------------------

function saveWithSnapPoints(customSnapPoints: number[]): Promise<void> {
  return saveCurrentProject(
    { title: "snap", artist: "", album: "", duration: 0 },
    DEFAULT_AGENTS,
    [{ id: "L1", text: "hello", agentId: DEFAULT_AGENTS[0].id }],
    [],
    "word",
    { applyToAll: false, caseInsensitive: false },
    { kind: "file", name: "silence.mp3" },
    [],
    [],
    "original",
    false,
    customSnapPoints,
  );
}

// -- Tests --------------------------------------------------------------------

describe("persistence · customSnapPoints", () => {
  beforeEach(async () => {
    await clearCurrentProject();
  });
  afterEach(async () => {
    await clearCurrentProject();
  });

  it("saveCurrentProject persists customSnapPoints and loadCurrentProject reads them back", async () => {
    await saveWithSnapPoints([5, 12]);
    const loaded = await loadCurrentProject();
    expect(loaded?.customSnapPoints).toEqual([5, 12]);
  });

  it("saveCurrentProject persists an empty customSnapPoints array", async () => {
    await saveWithSnapPoints([]);
    const loaded = await loadCurrentProject();
    expect(loaded?.customSnapPoints).toEqual([]);
  });

  it("round-trips a longer sorted array with numeric fidelity", async () => {
    await saveWithSnapPoints([0, 1.5, 3.25, 99]);
    const loaded = await loadCurrentProject();
    expect(loaded?.customSnapPoints).toEqual([0, 1.5, 3.25, 99]);
  });

  it("a legacy record saved without customSnapPoints loads with the field undefined", async () => {
    const legacyRecord: SavedProject = {
      version: 1,
      savedAt: Date.now(),
      metadata: { title: "legacy", artist: "", album: "", duration: 0 },
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

    const loaded = await loadCurrentProject();
    expect(loaded?.customSnapPoints).toBeUndefined();
  });
});
