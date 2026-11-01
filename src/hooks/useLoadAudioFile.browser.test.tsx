import { useLoadAudioFile } from "@/hooks/useLoadAudioFile";
import { usePersistence } from "@/hooks/usePersistence";
import { ensureOpenProjectId, openProjectIdSnapshot } from "@/lib/open-project-session";
import { DB_NAME, DB_VERSION } from "@/lib/persistence-idb";
import { saveOpenProjectNow } from "@/lib/persistence-debounce";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { loadProjectAudio } from "@/lib/project-audio";
import { loadProjectForRestore } from "@/lib/project-restore";
import { loadProjectRecord } from "@/lib/project-storage";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile, createMp3File, createUnplayableAudioFile } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { createLine } from "@/test/factories";
import { deleteDatabase, openAndCloseAtVersion } from "@/test/idb";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { type RenderResult, renderHook } from "vitest-browser-react";

// -- Types --------------------------------------------------------------------

interface OpenedAlpha {
  screen: RenderResult;
  current: File | undefined;
}

// -- Helpers ------------------------------------------------------------------

const PersistenceHost: React.FC = () => {
  usePersistence();
  return <Toaster />;
};

async function openAlpha(options: { lyrics: boolean; audio: boolean }): Promise<OpenedAlpha> {
  const audio = options.audio ? createAudioFile("alpha.wav") : undefined;
  await seedStoredProject("a", {
    open: true,
    audio,
    project: {
      ...songTitled("Alpha"),
      ...(options.lyrics ? {} : { lines: [] }),
      ...(audio ? { audioSource: { kind: "file" as const, name: "alpha.wav" } } : {}),
    },
  });
  const screen = await render(<PersistenceHost />);
  await getPersistenceSettled();
  const source = useAudioStore.getState().source;
  return { screen, current: source?.type === "file" ? source.file : undefined };
}

async function loader(): Promise<ReturnType<typeof useLoadAudioFile>> {
  const { result } = await renderHook(() => useLoadAudioFile());
  return result.current;
}

// -- Tests --------------------------------------------------------------------

describe("useLoadAudioFile", () => {
  it("leaves the song and its details untouched when the file is not playable", async () => {
    const current = createAudioFile("Current.wav");
    useAudioStore.getState().setSource({ type: "file", file: current });
    useProjectStore.getState().setMetadata({ title: "Current", isrc: "USRC17607839" });
    const metadataBefore = useProjectStore.getState().metadata;
    const screen = await render(<Toaster />);

    const load = await loader();
    await load(createUnplayableAudioFile());

    const source = useAudioStore.getState().source;
    expect(source?.type === "file" && source.file).toBe(current);
    expect(useProjectStore.getState().metadata).toBe(metadataBefore);
    await expect.element(screen.getByText("That file is not playable audio.")).toBeInTheDocument();
  });

  it("loads a playable file", async () => {
    const file = createAudioFile("Lovefield.wav");

    const load = await loader();
    await load(file);

    const source = useAudioStore.getState().source;
    expect(source?.type === "file" && source.file).toBe(file);
    expect(useProjectStore.getState().metadata.title).toBe("Lovefield");
  });

  it("lets only the latest pick apply when an unplayable file is still being checked", async () => {
    const valid = createAudioFile("Valid.wav");

    const load = await loader();
    const first = load(createUnplayableAudioFile());
    const second = load(valid);
    await Promise.all([first, second]);

    const source = useAudioStore.getState().source;
    expect(source?.type === "file" && source.file).toBe(valid);
    expect(useProjectStore.getState().metadata.title).toBe("Valid");
  });

  it("drops a playable pick that a newer pick overtook", async () => {
    const older = createAudioFile("Older.wav");
    const newer = createAudioFile("Newer.wav");

    const load = await loader();
    const first = load(older);
    const second = load(newer);
    await Promise.all([first, second]);

    const source = useAudioStore.getState().source;
    expect(source?.type === "file" && source.file).toBe(newer);
    expect(useProjectStore.getState().metadata.title).toBe("Newer");
  });
});

describe("useLoadAudioFile · projects", () => {
  it("a different song over a project with lyrics opens a new project and keeps the old one", async () => {
    await openAlpha({ lyrics: true, audio: true });
    const load = await loader();
    await load(createAudioFile("b-side.wav"));
    expect(openProjectIdSnapshot()).not.toBe("a");
    expect(useProjectStore.getState().lines).toEqual([]);
    expect(useProjectStore.getState().metadata.title).toBe("b-side");
    expect((await loadProjectRecord("a"))?.lines).toHaveLength(2);
  });

  it("shows a toast that switches back to the previous project", async () => {
    const { screen } = await openAlpha({ lyrics: true, audio: true });
    const load = await loader();
    await load(createAudioFile("b-side.wav"));
    await expect.element(screen.getByText("Opened “b-side” in a new project")).toBeInTheDocument();
    await expect.element(screen.getByText("“Alpha” is still in Projects.")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Switch back" }).click();
    await expect.poll(openProjectIdSnapshot).toBe("a");
    expect(useProjectStore.getState().metadata.title).toBe("Alpha");
  });

  it("saves the new song's audio into the new project only", async () => {
    await openAlpha({ lyrics: true, audio: true });
    const load = await loader();
    await load(createAudioFile("b-side.wav"));
    const id = openProjectIdSnapshot() ?? "";
    await expect.poll(async () => (await loadProjectAudio(id))?.name).toBe("b-side.wav");
    expect((await loadProjectAudio("a"))?.name).toBe("alpha.wav");
  });

  it("replace swaps the audio of a project with lyrics in place and keeps its lyrics", async () => {
    await openAlpha({ lyrics: true, audio: true });
    const linesBefore = useProjectStore.getState().lines;
    const load = await loader();
    const replacement = createAudioFile("alpha-remaster.wav");
    await load(replacement, "replace");
    expect(openProjectIdSnapshot()).toBe("a");
    expect(useProjectStore.getState().lines).toBe(linesBefore);
    const source = useAudioStore.getState().source;
    expect(source?.type === "file" && source.file).toBe(replacement);
    await expect.poll(async () => (await loadProjectAudio("a"))?.name).toBe("alpha-remaster.wav");
  });

  it("replace keeps what the user typed and singer names, and swaps what the old file provided", async () => {
    await openAlpha({ lyrics: true, audio: true });
    useProjectStore.getState().setAgents([{ id: "v1", name: "Gonzalez", type: "person" }]);
    const agentsBefore = useProjectStore.getState().agents;
    const load = await loader();
    await load(createAudioFile("alpha-remaster.wav"), "replace");
    await expect.poll(() => useAudioStore.getState().source?.file?.name).toBe("alpha-remaster.wav");
    expect(useProjectStore.getState().metadata.title).toBe("Alpha");
    expect(useProjectStore.getState().agents).toBe(agentsBefore);
  });

  it("replace swaps a title the old file provided", async () => {
    await openAlpha({ lyrics: true, audio: true });
    useProjectStore.getState().setMetadata({ title: "alpha" });
    const load = await loader();
    await load(createAudioFile("alpha-live.wav"), "replace");
    await expect.poll(() => useProjectStore.getState().metadata.title).toBe("alpha-live");
  });

  it("replace over a YouTube video swaps the details that video provided", async () => {
    await openAlpha({ lyrics: true, audio: false });
    const video = new File([new Uint8Array([1, 2, 3])], "video.opus", { type: "audio/ogg" });
    const details = { title: "Never Gonna Give You Up", artists: ["Rick Astley"] };
    useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ", video, details);
    useProjectStore.getState().setMetadata(details);
    const load = await loader();
    await load(createAudioFile("b-side.wav"), "replace");
    await expect.poll(() => useProjectStore.getState().metadata.title).toBe("b-side");
    expect(useProjectStore.getState().metadata.artists).toEqual([]);
  });

  it("replace with the file already loaded keeps a typed title", async () => {
    const { current } = await openAlpha({ lyrics: true, audio: true });
    if (!current) throw new Error("expected restored audio");
    const load = await loader();
    await load(current, "replace");
    expect(useProjectStore.getState().metadata.title).toBe("Alpha");
  });

  it("replace drops the old video's thumbnail", async () => {
    await openAlpha({ lyrics: true, audio: false });
    const video = new File([new Uint8Array([1, 2, 3])], "video.opus", { type: "audio/ogg" });
    useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ", video, { title: "Song" });
    useProjectStore
      .getState()
      .setMetadata({ thumbnailDataUrl: "data:image/png;base64,AA", thumbnailForVideoId: "dQw4w9WgXcQ" });
    const load = await loader();
    await load(createAudioFile("b-side.wav"), "replace");
    await expect.poll(() => useProjectStore.getState().metadata.thumbnailForVideoId).toBeUndefined();
    expect(useProjectStore.getState().metadata.thumbnailDataUrl).toBeUndefined();
  });

  describe("edge cases", () => {
    it("a different song over a project without lyrics replaces it in place", async () => {
      await openAlpha({ lyrics: false, audio: true });
      const load = await loader();
      await load(createAudioFile("b-side.wav"));
      expect(openProjectIdSnapshot()).toBe("a");
      expect(useProjectStore.getState().metadata.title).toBe("b-side");
    });

    it("dropping the same file again keeps the project", async () => {
      const { current } = await openAlpha({ lyrics: true, audio: true });
      if (!current) throw new Error("expected restored audio");
      const load = await loader();
      await load(current);
      expect(openProjectIdSnapshot()).toBe("a");
      expect(useProjectStore.getState().lines).toHaveLength(2);
    });

    it("the first audio for a project with lyrics attaches to it", async () => {
      await openAlpha({ lyrics: true, audio: false });
      const load = await loader();
      await load(createAudioFile("b-side.wav"));
      expect(openProjectIdSnapshot()).toBe("a");
      expect(useProjectStore.getState().lines).toHaveLength(2);
    });

    it("shows the new-project toast even when the previous project has no id yet", async () => {
      const screen = await render(<PersistenceHost />);
      await getPersistenceSettled();
      useAudioStore.getState().setSource({ type: "file", file: createAudioFile("alpha.wav") });
      useProjectStore.getState().setLines([createLine({ text: "Waiting in a car" })]);
      useProjectStore.getState().setMetadata({ title: "Alpha" });
      expect(openProjectIdSnapshot()).toBeUndefined();
      const load = await loader();
      const loading = load(createAudioFile("b-side.wav"));
      const previousId = await ensureOpenProjectId();
      await loading;
      await expect.poll(openProjectIdSnapshot).not.toBe(previousId);
      await expect.element(screen.getByText("Opened “b-side” in a new project")).toBeInTheDocument();
      await expect.element(screen.getByText("“Alpha” is still in Projects.")).toBeInTheDocument();
      await expect.poll(async () => (await loadProjectRecord(previousId))?.metadata.title).toBe("Alpha");
      expect((await loadProjectRecord(previousId))?.lines).toHaveLength(1);
    });

    it("falls back to an in-place load when the previous project id cannot be resolved", async () => {
      allowConsole(/could not resolve the previous project/);
      useAudioStore.getState().setSource({ type: "file", file: createAudioFile("alpha.wav") });
      useProjectStore.getState().setLines([createLine({ text: "Waiting in a car" })]);
      useProjectStore.getState().setMetadata({ title: "Alpha" });
      await openAndCloseAtVersion(DB_NAME, DB_VERSION + 1);
      const load = await loader();
      await load(createAudioFile("b-side.wav"));
      await expect
        .poll(() => {
          const source = useAudioStore.getState().source;
          return source?.type === "file" ? source.file.name : undefined;
        })
        .toBe("b-side.wav");
      expect(useProjectStore.getState().metadata.title).toBe("b-side");
      await deleteDatabase(DB_NAME);
    });
  });
});

describe("useLoadAudioFile priming flags", () => {
  it("regression: audio loaded in place into an old project without audio keeps its times over a reload", async () => {
    await seedStoredProject("old", {
      open: true,
      project: {
        lines: [createLine({ text: "Waiting in a car", begin: 1, end: 2 })],
        primingStripped: true,
        primingCorrected: false,
      },
    });
    await render(<PersistenceHost />);
    await getPersistenceSettled();
    const load = await loader();

    await load(createMp3File());
    await saveOpenProjectNow();
    const reloaded = (await loadProjectForRestore("old")).project;

    expect((reloaded?.lines[0] as { begin: number }).begin).toBeCloseTo(1, 9);
    expect(reloaded).toMatchObject({ primingStripped: true, primingCorrected: true });
  });
});
