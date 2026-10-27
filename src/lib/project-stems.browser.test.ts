import { PROJECT_STEMS_STORE_NAME } from "@/lib/persistence-idb";
import type { SavedProjectStem } from "@/domain/stems/saved-stems";
import { duplicateProject } from "@/lib/project-library-actions";
import { loadProjectIndexEntry, removeProjectData } from "@/lib/project-repository";
import {
  deleteProjectStem,
  dropSeparatedProjectStems,
  loadProjectStems,
  padImportedMp3Stems,
  saveProjectStem,
} from "@/lib/project-stems";
import { ProjectDeletedError } from "@/lib/project-tombstones";
import { createAudioFile } from "@/test/audio-fixtures";
import { croppedMp3StemWrite, saveStemFromOldBuild } from "@/test/legacy-stems";
import { seedStoredProject } from "@/test/projects";
import { describe, expect, it, vi } from "vitest";

// -- Helpers ------------------------------------------------------------------

function importedVocals(name = "acapella.wav") {
  return { slot: "vocals", file: createAudioFile(name), origin: "imported", durationSeconds: 60 } as const;
}

// -- Tests --------------------------------------------------------------------

describe("project stems", () => {
  it("saves a slot with its origin and counts its bytes on the index entry", async () => {
    await seedStoredProject("stems-save");
    const write = importedVocals();
    await saveProjectStem("stems-save", "song-hash", write);
    const stems = await loadProjectStems("stems-save");
    expect(stems?.songKey).toBe("song-hash");
    expect(stems?.slots.vocals).toMatchObject({ origin: "imported", name: "acapella.wav", durationSeconds: 60 });
    expect(stems?.slots.instrumental).toBeUndefined();
    expect((await loadProjectIndexEntry("stems-save"))?.storedStemBytes).toBe(write.file.size);
  });

  it("keeps the other slot and raises the revision on every write", async () => {
    await seedStoredProject("stems-both");
    await saveProjectStem("stems-both", "h", importedVocals());
    const first = (await loadProjectStems("stems-both"))?.revision ?? 0;
    await saveProjectStem("stems-both", "h", {
      slot: "instrumental",
      file: createAudioFile("inst.wav"),
      origin: "separated",
      durationSeconds: 60,
    });
    const stems = await loadProjectStems("stems-both");
    expect(stems?.slots.vocals?.origin).toBe("imported");
    expect(stems?.slots.instrumental?.origin).toBe("separated");
    expect(stems?.revision).toBeGreaterThan(first);
  });

  it("drops the slots of another song when a stem for a new song is saved", async () => {
    await seedStoredProject("stems-song");
    await saveProjectStem("stems-song", "old-song", importedVocals());
    await saveProjectStem("stems-song", "new-song", { ...importedVocals(), slot: "instrumental" });
    const stems = await loadProjectStems("stems-song");
    expect(stems?.songKey).toBe("new-song");
    expect(Object.keys(stems?.slots ?? {})).toEqual(["instrumental"]);
  });

  it("deletes a slot and counts no bytes once both slots are empty", async () => {
    await seedStoredProject("stems-delete");
    await saveProjectStem("stems-delete", "h", importedVocals());
    await deleteProjectStem("stems-delete", "vocals");
    expect((await loadProjectStems("stems-delete"))?.slots).toEqual({});
    expect((await loadProjectIndexEntry("stems-delete"))?.storedStemBytes).toBe(0);
  });

  it("is removed with its project and refuses writes to a deleted project", async () => {
    await seedStoredProject("stems-gone");
    await saveProjectStem("stems-gone", "h", importedVocals());
    await removeProjectData("stems-gone");
    expect(await loadProjectStems("stems-gone")).toBeUndefined();
    await expect(saveProjectStem("stems-gone", "h", importedVocals())).rejects.toBeInstanceOf(ProjectDeletedError);
  });

  it("is copied to a duplicate of its project", async () => {
    await seedStoredProject("stems-original");
    const write = importedVocals();
    await saveProjectStem("stems-original", "h", write);
    const copyId = await duplicateProject("stems-original");
    const copy = await loadProjectStems(copyId);
    expect(copy?.slots.vocals).toMatchObject({ origin: "imported", name: "acapella.wav" });
    expect(copy?.slots.vocals?.data.byteLength).toBe(write.file.size);
    expect((await loadProjectIndexEntry(copyId))?.storedStemBytes).toBe(write.file.size);
  });

  it("counts stems saved before the project's first record", async () => {
    const write = importedVocals();
    await saveProjectStem("stems-early", "h", write);
    await seedStoredProject("stems-early");
    expect((await loadProjectIndexEntry("stems-early"))?.storedStemBytes).toBe(write.file.size);
  });

  it("never lets a separated stem replace an imported one", async () => {
    await seedStoredProject("stems-guard");
    const write = importedVocals();
    await saveProjectStem("stems-guard", "h", write);
    await saveProjectStem("stems-guard", "h", { ...importedVocals("model.wav"), origin: "separated" });
    const stems = await loadProjectStems("stems-guard");
    expect(stems?.slots.vocals).toMatchObject({ origin: "imported", name: "acapella.wav" });
  });

  it("stamps each slot with the revision it was written at, so an untouched slot keeps its revision", async () => {
    await seedStoredProject("stems-revision");
    await saveProjectStem("stems-revision", "h", importedVocals());
    await saveProjectStem("stems-revision", "h", { ...importedVocals("inst.wav"), slot: "instrumental" });
    const stems = await loadProjectStems("stems-revision");
    expect(stems?.slots.vocals?.revision).toBe(1);
    expect(stems?.slots.instrumental?.revision).toBe(2);
  });

  it("regression: never reuses a revision after every stem was removed", async () => {
    await seedStoredProject("stems-reuse");
    await saveProjectStem("stems-reuse", "h", importedVocals());
    await deleteProjectStem("stems-reuse", "vocals");
    await saveProjectStem("stems-reuse", "h", importedVocals("other.wav"));
    expect((await loadProjectStems("stems-reuse"))?.slots.vocals?.revision).toBe(3);
  });

  it("leaves the record untouched when the write is no longer wanted at commit time", async () => {
    await seedStoredProject("stems-unwanted");
    await saveProjectStem("stems-unwanted", "h", importedVocals());
    await saveProjectStem("stems-unwanted", "h", { ...importedVocals("stale.wav"), shouldWrite: () => false });
    expect((await loadProjectStems("stems-unwanted"))?.slots.vocals?.name).toBe("acapella.wav");
  });

  it("drops separated slots, keeps imported ones and raises the revision", async () => {
    await seedStoredProject("stems-drop");
    await saveProjectStem("stems-drop", "h", importedVocals());
    await saveStemFromOldBuild("stems-drop", "h", {
      slot: "instrumental",
      file: createAudioFile("inst.wav"),
      origin: "separated",
      durationSeconds: 60,
    });
    const before = await loadProjectStems("stems-drop");

    expect(await dropSeparatedProjectStems("stems-drop")).toBe(true);

    const after = await loadProjectStems("stems-drop");
    expect(after?.slots.vocals?.origin).toBe("imported");
    expect(after?.slots.instrumental).toBeUndefined();
    expect(after?.revision).toBe((before?.revision ?? 0) + 1);
    expect((await loadProjectIndexEntry("stems-drop"))?.storedStemBytes).toBe(after?.slots.vocals?.data.byteLength);
  });

  it("leaves a project without separated stems untouched", async () => {
    await seedStoredProject("stems-keep");
    await saveProjectStem("stems-keep", "h", importedVocals());
    const before = await loadProjectStems("stems-keep");
    expect(await dropSeparatedProjectStems("stems-keep")).toBe(false);
    expect(await loadProjectStems("stems-keep")).toEqual(before);
  });

  async function padOldStem(id: string, write: ReturnType<typeof croppedMp3StemWrite>) {
    await seedStoredProject(id);
    await saveStemFromOldBuild(id, "h", write);
    const before = await loadProjectStems(id);
    const padded = await padImportedMp3Stems(id);
    return { before, after: await loadProjectStems(id), padded };
  }

  function silentFramesAdded(before: SavedProjectStem | undefined, after: SavedProjectStem | undefined): number {
    return ((after?.data.byteLength ?? 0) - (before?.data.byteLength ?? 0)) / 2;
  }

  it("pads an old imported mp3 stem by its measured crop and leaves other stems alone", async () => {
    await seedStoredProject("stems-pad");
    await saveStemFromOldBuild("stems-pad", "h", croppedMp3StemWrite("vocals"));
    await saveStemFromOldBuild("stems-pad", "h", { ...importedVocals("inst.wav"), slot: "instrumental" });
    const before = await loadProjectStems("stems-pad");

    expect(await padImportedMp3Stems("stems-pad")).toBe(true);

    const after = await loadProjectStems("stems-pad");
    expect(silentFramesAdded(before?.slots.vocals, after?.slots.vocals)).toBe(1104);
    expect(
      new Int16Array(after?.slots.vocals?.data ?? new ArrayBuffer(0), 44, 1104).every((sample) => sample === 0),
    ).toBe(true);
    expect(after?.slots.vocals?.durationSeconds).toBe(before?.slots.vocals?.durationSeconds);
    expect(after?.slots.vocals?.revision).toBe((before?.revision ?? 0) + 1);
    expect(after?.slots.instrumental).toEqual(before?.slots.instrumental);
    expect((await loadProjectIndexEntry("stems-pad"))?.storedStemBytes).toBe(
      (after?.slots.vocals?.data.byteLength ?? 0) + (after?.slots.instrumental?.data.byteLength ?? 0),
    );
  });

  it("pads a 48 kHz stem by its measured crop", async () => {
    const { before, after } = await padOldStem(
      "stems-pad-48k",
      croppedMp3StemWrite("vocals", { sampleRate: 48_000, frames: 4800 }),
    );
    expect(silentFramesAdded(before?.slots.vocals, after?.slots.vocals)).toBe(1104);
  });

  it("pads a 44.1 kHz mp3 decoded at 48 kHz by its measured crop", async () => {
    const { before, after } = await padOldStem(
      "stems-pad-resampled",
      croppedMp3StemWrite("vocals", { sampleRate: 48_000, frames: 4800, croppedFrames: 1202 }),
    );
    expect(silentFramesAdded(before?.slots.vocals, after?.slots.vocals)).toBe(1202);
  });

  describe("stems without evidence of the old crop", () => {
    it("skips an untagged mp3 stem the old build never cropped", async () => {
      const { before, after, padded } = await padOldStem(
        "stems-untagged",
        croppedMp3StemWrite("vocals", { croppedFrames: 0 }),
      );
      expect(padded).toBe(false);
      expect(after).toEqual(before);
    });

    it("skips a stem whose measured crop is far from the default priming", async () => {
      const { before, after, padded } = await padOldStem(
        "stems-far",
        croppedMp3StemWrite("vocals", { croppedFrames: 3000 }),
      );
      expect(padded).toBe(false);
      expect(after).toEqual(before);
    });

    it("skips an imported wav stem", async () => {
      await seedStoredProject("stems-nopad");
      await saveStemFromOldBuild("stems-nopad", "h", importedVocals());
      const before = await loadProjectStems("stems-nopad");
      expect(await padImportedMp3Stems("stems-nopad")).toBe(false);
      expect(await loadProjectStems("stems-nopad")).toEqual(before);
    });
  });

  it("regression: pads an imported mp3 stem only once when the migration runs again", async () => {
    const { after: once } = await padOldStem("stems-pad-twice", croppedMp3StemWrite("vocals"));

    expect(await padImportedMp3Stems("stems-pad-twice")).toBe(false);

    expect(await loadProjectStems("stems-pad-twice")).toEqual(once);
  });

  it("writes no stem record when there is nothing to drop", async () => {
    await seedStoredProject("stems-nothing");
    await saveProjectStem("stems-nothing", "h", importedVocals());
    const put = vi.spyOn(IDBObjectStore.prototype, "put");

    await dropSeparatedProjectStems("stems-nothing");

    expect(put.mock.contexts.some((store) => (store as IDBObjectStore).name === PROJECT_STEMS_STORE_NAME)).toBe(false);
    put.mockRestore();
  });
});
