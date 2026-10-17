import { parseLamePriming } from "@/audio/lame-priming";
import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import type { WordTiming } from "@/domain/word/timing";
import { usePersistence } from "@/hooks/usePersistence";
import { saveAudioFile, saveCurrentProject } from "@/lib/persistence";
import { loadProjectForRestore } from "@/lib/project-restore";
import { getOpenProjectId } from "@/lib/project-storage";
import type { SavedProject } from "@/lib/saved-project";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createMp3File } from "@/test/audio-fixtures";
import { createProjectSaveInput } from "@/test/factories";
import { loadOpenProjectRecord } from "@/test/projects";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

// -- Helpers ------------------------------------------------------------------

function seedSavedProject(opts: { primingStripped: boolean }): Promise<void> {
  return saveCurrentProject(
    createProjectSaveInput({
      lines: [
        {
          id: "L1",
          text: "hello world",
          agentId: DEFAULT_AGENTS[0].id,
          words: [
            { text: "hello", begin: 1.0, end: 1.5 },
            { text: "world", begin: 1.5, end: 2.0 },
          ],
        },
      ],
      primingStripped: opts.primingStripped,
    }),
  );
}

async function loadOpenProjectForRestore(): Promise<SavedProject | undefined> {
  const id = await getOpenProjectId();
  return id ? (await loadProjectForRestore(id)).project : undefined;
}

// -- Tests --------------------------------------------------------------------

describe("loadProjectForRestore · LAME priming", () => {
  it("shifts saved line/word timings when project lacks primingStripped and audio has LAME priming", async () => {
    const mp3 = createMp3File();
    const { samples, sampleRate } = parseLamePriming(await mp3.arrayBuffer());
    expect(samples).toBeGreaterThan(0);
    expect(sampleRate).toBeGreaterThan(0);
    await saveAudioFile(mp3);
    await seedSavedProject({ primingStripped: false });

    const migrated = await loadOpenProjectForRestore();
    expect(migrated).toBeDefined();
    const shiftSec = samples / sampleRate;
    const words = (migrated!.lines[0] as { words: WordTiming[] }).words;
    expect(words[0].begin).toBeCloseTo(1.0 - shiftSec);
    expect(words[0].end).toBeCloseTo(1.5 - shiftSec);
    expect(words[1].begin).toBeCloseTo(1.5 - shiftSec);
    expect(words[1].end).toBeCloseTo(2.0 - shiftSec);
    expect(migrated!.primingStripped).toBe(true);
  });

  it("does not shift when primingStripped is already true", async () => {
    const mp3 = createMp3File();
    await saveAudioFile(mp3);
    await seedSavedProject({ primingStripped: true });

    const loaded = await loadOpenProjectForRestore();
    const words = (loaded!.lines[0] as { words: WordTiming[] }).words;
    expect(words[0].begin).toBeCloseTo(1.0);
    expect(words[1].end).toBeCloseTo(2.0);
    expect(loaded!.primingStripped).toBe(true);
  });

  it("leaves timings unchanged and does not set the flag when audio bytes are missing", async () => {
    await seedSavedProject({ primingStripped: false });

    const loaded = await loadOpenProjectForRestore();
    expect(loaded!.primingStripped).toBe(false);
    const words = (loaded!.lines[0] as { words: WordTiming[] }).words;
    expect(words[0].begin).toBeCloseTo(1.0);
    expect(words[1].end).toBeCloseTo(2.0);
  });

  it("returns undefined when there is no saved project", async () => {
    const loaded = await loadOpenProjectForRestore();
    expect(loaded).toBeUndefined();
  });

  it("sets primingStripped to true even when audio has zero priming", async () => {
    const noPrimingMp3 = new File([new Uint8Array([0, 1, 2, 3])], "not-mp3.bin", { type: "audio/mpeg" });
    expect(parseLamePriming(await noPrimingMp3.arrayBuffer()).samples).toBe(0);
    await saveAudioFile(noPrimingMp3);
    await seedSavedProject({ primingStripped: false });

    const loaded = await loadOpenProjectForRestore();
    expect(loaded!.primingStripped).toBe(true);
    const words = (loaded!.lines[0] as { words: WordTiming[] }).words;
    expect(words[0].begin).toBeCloseTo(1.0);
  });
});

describe("usePersistence priming-stripped flag survives the boot restore", () => {
  const initialAutoSaveDelay = useSettingsStore.getState().autoSaveDelay;

  beforeEach(() => {
    useSettingsStore.setState({ autoSaveDelay: 30 });
  });
  afterEach(() => {
    useSettingsStore.setState({ autoSaveDelay: initialAutoSaveDelay });
  });

  async function waitForProjectHydration(): Promise<void> {
    for (let i = 0; i < 200; i++) {
      if (useProjectStore.getState().lines.length > 0) return;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error("project store never hydrated");
  }

  it("regression: the restore write-back does not overwrite primingStripped with false", async () => {
    const mp3 = createMp3File();
    expect(parseLamePriming(await mp3.arrayBuffer()).samples).toBeGreaterThan(0);
    await saveAudioFile(mp3);
    await saveCurrentProject(
      createProjectSaveInput({ metadata: { title: "race", artists: [], album: "", duration: 0 } }),
    );

    await renderHook(() => usePersistence());
    await waitForProjectHydration();
    await new Promise((r) => setTimeout(r, 150));

    const reloaded = await loadOpenProjectRecord();
    expect(reloaded?.primingStripped).toBe(true);
  });

  it("flag stays true after the boot restore even when audio has zero priming", async () => {
    const noPrimingMp3 = new File([new Uint8Array([0, 1, 2, 3])], "not-mp3.bin", { type: "audio/mpeg" });
    await saveAudioFile(noPrimingMp3);
    await saveCurrentProject(
      createProjectSaveInput({
        metadata: { title: "race-zero", artists: [], album: "", duration: 0 },
        audioSource: { kind: "file", name: "not-mp3.bin" },
      }),
    );

    await renderHook(() => usePersistence());
    await waitForProjectHydration();
    await new Promise((r) => setTimeout(r, 150));

    const reloaded = await loadOpenProjectRecord();
    expect(reloaded?.primingStripped).toBe(true);
  });
});
