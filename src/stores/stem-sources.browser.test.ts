import { projectStemJobKey } from "@/audio/separation/stem-job-liveness";
import { putStem, stemJobKey } from "@/audio/separation/stem-store";
import { loadProjectStems, saveProjectStem } from "@/lib/project-stems";
import { resolveStems, songKeyFor } from "@/stores/stem-sources";
import { createAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject } from "@/test/projects";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

async function importVocals(id: string, songKey: string): Promise<void> {
  await saveProjectStem(id, songKey, {
    slot: "vocals",
    file: createAudioFile("acapella.wav"),
    origin: "imported",
    durationSeconds: 60,
  });
}

async function cacheSeparation(songKey: string): Promise<void> {
  await putStem(songKey, "vocals", "fp32", new Blob([new Uint8Array(10)]));
  await putStem(songKey, "instrumental", "fp32", new Blob([new Uint8Array(20)]));
}

// -- Tests --------------------------------------------------------------------

describe("resolveStems", () => {
  it("uses the project's stems for its song and never fills an empty slot from the cache", async () => {
    await seedStoredProject("resolve-own");
    await importVocals("resolve-own", "song");
    await cacheSeparation("song");
    const resolved = await resolveStems("resolve-own", "song", "song", "fp32");
    expect(resolved.jobKey).toBe(projectStemJobKey("resolve-own", 1));
    expect(Object.keys(resolved.slots)).toEqual(["vocals"]);
    expect(resolved.slots.vocals).toMatchObject({ origin: "imported", details: { name: "acapella.wav" } });
  });

  it("falls back to cached separated stems when the project has none", async () => {
    await seedStoredProject("resolve-cache");
    await cacheSeparation("song");
    const resolved = await resolveStems("resolve-cache", "song", "song", "fp32");
    expect(resolved.jobKey).toBe(stemJobKey("song", "fp32"));
    expect(resolved.slots.vocals?.origin).toBe("separated");
    expect(resolved.slots.instrumental?.origin).toBe("separated");
  });

  it("knows a YouTube song by its video, not by the bytes downloaded this session", () => {
    const source = { type: "youtube", videoId: "abc123", file: createAudioFile("a.opus") } as const;
    expect(songKeyFor(source, "bytes-one")).toBe(songKeyFor(source, "bytes-two"));
    expect(songKeyFor({ type: "file", file: createAudioFile("s.wav") }, "bytes-one")).toBe("bytes-one");
  });

  describe("invariants", () => {
    it("ignores stems saved for another song but never deletes them", async () => {
      await seedStoredProject("resolve-other-song");
      await importVocals("resolve-other-song", "old-song");
      const resolved = await resolveStems("resolve-other-song", "new-song", "new-song", "fp32");
      expect(resolved.slots).toEqual({});
      expect((await loadProjectStems("resolve-other-song"))?.slots.vocals?.origin).toBe("imported");
    });

    it("keys the derived-data job by the vocals stem, so importing an instrumental keeps it", async () => {
      await seedStoredProject("resolve-job");
      await importVocals("resolve-job", "song");
      const before = (await resolveStems("resolve-job", "song", "song", "fp32")).jobKey;
      await saveProjectStem("resolve-job", "song", {
        slot: "instrumental",
        file: createAudioFile("inst.wav"),
        origin: "imported",
        durationSeconds: 60,
      });
      expect((await resolveStems("resolve-job", "song", "song", "fp32")).jobKey).toBe(before);
    });
  });
});
