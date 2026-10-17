import { useLoadYouTubeSource } from "@/hooks/useLoadYouTubeSource";
import { usePersistence } from "@/hooks/usePersistence";
import { deleteProject, restoreOpenProject } from "@/lib/open-project";
import { ensureOpenProjectId, openProjectIdSnapshot } from "@/lib/open-project-session";
import { DB_NAME, DB_VERSION } from "@/lib/persistence-idb";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { loadProjectRecord } from "@/lib/project-storage";
import { isProjectDeleted } from "@/lib/project-tombstones";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { allowConsole } from "@/test/console-guard";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine } from "@/test/factories";
import { deleteDatabase, openAndCloseAtVersion } from "@/test/idb";
import { render } from "@/test/render";
import { seedStoredProject, songTitled } from "@/test/projects";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { isYouTubeSourceFor } from "@/utils/youtube-source";

// -- Constants ----------------------------------------------------------------

const VIDEO_ID = "dQw4w9WgXcQ";
const OTHER_VIDEO_ID = "9bZkp7q19f0";
const LOAD_ERROR_MESSAGE = "Could not load that video. Try again.";

// -- Helpers ------------------------------------------------------------------

const PersistenceHost: React.FC = () => {
  usePersistence();
  return <Toaster />;
};

async function openAlpha(lyrics: boolean): Promise<void> {
  await seedStoredProject("a", {
    open: true,
    audio: createAudioFile("alpha.wav"),
    project: {
      ...songTitled("Alpha"),
      ...(lyrics ? {} : { lines: [] }),
      audioSource: { kind: "file", name: "alpha.wav" },
    },
  });
  await restoreOpenProject();
}

async function loader(): Promise<(videoId: string) => Promise<void>> {
  const { result } = await renderHook(() => useLoadYouTubeSource());
  return result.current;
}

function videoFile(videoId: string): File {
  return new File([new Uint8Array([1, 2, 3])], `${videoId}.opus`, { type: "audio/ogg" });
}

function failLoad(): void {
  useAudioStore.getState().failYouTubeLoad(LOAD_ERROR_MESSAGE);
}

// -- Tests --------------------------------------------------------------------

describe("useLoadYouTubeSource · projects", () => {
  it("a different video over a project with lyrics opens a new project", async () => {
    const screen = await render(<Toaster />);
    await openAlpha(true);
    const load = await loader();
    const loading = load(VIDEO_ID);
    const id = openProjectIdSnapshot();
    expect(id).not.toBe("a");
    expect(useProjectStore.getState().lines).toEqual([]);
    expect(useProjectStore.getState().metadata.title).toBe(VIDEO_ID);
    useAudioStore.getState().setYouTubeFile(videoFile(VIDEO_ID));
    await expect(loading).resolves.toBeUndefined();
    await expect.element(screen.getByText(`Opened “${VIDEO_ID}” in a new project`)).toBeInTheDocument();
    await expect.element(screen.getByText("“Alpha” is still in Projects.")).toBeInTheDocument();
  });

  it("a failed load returns to the previous project and removes the empty new one", async () => {
    await openAlpha(true);
    const load = await loader();
    const loading = load(VIDEO_ID);
    const id = openProjectIdSnapshot() ?? "";
    failLoad();
    await expect(loading).rejects.toThrow(LOAD_ERROR_MESSAGE);
    expect(openProjectIdSnapshot()).toBe("a");
    expect(useProjectStore.getState().metadata.title).toBe("Alpha");
    expect(await isProjectDeleted(id)).toBe(true);
  });

  it("still removes the abandoned project when switching back to the previous one fails", async () => {
    allowConsole(/\[YouTubeSource\]/);
    await openAlpha(true);
    const load = await loader();
    const loading = load(VIDEO_ID);
    const id = openProjectIdSnapshot() ?? "";
    await deleteProject("a");
    failLoad();
    await expect(loading).rejects.toThrow(LOAD_ERROR_MESSAGE);
    expect(await isProjectDeleted(id)).toBe(true);
  });

  it("shows the switch-back toast even when the previous project has no id yet", async () => {
    const screen = await render(<PersistenceHost />);
    await getPersistenceSettled();
    useAudioStore.getState().setSource({ type: "file", file: createAudioFile("alpha.wav") });
    useProjectStore.getState().setLines([createLine({ text: "Waiting in a car" })]);
    useProjectStore.getState().setMetadata({ title: "Alpha" });
    expect(openProjectIdSnapshot()).toBeUndefined();
    const load = await loader();
    const loading = load(VIDEO_ID);
    const previousId = await ensureOpenProjectId();
    const newId = openProjectIdSnapshot();
    expect(previousId).not.toBe(newId);
    useAudioStore.getState().setYouTubeFile(videoFile(VIDEO_ID));
    await expect(loading).resolves.toBeUndefined();
    await expect.element(screen.getByText(`Opened “${VIDEO_ID}” in a new project`)).toBeInTheDocument();
    await expect.element(screen.getByText("“Alpha” is still in Projects.")).toBeInTheDocument();
    await expect.poll(async () => (await loadProjectRecord(previousId))?.metadata.title).toBe("Alpha");
    expect((await loadProjectRecord(previousId))?.lines).toHaveLength(1);
  });

  describe("error paths", () => {
    it("loads the video in place when the previous project cannot be resolved", async () => {
      allowConsole(/could not resolve the previous project/);
      useAudioStore.getState().setSource({ type: "file", file: createAudioFile("alpha.wav") });
      useProjectStore.getState().setLines([createLine({ text: "Waiting in a car" })]);
      useProjectStore.getState().setMetadata({ title: "Alpha" });
      await openAndCloseAtVersion(DB_NAME, DB_VERSION + 1);
      const load = await loader();
      const loading = load(VIDEO_ID);
      await expect.poll(() => isYouTubeSourceFor(useAudioStore.getState().source, VIDEO_ID)).toBe(true);
      expect(openProjectIdSnapshot()).toBeUndefined();
      expect(useProjectStore.getState().lines).toHaveLength(1);
      useAudioStore.getState().setYouTubeFile(videoFile(VIDEO_ID));
      await expect(loading).resolves.toBeUndefined();
      await deleteDatabase(DB_NAME);
    });
  });

  describe("edge cases", () => {
    it("a load superseded by another video stays in the new project", async () => {
      await openAlpha(true);
      const load = await loader();
      const loading = load(VIDEO_ID);
      const id = openProjectIdSnapshot() ?? "";
      useAudioStore.getState().setYouTubeSource(OTHER_VIDEO_ID);
      await expect(loading).rejects.toThrow("youtube_load_superseded");
      expect(openProjectIdSnapshot()).toBe(id);
      expect(await isProjectDeleted(id)).toBe(false);
    });

    it("a failed load keeps the new project once lyrics were typed into it", async () => {
      await openAlpha(true);
      const load = await loader();
      const loading = load(VIDEO_ID);
      const id = openProjectIdSnapshot();
      useProjectStore.getState().setLines([{ id: "n1", text: "New words", agentId: "v1" }]);
      failLoad();
      await expect(loading).rejects.toThrow();
      expect(openProjectIdSnapshot()).toBe(id);
      expect(await isProjectDeleted(id ?? "")).toBe(false);
      expect(useAudioStore.getState().source).toBeNull();
    });

    it("a different video over a project without lyrics replaces it in place", async () => {
      await openAlpha(false);
      const load = await loader();
      void load(VIDEO_ID).catch(() => undefined);
      expect(openProjectIdSnapshot()).toBe("a");
      expect(useProjectStore.getState().metadata.title).toBe(VIDEO_ID);
    });
  });
});
