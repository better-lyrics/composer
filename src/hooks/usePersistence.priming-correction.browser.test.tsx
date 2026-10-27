import { detectedGrid } from "@/domain/tempo/beat-grid";
import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import type { WordTiming } from "@/domain/word/timing";
import { saveAudioFile } from "@/lib/persistence";
import { PROJECT_STEMS_STORE_NAME } from "@/lib/persistence-idb";
import { loadProjectStems, saveProjectStem } from "@/lib/project-stems";
import { getOpenProjectId } from "@/lib/project-storage";
import { createAudioFile, createMp3File } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { croppedMp3StemWrite, saveStemFromOldBuild } from "@/test/legacy-stems";
import { loadOpenProjectForRestore, seedSavedProject } from "@/test/priming-projects";
import { describe, expect, it, vi } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("loadProjectForRestore · corrected MP3 decode", () => {
  const P = 1104 / 44_100;

  async function seedTimedAgainstDoubleCrop(): Promise<void> {
    await saveAudioFile(createMp3File());
    await seedSavedProject({
      primingStripped: true,
      primingCorrected: false,
      lines: [
        {
          id: "L1",
          text: "hello",
          agentId: DEFAULT_AGENTS[0].id,
          words: [{ text: "hello", begin: 1.0, end: 1.5 }],
          backgroundText: "oh",
          backgroundWords: [{ text: "oh", begin: 1.1, end: 1.4 }],
        },
        { id: "L2", text: "line", agentId: DEFAULT_AGENTS[0].id, begin: 3, end: 4 },
      ],
      customSnapPoints: [{ id: "m1", time: 5 }],
      beatGrid: detectedGrid({ beats: [1, 1.5, 2, 2.5], downbeats: [1] }),
    });
  }

  function stem(slot: "vocals" | "instrumental", origin: "imported" | "separated", name = `${slot}.wav`) {
    return { slot, file: createAudioFile(name), origin, durationSeconds: 1 } as const;
  }

  it("moves every saved time later by the priming and sets the flag", async () => {
    await seedTimedAgainstDoubleCrop();

    const migrated = await loadOpenProjectForRestore();

    const first = migrated!.lines[0] as { words: WordTiming[]; backgroundWords: WordTiming[] };
    const second = migrated!.lines[1] as { begin: number; end: number };
    expect(first.words[0].begin).toBeCloseTo(1.0 + P, 9);
    expect(first.backgroundWords[0].begin).toBeCloseTo(1.1 + P, 9);
    expect(second.begin).toBeCloseTo(3 + P, 9);
    expect((migrated!.customSnapPoints?.[0] as { time: number }).time).toBeCloseTo(5 + P, 9);
    expect((migrated!.beatGrid as { beats: number[] }).beats[0]).toBeCloseTo(1 + P, 9);
    expect(migrated).toMatchObject({ primingStripped: true, primingCorrected: true });
  });

  it("shifts once: a second load leaves the saved times alone", async () => {
    await seedTimedAgainstDoubleCrop();
    const first = await loadOpenProjectForRestore();
    const second = await loadOpenProjectForRestore();
    expect(second!.lines).toEqual(first!.lines);
    expect(second!.beatGrid).toEqual(first!.beatGrid);
  });

  it("does not shift audio without a LAME tag but still sets the flag", async () => {
    await saveAudioFile(createAudioFile());
    await seedSavedProject({ primingStripped: true, primingCorrected: false });
    const loaded = await loadOpenProjectForRestore();
    expect((loaded!.lines[0] as { words: WordTiming[] }).words[0].begin).toBeCloseTo(1.0, 9);
    expect(loaded!.primingCorrected).toBe(true);
  });

  it("drops the project's separated stems and keeps imported ones", async () => {
    await seedTimedAgainstDoubleCrop();
    const id = (await getOpenProjectId())!;
    await saveProjectStem(id, "song", stem("vocals", "imported"));
    await saveStemFromOldBuild(id, "song", stem("instrumental", "separated"));

    await loadOpenProjectForRestore();

    const stems = await loadProjectStems(id);
    expect(stems?.slots.vocals?.origin).toBe("imported");
    expect(stems?.slots.instrumental).toBeUndefined();
  });

  it("pads an old imported mp3 stem once by its measured crop and leaves an imported wav stem alone", async () => {
    await seedTimedAgainstDoubleCrop();
    const id = (await getOpenProjectId())!;
    await saveStemFromOldBuild(id, "song", croppedMp3StemWrite("vocals"));
    await saveStemFromOldBuild(id, "song", stem("instrumental", "imported", "inst.wav"));
    const before = await loadProjectStems(id);

    await loadOpenProjectForRestore();
    const padded = await loadProjectStems(id);
    await loadOpenProjectForRestore();

    expect(padded?.slots.vocals?.data.byteLength).toBe((before?.slots.vocals?.data.byteLength ?? 0) + 1104 * 2);
    expect(padded?.slots.instrumental).toEqual(before?.slots.instrumental);
    expect(await loadProjectStems(id)).toEqual(padded);
  });

  it("regression: stems saved by this build are neither dropped nor padded", async () => {
    await seedTimedAgainstDoubleCrop();
    const id = (await getOpenProjectId())!;
    await saveProjectStem(id, "song", stem("vocals", "imported", "acapella.mp3"));
    await saveProjectStem(id, "song", stem("instrumental", "separated"));
    const before = await loadProjectStems(id);

    await loadOpenProjectForRestore();

    expect(await loadProjectStems(id)).toEqual(before);
  });

  it("regression: pads an old cropped mp3 stem even when the main recording is a WAV", async () => {
    await saveAudioFile(createAudioFile());
    await seedSavedProject({ primingStripped: true, primingCorrected: false });
    const id = (await getOpenProjectId())!;
    await saveStemFromOldBuild(id, "song", croppedMp3StemWrite("vocals"));
    const before = await loadProjectStems(id);

    await loadOpenProjectForRestore();

    const after = await loadProjectStems(id);
    expect(after?.slots.vocals?.data.byteLength).toBe((before?.slots.vocals?.data.byteLength ?? 0) + 1104 * 2);
  });

  it("opens a corrected project with nothing to repair without decoding or writing stems", async () => {
    await seedTimedAgainstDoubleCrop();
    await loadOpenProjectForRestore();
    const decode = vi.spyOn(BaseAudioContext.prototype, "decodeAudioData");
    const put = vi.spyOn(IDBObjectStore.prototype, "put");

    await loadOpenProjectForRestore();

    expect(decode).not.toHaveBeenCalled();
    expect(put.mock.contexts.some((store) => (store as IDBObjectStore).name === PROJECT_STEMS_STORE_NAME)).toBe(false);
    decode.mockRestore();
    put.mockRestore();
  });

  it("regression: a failing stem write still opens the project and shifts its times once", async () => {
    allowConsole(/\[PrimingMigration\] could not correct the project's stems/);
    await seedTimedAgainstDoubleCrop();
    const id = (await getOpenProjectId())!;
    await saveStemFromOldBuild(id, "song", stem("instrumental", "separated"));
    const put = IDBObjectStore.prototype.put;
    const failStemWrites = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      const request = put.apply(this, args);
      const transaction = this.transaction;
      if (this.name === PROJECT_STEMS_STORE_NAME) queueMicrotask(() => transaction.abort());
      return request;
    });

    const first = await loadOpenProjectForRestore();
    failStemWrites.mockRestore();
    const second = await loadOpenProjectForRestore();

    expect((await loadProjectStems(id))?.slots.instrumental).toBeUndefined();

    expect((first!.lines[0] as { words: WordTiming[] }).words[0].begin).toBeCloseTo(1.0 + P, 9);
    expect(first!.primingCorrected).toBe(true);
    expect(second!.lines).toEqual(first!.lines);
  });

  it("regression: audio with a LAME tag that cannot decode still opens and keeps its flags", async () => {
    allowConsole(/\[PrimingMigration\] could not decode the project audio/);
    const bytes = new Uint8Array(await createMp3File().arrayBuffer()).slice(0, 300);
    await saveAudioFile(new File([bytes], "silence.mp3", { type: "audio/mpeg" }));
    await seedSavedProject({ primingStripped: true, primingCorrected: false });
    const loaded = await loadOpenProjectForRestore();
    expect(loaded!.primingCorrected).toBe(false);
    expect((loaded!.lines[0] as { words: WordTiming[] }).words[0].begin).toBeCloseTo(1.0, 9);
  });
});
