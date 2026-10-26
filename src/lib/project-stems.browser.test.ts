import { duplicateProject } from "@/lib/project-library-actions";
import { loadProjectIndexEntry, removeProjectData } from "@/lib/project-repository";
import { deleteProjectStem, loadProjectStems, saveProjectStem } from "@/lib/project-stems";
import { ProjectDeletedError } from "@/lib/project-tombstones";
import { createAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject } from "@/test/projects";
import { describe, expect, it } from "vitest";

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
});
