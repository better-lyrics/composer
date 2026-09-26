import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { usePersistence } from "@/hooks/usePersistence";
import { useVocalOnsetSnapPoints } from "@/hooks/useVocalOnsetSnapPoints";
import { clearCurrentProject, type SavedProject, saveAudioFile, saveCurrentProject } from "@/lib/persistence";
import { PROJECT_STORE_NAME, setInStore } from "@/lib/persistence-idb";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createMp3File } from "@/test/audio-fixtures";
import { snapPoints } from "@/test/factories";
import { render } from "@/test/render";

// -- Helpers ------------------------------------------------------------------

async function waitForProjectHydration(): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (useProjectStore.getState().lines.length > 0) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("project store never hydrated");
}

async function waitForCustomSnapPoints(expected: number[]): Promise<void> {
  for (let i = 0; i < 200; i++) {
    const current = useProjectStore.getState().customSnapPoints;
    if (current.length === expected.length && current.every((point, idx) => point.time === expected[idx])) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`customSnapPoints never became ${JSON.stringify(expected)}`);
}

const LoadHarness: React.FC = () => {
  usePersistence();
  useVocalOnsetSnapPoints();
  return null;
};

// -- Tests --------------------------------------------------------------------

describe("usePersistence · customSnapPoints hydration", () => {
  const initialAutoSaveDelay = useSettingsStore.getState().autoSaveDelay;

  beforeEach(async () => {
    useSettingsStore.setState({ autoSaveDelay: 30 });
    await clearCurrentProject();
  });
  afterEach(async () => {
    useSettingsStore.setState({ autoSaveDelay: initialAutoSaveDelay });
    await clearCurrentProject();
  });

  it("regression: usePersistence hydrates saved customSnapPoints into the project store", async () => {
    await saveAudioFile(createMp3File());
    await saveCurrentProject(
      { title: "with-markers", artists: [], album: "", duration: 0 },
      DEFAULT_AGENTS,
      [{ id: "L1", text: "hi", agentId: DEFAULT_AGENTS[0].id }],
      [],
      "word",
      { applyToAll: false, caseInsensitive: false },
      { kind: "file", name: "silence.mp3" },
      [],
      [],
      "original",
      false,
      snapPoints([4, 9]),
    );

    await renderHook(() => usePersistence());
    await waitForProjectHydration();
    await waitForCustomSnapPoints([4, 9]);

    expect(useProjectStore.getState().customSnapPoints.map((p) => p.time)).toEqual([4, 9]);
  });

  it("a legacy saved project (no customSnapPoints) hydrates the store to []", async () => {
    useProjectStore.setState({ customSnapPoints: snapPoints([1, 2]) });

    const legacyRecord: SavedProject = {
      version: 1,
      savedAt: Date.now(),
      metadata: { title: "legacy", artists: [], album: "", duration: 0 },
      agents: DEFAULT_AGENTS,
      lines: [{ id: "L1", text: "hi", agentId: DEFAULT_AGENTS[0].id }],
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
    await saveAudioFile(createMp3File());

    await renderHook(() => usePersistence());
    await waitForProjectHydration();
    await waitForCustomSnapPoints([]);

    expect(useProjectStore.getState().customSnapPoints).toEqual([]);
  });

  it("regression: a saved project's markers survive the audio-source clear fired during load", async () => {
    await saveAudioFile(createMp3File());
    await saveCurrentProject(
      { title: "survives-load", artists: [], album: "", duration: 0 },
      DEFAULT_AGENTS,
      [{ id: "L1", text: "hi", agentId: DEFAULT_AGENTS[0].id }],
      [],
      "word",
      { applyToAll: false, caseInsensitive: false },
      { kind: "file", name: "silence.mp3" },
      [],
      [],
      "original",
      false,
      snapPoints([5, 12]),
    );

    useProjectStore.setState({ customSnapPoints: [] });

    await render(<LoadHarness />);
    await waitForProjectHydration();

    await expect.poll(() => useProjectStore.getState().customSnapPoints.map((p) => p.time)).toEqual([5, 12]);
  });
});
