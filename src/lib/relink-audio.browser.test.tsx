import { usePersistence } from "@/hooks/usePersistence";
import { openProject as switchToProject } from "@/lib/open-project";
import { adoptOpenProjectId } from "@/lib/open-project-session";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { loadProjectAudio } from "@/lib/project-audio";
import { loadProjectIndexEntry } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { relinkProjectAudioFile, relinkProjectVideo, retryProjectAudio } from "@/lib/relink-audio";
import { awaitInFlightSaves } from "@/lib/save-status";
import type { SavedProject } from "@/lib/saved-project";
import { useAudioStore } from "@/stores/audio";
import { useConfirmStore } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { createAudioFile, createUnplayableAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import type { RenderResult } from "vitest-browser-react";

// -- Helpers ------------------------------------------------------------------

const PersistenceHost: React.FC = () => {
  usePersistence();
  return <Toaster />;
};

async function openProject(project: Partial<SavedProject>): Promise<RenderResult> {
  await seedStoredProject("p", { open: true, project });
  const screen = await render(<PersistenceHost />);
  await getPersistenceSettled();
  return screen;
}

function openMissingFile(): Promise<RenderResult> {
  return openProject({
    metadata: { title: "City", artists: ["M83"], album: "Hurry Up", duration: 243 },
    audioSource: { kind: "file", name: "city.wav" },
  });
}

function answerConfirm(answer: boolean): void {
  const unsubscribe = useConfirmStore.subscribe((state) => {
    if (!state.isOpen) return;
    unsubscribe();
    state.resolveAndClose(answer, false);
  });
}

// -- Tests --------------------------------------------------------------------

describe("relinkProjectAudioFile", () => {
  it("links the file with the saved name without asking and keeps the song details", async () => {
    await openMissingFile();
    expect(await relinkProjectAudioFile(createAudioFile("city.wav"))).toBe(true);
    await awaitInFlightSaves();
    expect(useAudioStore.getState().expectedAudio).toBeNull();
    expect(useProjectStore.getState().metadata).toMatchObject({ title: "City", artists: ["M83"], album: "Hurry Up" });
    expect((await loadProjectAudio("p"))?.name).toBe("city.wav");
    const entry = await loadProjectIndexEntry("p");
    expect(entry).toMatchObject({ audioKind: "file", audioFileName: "city.wav" });
    expect(entry?.storedAudioBytes).toBeGreaterThan(0);
  });

  it("asks before linking a file with another name, and links it when confirmed", async () => {
    await openMissingFile();
    answerConfirm(true);
    expect(await relinkProjectAudioFile(createAudioFile("city (remaster).wav"))).toBe(true);
    await awaitInFlightSaves();
    expect((await loadProjectRecord("p"))?.audioSource).toEqual({ kind: "file", name: "city (remaster).wav" });
  });

  it("keeps the audio missing when a different file is declined", async () => {
    await openMissingFile();
    answerConfirm(false);
    expect(await relinkProjectAudioFile(createAudioFile("other.wav"))).toBe(false);
    expect(useAudioStore.getState().source).toBeNull();
    expect(useAudioStore.getState().expectedAudio).toEqual({ kind: "file", name: "city.wav" });
  });

  describe("edge cases", () => {
    it("treats a name that differs only by case as a different file", async () => {
      await openMissingFile();
      answerConfirm(false);
      expect(await relinkProjectAudioFile(createAudioFile("City.wav"))).toBe(false);
    });

    it("turns a YouTube project whose audio failed into a local-file project without asking", async () => {
      await openProject({ audioSource: { kind: "youtube", videoId: "v1" } });
      useAudioStore.getState().failYouTubeLoad("Nope");
      expect(await relinkProjectAudioFile(createAudioFile("local.wav"))).toBe(true);
      await awaitInFlightSaves();
      expect((await loadProjectRecord("p"))?.audioSource).toEqual({ kind: "file", name: "local.wav" });
      expect((await loadProjectAudio("p"))?.name).toBe("local.wav");
    });

    it("returns false and writes nothing when the project changes while the confirm is open", async () => {
      await openMissingFile();
      await seedStoredProject("q", { project: songTitled("Other Song") });
      const unsubscribe = useConfirmStore.subscribe((state) => {
        if (!state.isOpen) return;
        unsubscribe();
        void switchToProject("q").then(() => state.resolveAndClose(true, false));
      });

      expect(await relinkProjectAudioFile(createAudioFile("other.wav"))).toBe(false);
      await awaitInFlightSaves();
      expect((await loadProjectRecord("p"))?.audioSource).toEqual({ kind: "file", name: "city.wav" });
      expect((await loadProjectRecord("q"))?.audioSource).toBeUndefined();
    });

    it("returns false and links nothing when the project changes while the file is checked", async () => {
      await openMissingFile();
      await seedStoredProject("q", {
        project: { ...songTitled("Other Song"), audioSource: { kind: "file", name: "city.wav" } },
      });
      const linking = relinkProjectAudioFile(createAudioFile("city.wav"));
      adoptOpenProjectId("q");
      useAudioStore.getState().expectProjectAudio({ kind: "file", name: "city.wav" });
      expect(await linking).toBe(false);
      await awaitInFlightSaves();
      expect(useAudioStore.getState().source).toBeNull();
      expect(await loadProjectAudio("q")).toBeUndefined();
      expect(await loadProjectAudio("p")).toBeUndefined();
    });

    it("returns false and keeps the new audio when audio arrives while the confirm is open", async () => {
      await openMissingFile();
      const arrived = createAudioFile("city.wav");
      const unsubscribe = useConfirmStore.subscribe((state) => {
        if (!state.isOpen) return;
        unsubscribe();
        useAudioStore.getState().setSource({ type: "file", file: arrived });
        state.resolveAndClose(true, false);
      });
      expect(await relinkProjectAudioFile(createAudioFile("other.wav"))).toBe(false);
      const source = useAudioStore.getState().source;
      expect(source?.type === "file" ? source.file : null).toBe(arrived);
      await expect.poll(async () => (await loadProjectAudio("p"))?.name).toBe("city.wav");
    });
  });

  describe("error paths", () => {
    it("keeps the audio missing and shows a toast when the file can't be played", async () => {
      const screen = await openMissingFile();
      expect(await relinkProjectAudioFile(createUnplayableAudioFile())).toBe(false);
      expect(useAudioStore.getState().source).toBeNull();
      expect(useAudioStore.getState().expectedAudio).toEqual({ kind: "file", name: "city.wav" });
      expect((await loadProjectRecord("p"))?.audioSource).toEqual({ kind: "file", name: "city.wav" });
      await expect.element(screen.getByText("Couldn't link that file")).toBeInTheDocument();
    });
  });
});

describe("relinkProjectVideo", () => {
  it("attaches the video to this project and keeps its title", async () => {
    await openMissingFile();
    const linking = relinkProjectVideo("dQw4w9WgXcQ");
    useAudioStore.getState().setYouTubeFile(createAudioFile("dQw4w9WgXcQ.opus"));
    await linking;
    expect((await loadProjectRecord("p"))?.audioSource).toEqual({ kind: "youtube", videoId: "dQw4w9WgXcQ" });
    expect(useProjectStore.getState().metadata.title).toBe("City");
  });

  describe("error paths", () => {
    it("rejects when the video fails to load and keeps the new expected video", async () => {
      await openMissingFile();
      const linking = relinkProjectVideo("dQw4w9WgXcQ");
      useAudioStore.getState().failYouTubeLoad("Nope");
      await expect(linking).rejects.toThrow("Nope");
      expect(useAudioStore.getState().expectedAudio).toEqual({ kind: "youtube", videoId: "dQw4w9WgXcQ" });
    });
  });
});

describe("retryProjectAudio", () => {
  it("fetches the expected YouTube audio again", async () => {
    await openProject({ audioSource: { kind: "youtube", videoId: "v1" } });
    useAudioStore.getState().failYouTubeLoad("Nope", "bridge-unreachable");
    retryProjectAudio();
    expect(useAudioStore.getState()).toMatchObject({
      source: { type: "youtube", videoId: "v1" },
      youtubeLoadError: null,
      youtubeLoadFailure: null,
    });
  });

  describe("edge cases", () => {
    it("does nothing for a missing local file", async () => {
      await openMissingFile();
      retryProjectAudio();
      expect(useAudioStore.getState().source).toBeNull();
    });
  });
});
