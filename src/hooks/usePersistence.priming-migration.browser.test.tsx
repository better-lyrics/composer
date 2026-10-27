import { parseLamePriming } from "@/audio/lame-priming";
import type { WordTiming } from "@/domain/word/timing";
import { usePersistence } from "@/hooks/usePersistence";
import { saveAudioFile, saveCurrentProject } from "@/lib/persistence";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createMp3File } from "@/test/audio-fixtures";
import { createProjectSaveInput } from "@/test/factories";
import { loadOpenProjectForRestore, seedSavedProject } from "@/test/priming-projects";
import { loadOpenProjectRecord } from "@/test/projects";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

// -- Tests --------------------------------------------------------------------

describe("loadProjectForRestore · LAME priming", () => {
  it("regression: a project saved before #117 keeps its timings and gets both flags", async () => {
    await saveAudioFile(createMp3File());
    await seedSavedProject({ primingStripped: false, primingCorrected: false });

    const migrated = await loadOpenProjectForRestore();

    const words = (migrated!.lines[0] as { words: WordTiming[] }).words;
    expect(words[0].begin).toBeCloseTo(1.0, 9);
    expect(words[1].end).toBeCloseTo(2.0, 9);
    expect(migrated).toMatchObject({ primingStripped: true, primingCorrected: true });
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
    await seedSavedProject({ primingStripped: false, primingCorrected: false });

    const loaded = await loadOpenProjectForRestore();
    expect(loaded!.primingStripped).toBe(false);
    expect(loaded!.primingCorrected).toBe(false);
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
    await seedSavedProject({ primingStripped: false, primingCorrected: false });

    const loaded = await loadOpenProjectForRestore();
    expect(loaded!.primingStripped).toBe(true);
    expect(loaded!.primingCorrected).toBe(true);
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
