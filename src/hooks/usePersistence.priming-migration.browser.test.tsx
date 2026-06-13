import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { parseLamePriming } from "@/audio/lame-priming";
import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import type { WordTiming } from "@/domain/word/timing";
import { usePersistence } from "@/hooks/usePersistence";
import { MemoryAudioBlobStore } from "@/lib/audio-blob-store";
import { migrateSingleSlotToLibrary } from "@/lib/library-migration";
import { getLibraryProject, listLibraryProjects } from "@/lib/library-persistence";
import { clearCurrentProject, saveAudioFile, saveCurrentProject } from "@/lib/persistence";
import { applyPrimingShiftIfNeeded } from "@/lib/priming-migration";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile, createMp3File } from "@/test/audio-fixtures";
import { seedLibraryProject } from "@/test/idb";

// -- Helpers ------------------------------------------------------------------

function seedSavedProject(opts: { primingStripped: boolean; audioName?: string }): Promise<void> {
  return saveCurrentProject(
    { title: "t", artist: "", album: "", duration: 0 },
    DEFAULT_AGENTS,
    [
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
    [],
    "word",
    { applyToAll: false, caseInsensitive: false },
    { kind: "file", name: opts.audioName ?? "silence.mp3" },
    [],
    [],
    "original",
    opts.primingStripped,
  );
}

// -- applyPrimingShiftIfNeeded ------------------------------------------------

describe("applyPrimingShiftIfNeeded", () => {
  it("shifts timings when primingStripped is false and audio has LAME priming", async () => {
    const mp3 = createMp3File();
    const audioBytes = await mp3.arrayBuffer();
    const { samples, sampleRate } = parseLamePriming(audioBytes);
    expect(samples).toBeGreaterThan(0);
    expect(sampleRate).toBeGreaterThan(0);

    const lines = [
      {
        id: "L1",
        text: "hello",
        agentId: "v1",
        words: [
          { text: "hello", begin: 1.0, end: 1.5 },
          { text: "world", begin: 1.5, end: 2.0 },
        ],
      },
    ];
    const result = applyPrimingShiftIfNeeded(lines, audioBytes, false);
    const shiftSec = samples / sampleRate;
    const words = (result.lines[0] as { words: WordTiming[] }).words;
    expect(words[0].begin).toBeCloseTo(1.0 - shiftSec);
    expect(words[1].end).toBeCloseTo(2.0 - shiftSec);
    expect(result.primingStripped).toBe(true);
  });

  it("does not shift when primingStripped is already true", async () => {
    const mp3 = createMp3File();
    const audioBytes = await mp3.arrayBuffer();
    const lines = [{ id: "L1", text: "x", agentId: "v1", words: [{ text: "x", begin: 1.0, end: 1.5 }] }];

    const result = applyPrimingShiftIfNeeded(lines, audioBytes, true);
    expect(result.lines).toBe(lines);
    expect((result.lines[0] as { words: WordTiming[] }).words[0].begin).toBeCloseTo(1.0);
    expect(result.primingStripped).toBe(true);
  });

  it("does not shift and preserves the flag when audio bytes are missing", () => {
    const lines = [{ id: "L1", text: "x", agentId: "v1", words: [{ text: "x", begin: 1.0, end: 1.5 }] }];
    const result = applyPrimingShiftIfNeeded(lines, undefined, false);
    expect(result.lines).toBe(lines);
    expect(result.primingStripped).toBe(false);
  });

  it("sets primingStripped to true even when MP3 has zero priming", async () => {
    const noPriming = new File([new Uint8Array([0, 1, 2, 3])], "x.bin", { type: "audio/mpeg" });
    const bytes = await noPriming.arrayBuffer();
    expect(parseLamePriming(bytes).samples).toBe(0);

    const lines = [{ id: "L1", text: "x", agentId: "v1", words: [{ text: "x", begin: 1.0, end: 1.5 }] }];
    const result = applyPrimingShiftIfNeeded(lines, bytes, false);
    expect((result.lines[0] as { words: WordTiming[] }).words[0].begin).toBeCloseTo(1.0);
    expect(result.primingStripped).toBe(true);
  });

  it("does not shift non-MP3 audio that lacks a LAME tag and still flips the flag", async () => {
    const wav = createAudioFile();
    const bytes = await wav.arrayBuffer();
    expect(parseLamePriming(bytes).samples).toBe(0);

    const lines = [{ id: "L1", text: "x", agentId: "v1", words: [{ text: "x", begin: 1.0, end: 1.5 }] }];
    const result = applyPrimingShiftIfNeeded(lines, bytes, false);
    expect((result.lines[0] as { words: WordTiming[] }).words[0].begin).toBeCloseTo(1.0);
    expect(result.primingStripped).toBe(true);
  });
});

// -- migrateSingleSlotToLibrary integration ----------------------------------

describe("migrateSingleSlotToLibrary applies the priming shift", () => {
  beforeEach(async () => {
    await clearCurrentProject();
  });
  afterEach(async () => {
    await clearCurrentProject();
  });

  it("shifts saved timings into the new library record when the old slot lacks primingStripped", async () => {
    const mp3 = createMp3File();
    const { samples, sampleRate } = parseLamePriming(await mp3.arrayBuffer());
    expect(samples).toBeGreaterThan(0);
    await saveAudioFile(mp3);
    await seedSavedProject({ primingStripped: false });

    const result = await migrateSingleSlotToLibrary({ audioBlobs: new MemoryAudioBlobStore() });
    expect(result.migratedId).toBeDefined();

    const stored = await getLibraryProject(result.migratedId as string);
    expect(stored?.primingStripped).toBe(true);
    const shiftSec = samples / sampleRate;
    const words = (stored?.lines[0] as { words: WordTiming[] }).words;
    expect(words[0].begin).toBeCloseTo(1.0 - shiftSec);
    expect(words[1].end).toBeCloseTo(2.0 - shiftSec);
  });

  it("does not double-shift when primingStripped is already true on the old slot", async () => {
    const mp3 = createMp3File();
    await saveAudioFile(mp3);
    await seedSavedProject({ primingStripped: true });

    const result = await migrateSingleSlotToLibrary({ audioBlobs: new MemoryAudioBlobStore() });
    const stored = await getLibraryProject(result.migratedId as string);
    expect(stored?.primingStripped).toBe(true);
    const words = (stored?.lines[0] as { words: WordTiming[] }).words;
    expect(words[0].begin).toBeCloseTo(1.0);
    expect(words[1].end).toBeCloseTo(2.0);
  });

  it("does not shift when audio is missing and preserves the unset flag", async () => {
    await seedSavedProject({ primingStripped: false });

    const result = await migrateSingleSlotToLibrary({ audioBlobs: new MemoryAudioBlobStore() });
    const stored = await getLibraryProject(result.migratedId as string);
    expect(stored?.primingStripped).toBe(false);
    const words = (stored?.lines[0] as { words: WordTiming[] }).words;
    expect(words[0].begin).toBeCloseTo(1.0);
    expect(words[1].end).toBeCloseTo(2.0);
  });

  it("does not shift non-MP3 audio (WAV) and flips the flag", async () => {
    const wav = createAudioFile();
    await saveAudioFile(wav);
    await seedSavedProject({ primingStripped: false, audioName: "silence.wav" });

    const result = await migrateSingleSlotToLibrary({ audioBlobs: new MemoryAudioBlobStore() });
    const stored = await getLibraryProject(result.migratedId as string);
    expect(stored?.primingStripped).toBe(true);
    const words = (stored?.lines[0] as { words: WordTiming[] }).words;
    expect(words[0].begin).toBeCloseTo(1.0);
    expect(words[1].end).toBeCloseTo(2.0);
  });
});

// -- Boot path: debounced save preserves primingStripped ----------------------

describe("usePersistence boot path preserves primingStripped through the debounced save", () => {
  const initialAutoSaveDelay = useSettingsStore.getState().autoSaveDelay;
  const SEEDED_ID = "priming-project";

  beforeEach(async () => {
    useSettingsStore.setState({ autoSaveDelay: 30 });
    await clearCurrentProject();
  });
  afterEach(async () => {
    useSettingsStore.setState({ autoSaveDelay: initialAutoSaveDelay });
    await clearCurrentProject();
  });

  async function waitForProjectHydration(): Promise<void> {
    for (let i = 0; i < 200; i++) {
      if (useProjectStore.getState().lines.length > 0) return;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error("project store never hydrated");
  }

  it("regression: library boot's debounced save does not overwrite primingStripped with false", async () => {
    await seedLibraryProject(SEEDED_ID, {
      metadata: { title: "race", artist: "", album: "", duration: 0 },
      agents: DEFAULT_AGENTS,
      lines: [{ id: "L1", text: "hi", agentId: DEFAULT_AGENTS[0].id }],
      granularity: "word",
      audioSource: { kind: "file", name: "silence.mp3" },
      primingStripped: true,
    });

    await renderHook(() => usePersistence());
    await waitForProjectHydration();
    await new Promise((r) => setTimeout(r, 150));

    const reloaded = await getLibraryProject(SEEDED_ID);
    expect(reloaded?.primingStripped).toBe(true);
  });

  it("flag stays true after debounced save even when audio has zero priming", async () => {
    await seedLibraryProject(SEEDED_ID, {
      metadata: { title: "race-zero", artist: "", album: "", duration: 0 },
      agents: DEFAULT_AGENTS,
      lines: [{ id: "L1", text: "hi", agentId: DEFAULT_AGENTS[0].id }],
      granularity: "word",
      audioSource: { kind: "file", name: "not-mp3.bin" },
      primingStripped: true,
    });

    await renderHook(() => usePersistence());
    await waitForProjectHydration();
    await new Promise((r) => setTimeout(r, 150));

    const reloaded = await getLibraryProject(SEEDED_ID);
    expect(reloaded?.primingStripped).toBe(true);
  });

  it("regression: migration on boot shifts timings AND survives the post-load debounced save", async () => {
    const mp3 = createMp3File();
    const { samples, sampleRate } = parseLamePriming(await mp3.arrayBuffer());
    expect(samples).toBeGreaterThan(0);
    await saveAudioFile(mp3);
    await seedSavedProject({ primingStripped: false });

    expect(await listLibraryProjects()).toHaveLength(0);

    await renderHook(() => usePersistence());
    await waitForProjectHydration();
    await new Promise((r) => setTimeout(r, 150));

    const list = await listLibraryProjects();
    expect(list).toHaveLength(1);
    const stored = await getLibraryProject(list[0].id);
    expect(stored?.primingStripped).toBe(true);
    const shiftSec = samples / sampleRate;
    const words = (stored?.lines[0] as { words: WordTiming[] }).words;
    expect(words[0].begin).toBeCloseTo(1.0 - shiftSec);
    expect(words[1].end).toBeCloseTo(2.0 - shiftSec);
  });
});
