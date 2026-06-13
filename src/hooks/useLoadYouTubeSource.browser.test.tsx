import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useLoadYouTubeSource } from "@/hooks/useLoadYouTubeSource";
import { listLibraryProjects } from "@/lib/library-persistence";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";

const VIDEO_ID = "dQw4w9WgXcQ";
const OTHER_VIDEO_ID = "9bZkp7q19f0";

function createAudioFile(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], `${name}.opus`, { type: "audio/ogg" });
}

async function waitForActiveYouTubeSource(videoId: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const tick = () => {
      const src = useAudioStore.getState().source;
      if (src?.type === "youtube" && src.videoId === videoId) return resolve();
      requestAnimationFrame(tick);
    };
    tick();
  });
}

describe("useLoadYouTubeSource", () => {
  it("resolves when the tunnel populates source.file for the requested videoId", async () => {
    const { result } = await renderHook(() => useLoadYouTubeSource());
    const loadYouTubeSource = result.current;

    const pending = loadYouTubeSource(VIDEO_ID);
    await waitForActiveYouTubeSource(VIDEO_ID);
    useAudioStore.getState().setYouTubeFile(createAudioFile(VIDEO_ID));
    await expect(pending).resolves.toBeUndefined();
  });

  it("rejects when youtubeLoadError is set after kickoff", async () => {
    const { result } = await renderHook(() => useLoadYouTubeSource());
    const loadYouTubeSource = result.current;

    const pending = loadYouTubeSource(VIDEO_ID);
    await waitForActiveYouTubeSource(VIDEO_ID);
    useAudioStore.getState().setYouTubeLoadError("Could not load that video. Try again.");
    await expect(pending).rejects.toThrow("Could not load that video. Try again.");
  });

  it("rejects when source is replaced before the file lands", async () => {
    const { result } = await renderHook(() => useLoadYouTubeSource());
    const loadYouTubeSource = result.current;

    const pending = loadYouTubeSource(VIDEO_ID);
    await waitForActiveYouTubeSource(VIDEO_ID);
    useAudioStore.getState().setSource(null);
    await expect(pending).rejects.toThrow("youtube_load_superseded");
  });

  it("creates a new library entry for a fresh load", async () => {
    const { result } = await renderHook(() => useLoadYouTubeSource());
    const pending = result.current(VIDEO_ID);
    pending.catch(() => {});

    await waitForActiveYouTubeSource(VIDEO_ID);

    const activeId = useProjectStore.getState().activeProjectId;
    expect(activeId).toBeDefined();
    const projects = await listLibraryProjects();
    const created = projects.find((p) => p.id === activeId);
    expect(created?.audioSource).toEqual({ kind: "youtube", videoId: VIDEO_ID });
    expect(created?.metadata.title).toBe(VIDEO_ID);
  });

  it("does not create a duplicate entry when reloading the same videoId for the active project", async () => {
    const { result } = await renderHook(() => useLoadYouTubeSource());
    const firstPending = result.current(VIDEO_ID);
    firstPending.catch(() => {});

    await waitForActiveYouTubeSource(VIDEO_ID);
    const firstActiveId = useProjectStore.getState().activeProjectId;
    const projectsAfterFirst = await listLibraryProjects();
    expect(projectsAfterFirst.length).toBe(1);

    const secondPending = result.current(VIDEO_ID);
    secondPending.catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(useProjectStore.getState().activeProjectId).toBe(firstActiveId);
    const projectsAfterSecond = await listLibraryProjects();
    expect(projectsAfterSecond.length).toBe(1);
  });

  it("creates a separate library entry when loading a different videoId", async () => {
    const { result } = await renderHook(() => useLoadYouTubeSource());

    const firstPending = result.current(VIDEO_ID);
    firstPending.catch(() => {});
    await waitForActiveYouTubeSource(VIDEO_ID);

    const secondPending = result.current(OTHER_VIDEO_ID);
    secondPending.catch(() => {});
    await waitForActiveYouTubeSource(OTHER_VIDEO_ID);

    const projects = await listLibraryProjects();
    expect(projects.length).toBe(2);
  });

  it("exits library view after a successful kickoff", async () => {
    const { result } = await renderHook(() => useLoadYouTubeSource());
    const pending = result.current(VIDEO_ID);
    pending.catch(() => {});

    await waitForActiveYouTubeSource(VIDEO_ID);
    const { useUIStore } = await import("@/stores/ui");
    expect(useUIStore.getState().viewingLibrary).toBe(false);
  });
});
