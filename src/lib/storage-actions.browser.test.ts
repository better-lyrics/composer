import {
  beginLoadingStemJob,
  endLoadingStemJob,
  listStemJobs,
  putStem,
  stemJobKey,
} from "@/audio/separation/stem-store";
import { restoreOpenProject } from "@/lib/open-project";
import { adoptOpenProjectId, beginOpeningProject, endOpeningProject } from "@/lib/open-project-session";
import { schedulePendingDeletion } from "@/lib/pending-deletions";
import { debouncedSave } from "@/lib/persistence-debounce";
import { loadProjectAudio } from "@/lib/project-audio";
import { loadProjectIndexEntry, removeProjectData } from "@/lib/project-repository";
import { currentSaveInput } from "@/lib/project-snapshot";
import { backUpAllProjects, clearVocalStems, clearYouTubeAudio, removeAudioFromProject } from "@/lib/storage-actions";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { captureDownloads } from "@/test/downloads";
import { seedStoredProject, songTitled } from "@/test/projects";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

async function seed(id: string, kind: "file" | "youtube"): Promise<void> {
  await seedStoredProject(id, {
    project: { audioSource: kind === "file" ? { kind, name: `${id}.wav` } : { kind, videoId: `v-${id}` } },
    audio: createAudioFile(`${id}.${kind === "file" ? "wav" : "opus"}`),
  });
}

// -- Tests --------------------------------------------------------------------

describe("removeAudioFromProject", () => {
  it("removes a closed project's local file and keeps it a local-file project with missing audio", async () => {
    await seed("a", "file");
    await removeAudioFromProject("a");
    expect(await loadProjectAudio("a")).toBeUndefined();
    expect(await loadProjectIndexEntry("a")).toMatchObject({
      audioKind: "file",
      storedAudioBytes: 0,
      audioFileName: "a.wav",
    });
  });

  it("removes a closed project's cached YouTube audio", async () => {
    await seed("y", "youtube");
    await removeAudioFromProject("y");
    expect(await loadProjectAudio("y")).toBeUndefined();
  });

  describe("error paths", () => {
    it("refuses the open project and keeps its audio", async () => {
      await seed("a", "file");
      adoptOpenProjectId("a");
      await expect(removeAudioFromProject("a")).rejects.toThrow("close it to remove its audio");
      expect(await loadProjectAudio("a")).toBeDefined();
    });

    it("keeps the audio of a project that starts opening before the removal runs", async () => {
      await seed("a", "file");
      const removal = removeAudioFromProject("a");
      beginOpeningProject("a");
      try {
        await expect(removal).rejects.toThrow("close it to remove its audio");
      } finally {
        endOpeningProject("a");
      }
      expect(await loadProjectAudio("a")).toBeDefined();
    });
  });
});

describe("clearYouTubeAudio", () => {
  it("clears cached YouTube audio but keeps the open project's and every local file", async () => {
    await seed("y1", "youtube");
    await seed("open", "youtube");
    await seed("f", "file");
    adoptOpenProjectId("open");
    expect((await clearYouTubeAudio()).projects).toBe(1);
    expect(await loadProjectAudio("y1")).toBeUndefined();
    expect(await loadProjectAudio("open")).toBeDefined();
    expect(await loadProjectAudio("f")).toBeDefined();
  });

  it("keeps the cached audio of a project that starts opening before the clear runs", async () => {
    await seed("y1", "youtube");
    await seed("opening", "youtube");
    const clearing = clearYouTubeAudio();
    beginOpeningProject("opening");
    try {
      expect((await clearing).projects).toBe(1);
    } finally {
      endOpeningProject("opening");
    }
    expect(await loadProjectAudio("y1")).toBeUndefined();
    expect(await loadProjectAudio("opening")).toBeDefined();
  });
});

describe("clearVocalStems", () => {
  it("clears every stem job but the open project's", async () => {
    await putStem("mine", "vocals", "fp32", new Blob([new Uint8Array(4)]));
    await putStem("other", "vocals", "fp32", new Blob([new Uint8Array(4)]));
    useSeparationStore.setState({ jobKey: stemJobKey("mine", "fp32") });
    expect((await clearVocalStems()).jobs).toBe(1);
    expect((await listStemJobs()).map((job) => job.jobKey)).toEqual([stemJobKey("mine", "fp32")]);
  });

  it("keeps a stem job that starts loading before the clear runs", async () => {
    await putStem("loading", "vocals", "fp32", new Blob([new Uint8Array(4)]));
    await putStem("other", "vocals", "fp32", new Blob([new Uint8Array(4)]));
    const loadingKey = stemJobKey("loading", "fp32");
    const clearing = clearVocalStems();
    beginLoadingStemJob(loadingKey);
    try {
      expect((await clearing).jobs).toBe(1);
    } finally {
      endLoadingStemJob(loadingKey);
    }
    expect((await listStemJobs()).map((job) => job.jobKey)).toEqual([loadingKey]);
  });

  describe("edge cases", () => {
    it("clears everything when no project is open", async () => {
      await putStem("other", "vocals", "fp32", new Blob([new Uint8Array(4)]));
      expect((await clearVocalStems()).jobs).toBe(1);
    });
  });
});

describe("backUpAllProjects", () => {
  it("downloads one bundle with every project", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha") });
    await seedStoredProject("b", { project: songTitled("Bravo") });
    const downloads = captureDownloads();
    const bundle = await backUpAllProjects();
    await expect.poll(() => downloads.names().length).toBe(1);
    downloads.stop();
    expect(downloads.names()[0]).toMatch(/^composer-backup-\d{4}-\d{2}-\d{2}\.ttml-projects\.json$/);
    expect(bundle?.projects.map((project) => project.metadata.title).toSorted()).toEqual(["Alpha", "Bravo"]);
  });

  it("includes the open project's edit that was still waiting to save", async () => {
    useSettingsStore.setState({ autoSaveDelay: 60_000 });
    await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
    await restoreOpenProject();
    useProjectStore.getState().setMetadata({ title: "Alpha edited" });
    debouncedSave(currentSaveInput());
    const bundle = await backUpAllProjects();
    expect(bundle?.projects.map((project) => project.metadata.title)).toEqual(["Alpha edited"]);
  });

  it("leaves out projects waiting to be deleted", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha") });
    await seedStoredProject("b", { project: songTitled("Bravo") });
    const deletion = schedulePendingDeletion(["b"]);
    const bundle = await backUpAllProjects();
    deletion.undo();
    expect(bundle?.projects.map((project) => project.projectId)).toEqual(["a"]);
  });

  describe("edge cases", () => {
    it("downloads nothing when there is nothing to back up", async () => {
      const downloads = captureDownloads();
      expect(await backUpAllProjects()).toBeNull();
      downloads.stop();
      expect(downloads.names()).toEqual([]);
    });
  });

  describe("regressions", () => {
    it("regression: still downloads the stored projects when the open project's pending save fails", async () => {
      allowConsole(/could not flush the pending save/);
      useSettingsStore.setState({ autoSaveDelay: 60_000 });
      await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
      await seedStoredProject("b", { project: songTitled("Bravo") });
      await restoreOpenProject();
      useProjectStore.getState().setMetadata({ title: "Alpha edited" });
      debouncedSave(currentSaveInput());
      await removeProjectData("a");
      const bundle = await backUpAllProjects();
      expect(bundle?.projects.map((project) => project.metadata.title)).toEqual(["Bravo"]);
    });
  });
});
