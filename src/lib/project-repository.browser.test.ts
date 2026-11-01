import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { APP_STATE_STORE_NAME, getFromStore } from "@/lib/persistence-idb";
import { deleteProjectAudio, loadProjectAudio, saveProjectAudio } from "@/lib/project-audio";
import {
  clearOpenProjectId,
  createProjectId,
  findProjectByVideoId,
  listProjectIndex,
  loadProjectIndexEntry,
  markProjectOpened,
  removeProjectData,
  saveProjectRecord,
  setOpenProjectId,
  setProjectLastTab,
} from "@/lib/project-repository";
import { OPEN_PROJECT_KEY, getOpenProjectId, loadProjectRecord } from "@/lib/project-storage";
import { ProjectDeletedError, isProjectDeleted } from "@/lib/project-tombstones";
import type { SavedProject } from "@/lib/saved-project";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

function project(overrides: Partial<SavedProject> = {}): SavedProject {
  return {
    version: 1,
    savedAt: 1_758_900_000_000,
    metadata: { title: "Espresso", artists: ["Sabrina Carpenter"], album: "Short n' Sweet", duration: 175 },
    agents: DEFAULT_AGENTS,
    lines: [createLine({ text: "Now he's thinking bout me", begin: 1, end: 3 }), createLine({ text: "Every night" })],
    granularity: "word",
    audioSource: { kind: "file", name: "espresso.flac" },
    ...overrides,
  };
}

function expectProjectDeleted(error: unknown): void {
  expect(error).toBeInstanceOf(ProjectDeletedError);
}

function audioBytes(length: number): Uint8Array {
  const data = new Uint8Array(length);
  for (let i = 0; i < length; i++) data[i] = (i * 7 + 1) % 256;
  return data;
}

function audioFile(bytes: number, name = "espresso.flac"): File {
  return new File([audioBytes(bytes)], name, { type: "audio/flac" });
}

describe("project-repository", () => {
  it("createProjectId returns distinct URL-safe ids", () => {
    const ids = new Set(Array.from({ length: 50 }, createProjectId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("saves a record and writes its index entry in the same call", async () => {
    await saveProjectRecord("p1", project());
    expect((await loadProjectRecord("p1"))?.metadata.title).toBe("Espresso");
    const [entry] = await listProjectIndex();
    expect(entry).toMatchObject({
      id: "p1",
      title: "Espresso",
      lineCount: 2,
      syncedLineCount: 1,
      audioKind: "file",
      storedAudioBytes: 0,
    });
  });

  it("saving audio records its size in the index, and later record saves keep it", async () => {
    await saveProjectRecord("p1", project());
    await saveProjectAudio("p1", audioFile(2048));
    await saveProjectRecord(
      "p1",
      project({ metadata: { title: "Espresso (Live)", artists: [], album: "", duration: 0 } }),
    );
    const [entry] = await listProjectIndex();
    expect(entry.title).toBe("Espresso (Live)");
    expect(entry.storedAudioBytes).toBe(2048);
  });

  it("round-trips audio as a File with its name, type and exact bytes", async () => {
    await saveProjectAudio("p1", audioFile(16));
    const file = await loadProjectAudio("p1");
    expect(file?.name).toBe("espresso.flac");
    expect(file?.type).toBe("audio/flac");
    expect(file?.size).toBe(16);
    const bytes = file ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array();
    expect(bytes).toEqual(audioBytes(16));
  });

  it("deleteProjectAudio removes the audio and sets the index size to zero", async () => {
    await saveProjectRecord("p1", project());
    await saveProjectAudio("p1", audioFile(64));
    await deleteProjectAudio("p1");
    expect(await loadProjectAudio("p1")).toBeUndefined();
    expect((await listProjectIndex())[0].storedAudioBytes).toBe(0);
  });

  it("removeProjectData removes the record, the index entry and the audio", async () => {
    await saveProjectRecord("p1", project());
    await saveProjectAudio("p1", audioFile(8));
    await removeProjectData("p1");
    expect(await loadProjectRecord("p1")).toBeUndefined();
    expect(await loadProjectAudio("p1")).toBeUndefined();
    expect(await listProjectIndex()).toEqual([]);
  });

  it("stores, reads and clears the open project pointer", async () => {
    expect(await getOpenProjectId()).toBeUndefined();
    await setOpenProjectId("p9");
    expect(await getOpenProjectId()).toBe("p9");
    await clearOpenProjectId();
    expect(await getOpenProjectId()).toBeUndefined();
  });

  describe("carried index fields", () => {
    it("a new project's entry is opened when it is saved", async () => {
      await saveProjectRecord("p1", project({ savedAt: 500 }));
      expect((await loadProjectIndexEntry("p1"))?.openedAt).toBe(500);
    });

    it("markProjectOpened and setProjectLastTab survive later record saves", async () => {
      await saveProjectRecord("p1", project({ savedAt: 1 }));
      await markProjectOpened("p1", 900);
      await setProjectLastTab("p1", "timeline");
      await saveProjectRecord("p1", project({ savedAt: 2 }));
      const entry = await loadProjectIndexEntry("p1");
      expect(entry).toMatchObject({ openedAt: 900, lastTab: "timeline", updatedAt: 2 });
    });

    it("markProjectOpened and setProjectLastTab do not change updatedAt", async () => {
      await saveProjectRecord("p1", project({ savedAt: 7 }));
      await markProjectOpened("p1", 99);
      await setProjectLastTab("p1", "edit");
      expect((await loadProjectIndexEntry("p1"))?.updatedAt).toBe(7);
    });

    it("patches on a project with no entry write nothing", async () => {
      await markProjectOpened("ghost", 1);
      await setProjectLastTab("ghost", "sync");
      expect(await listProjectIndex()).toEqual([]);
    });
  });

  describe("findProjectByVideoId", () => {
    it("finds the project whose audio is that video", async () => {
      await saveProjectRecord("yt", project({ audioSource: { kind: "youtube", videoId: "dX3k_QDnzHE" } }));
      await saveProjectRecord("file", project());
      expect((await findProjectByVideoId("dX3k_QDnzHE"))?.id).toBe("yt");
    });

    it("returns undefined when no project has the video", async () => {
      await saveProjectRecord("file", project());
      expect(await findProjectByVideoId("dX3k_QDnzHE")).toBeUndefined();
    });

    it("prefers the most recently edited project when two share a video", async () => {
      const audioSource = { kind: "youtube" as const, videoId: "dX3k_QDnzHE" };
      await saveProjectRecord("a-older", project({ audioSource, savedAt: 10 }));
      await saveProjectRecord("b-newer", project({ audioSource, savedAt: 20 }));
      expect((await findProjectByVideoId("dX3k_QDnzHE"))?.id).toBe("b-newer");
    });
  });

  describe("tombstones", () => {
    it("a record save after removal writes nothing", async () => {
      await saveProjectRecord("p1", project());
      await removeProjectData("p1");
      await expect(saveProjectRecord("p1", project())).rejects.toBeInstanceOf(ProjectDeletedError);
      expect(await loadProjectRecord("p1")).toBeUndefined();
      expect(await listProjectIndex()).toEqual([]);
    });

    it("an audio save after removal writes nothing", async () => {
      await saveProjectRecord("p1", project());
      await removeProjectData("p1");
      await expect(saveProjectAudio("p1", audioFile(64))).rejects.toBeInstanceOf(ProjectDeletedError);
      expect(await loadProjectAudio("p1")).toBeUndefined();
    });

    it("marks the id as deleted and leaves other projects writable", async () => {
      await saveProjectRecord("p1", project());
      await removeProjectData("p1");
      expect(await isProjectDeleted("p1")).toBe(true);
      expect(await isProjectDeleted("p2")).toBe(false);
      await saveProjectRecord("p2", project());
      expect((await listProjectIndex()).map((entry) => entry.id)).toEqual(["p2"]);
    });

    it("clears the open project pointer when it points at the removed project", async () => {
      await saveProjectRecord("p1", project());
      await setOpenProjectId("p1");
      await removeProjectData("p1");
      expect(await getOpenProjectId()).toBeUndefined();
    });

    it("keeps the open project pointer when another project is removed", async () => {
      await saveProjectRecord("p1", project());
      await saveProjectRecord("p2", project());
      await setOpenProjectId("p1");
      await removeProjectData("p2");
      expect(await getOpenProjectId()).toBe("p1");
    });

    it("never points the open project pointer at a removed project", async () => {
      await saveProjectRecord("p1", project());
      await setOpenProjectId("p1");
      await removeProjectData("p2");
      await expect(setOpenProjectId("p2")).rejects.toBeInstanceOf(ProjectDeletedError);
      expect(await getFromStore(APP_STATE_STORE_NAME, OPEN_PROJECT_KEY)).toBe("p1");
    });
  });

  describe("concurrency", () => {
    it("concurrent saves for two projects keep one entry each", async () => {
      await Promise.all([
        saveProjectRecord("p1", project({ savedAt: 1 })),
        saveProjectRecord("p2", project({ savedAt: 2 })),
        saveProjectAudio("p1", audioFile(32)),
        saveProjectAudio("p2", audioFile(48)),
      ]);
      const entries = (await listProjectIndex()).toSorted((a, b) => a.id.localeCompare(b.id));
      expect(entries.map((entry) => [entry.id, entry.storedAudioBytes])).toEqual([
        ["p1", 32],
        ["p2", 48],
      ]);
    });

    it("removing one project while the other saves leaves the other intact", async () => {
      await saveProjectRecord("p1", project());
      await Promise.all([removeProjectData("p1"), saveProjectRecord("p2", project())]);
      expect((await listProjectIndex()).map((entry) => entry.id)).toEqual(["p2"]);
    });
  });

  describe("regressions", () => {
    it("regression: a concurrent record save and audio save both land in the same index entry", async () => {
      await Promise.all([saveProjectRecord("p1", project()), saveProjectAudio("p1", audioFile(256))]);
      expect((await listProjectIndex())[0].storedAudioBytes).toBe(256);
    });

    it("regression: a record save racing a removal never resurrects the project", async () => {
      await saveProjectRecord("p1", project());
      await Promise.all([removeProjectData("p1"), saveProjectRecord("p1", project()).catch(expectProjectDeleted)]);
      expect(await loadProjectRecord("p1")).toBeUndefined();
      expect(await listProjectIndex()).toEqual([]);
    });

    it("regression: an audio save still reading its file when the project is removed writes nothing", async () => {
      await saveProjectRecord("p1", project());
      const pending = saveProjectAudio("p1", audioFile(1_000_000));
      await removeProjectData("p1");
      await pending.catch(expectProjectDeleted);
      expect(await loadProjectAudio("p1")).toBeUndefined();
      expect(await listProjectIndex()).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("audio saved before the first record still shows its size in the index", async () => {
      await saveProjectAudio("p1", audioFile(512));
      await saveProjectRecord("p1", project());
      expect((await listProjectIndex())[0].storedAudioBytes).toBe(512);
    });

    it("saving audio for a project with no record does not create an index entry", async () => {
      await saveProjectAudio("p1", audioFile(512));
      expect(await listProjectIndex()).toEqual([]);
    });

    it("loading a missing record or audio returns undefined", async () => {
      expect(await loadProjectRecord("missing")).toBeUndefined();
      expect(await loadProjectAudio("missing")).toBeUndefined();
    });
  });

  describe("invariants", () => {
    it("keeps one index entry per project across many saves", async () => {
      for (let i = 0; i < 5; i++) await saveProjectRecord("p1", project({ savedAt: i }));
      await saveProjectRecord("p2", project());
      expect((await listProjectIndex()).map((entry) => entry.id).toSorted()).toEqual(["p1", "p2"]);
    });

    it("the index updatedAt follows the record's savedAt", async () => {
      await saveProjectRecord("p1", project({ savedAt: 42 }));
      expect((await listProjectIndex())[0].updatedAt).toBe(42);
    });
  });
});
