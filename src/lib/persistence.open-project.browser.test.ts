import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { reconcileLine } from "@/domain/line/model";
import { findOpenProjectId, forgetOpenProjectId } from "@/lib/open-project-session";
import { clearAudioFile, saveAudioFile, saveCurrentProject } from "@/lib/persistence";
import { DB_NAME } from "@/lib/persistence-idb";
import { listProjectIndex } from "@/lib/project-repository";
import { loadProjectForRestore } from "@/lib/project-restore";
import { getOpenProjectId, loadProjectRecord } from "@/lib/project-storage";
import { SAVED_PROJECT_VERSION } from "@/lib/saved-project";
import { createProjectSaveInput } from "@/test/factories";
import { deleteDatabase, openAndCloseAtVersion, seedAudioFile, seedProject } from "@/test/idb";
import { loadOpenProjectAudio, loadOpenProjectRecord } from "@/test/projects";
import { describe, expect, it } from "vitest";

function save(title: string): Promise<void> {
  return saveCurrentProject(
    createProjectSaveInput({
      metadata: { title, artists: [], album: "", duration: 0 },
      lines: [{ id: "L1", text: "hello", agentId: DEFAULT_AGENTS[0].id }],
      audioSource: { kind: "file", name: "a.mp3" },
    }),
  );
}

describe("persistence · open project", () => {
  it("the first save creates one open project, and later saves reuse it", async () => {
    await save("One");
    const id = await getOpenProjectId();
    await save("Two");
    expect(await getOpenProjectId()).toBe(id);
    expect(await listProjectIndex()).toEqual([expect.objectContaining({ id, title: "Two" })]);
    expect((await loadOpenProjectRecord())?.metadata.title).toBe("Two");
  });

  it("audio saves land on the open project", async () => {
    await save("One");
    await saveAudioFile(new File([new Uint8Array(32)], "a.mp3", { type: "audio/mpeg" }));
    expect((await loadOpenProjectAudio())?.size).toBe(32);
    expect((await listProjectIndex())[0].storedAudioBytes).toBe(32);
  });

  describe("edge cases", () => {
    it("reading the open project returns undefined on a fresh install and creates nothing", async () => {
      expect(await loadOpenProjectRecord()).toBeUndefined();
      expect(await getOpenProjectId()).toBeUndefined();
    });

    it("a legacy install loads through the migration", async () => {
      await seedProject({
        version: 1,
        savedAt: 1,
        metadata: { title: "Legacy" },
        lines: [],
        granularity: "word",
        agents: DEFAULT_AGENTS,
      });
      await seedAudioFile({ name: "legacy.mp3", type: "audio/mpeg", data: new Uint8Array(5).buffer });
      forgetOpenProjectId();
      expect((await loadOpenProjectRecord())?.metadata.title).toBe("Legacy");
      expect((await loadOpenProjectAudio())?.name).toBe("legacy.mp3");
    });

    it("a record older than the current version is upgraded on load and written back", async () => {
      await seedProject({
        version: 1,
        savedAt: 1,
        metadata: { title: "Old", artists: [], album: "", duration: 0 },
        granularity: "word",
        agents: DEFAULT_AGENTS,
        lines: [
          reconcileLine({
            id: "L1",
            text: "걸음은 Like a dance",
            agentId: "v1",
            transliteration: {
              language: "ko-Latn",
              text: "geol-eum-eun Like a dance",
              segments: [],
              origin: "google",
              sourceFingerprint: "legacy",
            },
          }),
        ],
      });
      forgetOpenProjectId();
      const id = await findOpenProjectId();
      expect(id).toBeDefined();
      const { project: loaded } = await loadProjectForRestore(id ?? "");
      expect(loaded?.version).toBe(SAVED_PROJECT_VERSION);
      expect(loaded?.lines[0].transliteration?.alignmentStatus).toBe("confirmed");
      expect((await loadProjectRecord(id ?? ""))?.version).toBe(SAVED_PROJECT_VERSION);
    });
  });

  describe("regressions", () => {
    it("regression: an audio save and a project save racing on first boot share one project", async () => {
      await Promise.all([save("Race"), saveAudioFile(new File([new Uint8Array(8)], "r.mp3", { type: "audio/mpeg" }))]);
      const index = await listProjectIndex();
      expect(index).toHaveLength(1);
      expect(index[0].storedAudioBytes).toBe(8);
    });

    it("regression: a database opened at a newer version rejects reads and writes, and recovers once the database is deleted", async () => {
      await openAndCloseAtVersion(DB_NAME, 4);

      await expect(loadOpenProjectRecord()).rejects.toThrow();
      await expect(save("Blocked")).rejects.toThrow();

      await deleteDatabase(DB_NAME);

      await expect(loadOpenProjectRecord()).resolves.toBeUndefined();
      await save("Recovered");
      expect(await listProjectIndex()).toHaveLength(1);
    });

    it("regression: a failed lookup is retried on the next load without a save in between", async () => {
      await openAndCloseAtVersion(DB_NAME, 4);
      await expect(loadOpenProjectRecord()).rejects.toThrow();

      await deleteDatabase(DB_NAME);

      await expect(loadOpenProjectRecord()).resolves.toBeUndefined();
    });
  });

  it("clearAudioFile keeps the record", async () => {
    await save("One");
    await saveAudioFile(new File([new Uint8Array(16)], "a.mp3", { type: "audio/mpeg" }));
    await clearAudioFile();
    expect((await loadOpenProjectRecord())?.metadata.title).toBe("One");
    expect(await loadOpenProjectAudio()).toBeUndefined();
  });
});
