import { projectStemJobKey } from "@/audio/separation/stem-job-liveness";
import { putStem, stemJobKey } from "@/audio/separation/stem-store";
import { loadProjectStems, saveProjectStem } from "@/lib/project-stems";
import { resolveStems } from "@/stores/stem-sources";
import { createAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject } from "@/test/projects";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

async function importVocals(id: string, songHash: string): Promise<void> {
  await saveProjectStem(id, songHash, {
    slot: "vocals",
    file: createAudioFile("acapella.wav"),
    origin: "imported",
    durationSeconds: 60,
  });
}

async function cacheSeparation(songHash: string): Promise<void> {
  await putStem(songHash, "vocals", "fp32", new Blob([new Uint8Array(10)]));
  await putStem(songHash, "instrumental", "fp32", new Blob([new Uint8Array(20)]));
}

// -- Tests --------------------------------------------------------------------

describe("resolveStems", () => {
  it("uses the project's stems for its song and never fills an empty slot from the cache", async () => {
    await seedStoredProject("resolve-own");
    await importVocals("resolve-own", "song");
    await cacheSeparation("song");
    const resolved = await resolveStems("resolve-own", "song", "fp32");
    expect(resolved.ownedByProject).toBe(true);
    expect(resolved.jobKey).toBe(projectStemJobKey("resolve-own", 1));
    expect(resolved.origins).toEqual({ vocals: "imported" });
    expect(Object.keys(resolved.files)).toEqual(["vocals"]);
  });

  it("falls back to cached separated stems when the project has none", async () => {
    await seedStoredProject("resolve-cache");
    await cacheSeparation("song");
    const resolved = await resolveStems("resolve-cache", "song", "fp32");
    expect(resolved.ownedByProject).toBe(false);
    expect(resolved.jobKey).toBe(stemJobKey("song", "fp32"));
    expect(resolved.origins).toEqual({ vocals: "separated", instrumental: "separated" });
  });

  describe("invariants", () => {
    it("drops stems that belong to a replaced song", async () => {
      await seedStoredProject("resolve-replaced");
      await importVocals("resolve-replaced", "old-song");
      const resolved = await resolveStems("resolve-replaced", "new-song", "fp32");
      expect(resolved.ownedByProject).toBe(false);
      expect(resolved.files).toEqual({});
      expect(await loadProjectStems("resolve-replaced")).toBeUndefined();
    });
  });
});
