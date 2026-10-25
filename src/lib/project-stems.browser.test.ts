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
    expect(stems?.songHash).toBe("song-hash");
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
    expect(stems?.songHash).toBe("new-song");
    expect(Object.keys(stems?.slots ?? {})).toEqual(["instrumental"]);
  });

  it("deletes one slot and drops the record once both slots are empty", async () => {
    await seedStoredProject("stems-delete");
    await saveProjectStem("stems-delete", "h", importedVocals());
    await deleteProjectStem("stems-delete", "vocals");
    expect(await loadProjectStems("stems-delete")).toBeUndefined();
    expect((await loadProjectIndexEntry("stems-delete"))?.storedStemBytes).toBe(0);
  });

  it("is removed with its project and refuses writes to a deleted project", async () => {
    await seedStoredProject("stems-gone");
    await saveProjectStem("stems-gone", "h", importedVocals());
    await removeProjectData("stems-gone");
    expect(await loadProjectStems("stems-gone")).toBeUndefined();
    await expect(saveProjectStem("stems-gone", "h", importedVocals())).rejects.toBeInstanceOf(ProjectDeletedError);
  });
});
