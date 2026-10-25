import { SeparationWorker } from "@/audio/separation/worker-host";
import { forkOpenProject } from "@/lib/open-project";
import { adoptOpenProjectId } from "@/lib/open-project-session";
import { removeProjectData } from "@/lib/project-repository";
import { loadProjectStems } from "@/lib/project-stems";
import { useAudioStore } from "@/stores/audio";
import { useSeparationStore } from "@/stores/separation";
import { createAudioFile, createMp3File } from "@/test/audio-fixtures";
import { seedStoredProject } from "@/test/projects";
import { stubVocalModel } from "@/test/vocal-model-stub";
import { afterEach, describe, expect, it, vi } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("imported stems", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function openSong(id: string): Promise<void> {
    await seedStoredProject(id);
    adoptOpenProjectId(id);
    useAudioStore.getState().setSource({ type: "file", file: createAudioFile("song.wav", 2) });
    useAudioStore.getState().setDuration(2);
    await useSeparationStore.getState().refreshForCurrentSource();
  }

  it("imports vocals into the open project and plays them after a refresh", async () => {
    await openSong("import-vocals");
    await useSeparationStore.getState().importStem("vocals", createAudioFile("acapella.wav", 2));

    useSeparationStore.getState().reset();
    await useSeparationStore.getState().refreshForCurrentSource();
    const state = useSeparationStore.getState();
    expect(state.availableStems).toEqual(["original", "vocals"]);
    expect(state.stemOrigins).toEqual({ vocals: "imported" });
    expect(state.stemUrls.vocals).toBeDefined();
  });

  it("holds a stem whose length differs from the song until the user accepts it", async () => {
    await openSong("import-mismatch");
    await useSeparationStore.getState().importStem("vocals", createAudioFile("long.wav", 3.2));

    const pending = useSeparationStore.getState().pendingImport;
    expect(pending?.mismatchSeconds).toBeCloseTo(1.2, 1);
    expect(await loadProjectStems("import-mismatch")).toBeUndefined();

    await useSeparationStore.getState().acceptPendingImport();
    expect(useSeparationStore.getState().pendingImport).toBeNull();
    expect((await loadProjectStems("import-mismatch"))?.slots.vocals?.origin).toBe("imported");
  });

  it("regression: measures the song, not the stem that is playing, when checking a stem's length", async () => {
    await openSong("import-measure-song");
    useAudioStore.getState().setDuration(3.2);
    await useSeparationStore.getState().importStem("instrumental", createAudioFile("inst.wav", 2));

    expect(useSeparationStore.getState().pendingImport).toBeNull();
    expect((await loadProjectStems("import-measure-song"))?.slots.instrumental?.origin).toBe("imported");
  });

  it("regression: an import started in one project never lands in the project opened while it was checked", async () => {
    await openSong("import-from-a");
    await seedStoredProject("import-into-b");
    const importing = useSeparationStore.getState().importStem("vocals", createAudioFile("acapella.wav", 2));
    adoptOpenProjectId("import-into-b");
    useAudioStore.getState().setSource({ type: "file", file: createAudioFile("other-song.wav", 2) });
    await importing;

    expect(await loadProjectStems("import-into-b")).toBeUndefined();
    expect(await loadProjectStems("import-from-a")).toBeUndefined();
  });

  it("regression: keeping a project deleted in another tab keeps its imported stems", async () => {
    await openSong("fork-source");
    await useSeparationStore.getState().importStem("vocals", createAudioFile("acapella.wav", 2));
    await removeProjectData("fork-source");

    const forkId = await forkOpenProject();
    expect((await loadProjectStems(forkId))?.slots.vocals).toMatchObject({ origin: "imported", name: "acapella.wav" });
  });

  it("regression: drops the previous song's stems as soon as another song loads", async () => {
    await openSong("song-change");
    await useSeparationStore.getState().importStem("vocals", createAudioFile("acapella.wav", 2));
    useAudioStore.getState().setSource({ type: "file", file: createAudioFile("next-song.wav", 2) });
    const refreshing = useSeparationStore.getState().refreshForCurrentSource();
    expect(useSeparationStore.getState().stemUrls).toEqual({});
    await refreshing;
  });

  it("regression: stores an imported mp3 stem as wav, so it plays in step with the converted song", async () => {
    await openSong("import-mp3");
    await useSeparationStore.getState().importStem("vocals", createMp3File("acapella.mp3"));
    await useSeparationStore.getState().acceptPendingImport();
    const stem = (await loadProjectStems("import-mp3"))?.slots.vocals;
    expect(stem).toMatchObject({ name: "acapella.mp3", type: "audio/wav" });
  });

  it("separation fills only the empty slot and never replaces an imported stem", async () => {
    await openSong("import-fill");
    const acapella = createAudioFile("acapella.wav", 2);
    await useSeparationStore.getState().importStem("vocals", acapella);
    const model = stubVocalModel();
    useSeparationStore.setState({ hostingConfigured: true });

    const run = useSeparationStore.getState().separate();
    await expect.poll(() => vi.mocked(SeparationWorker.prototype.process).mock.calls.length).toBe(1);
    model.finishNextRun();
    await run;

    const stems = await loadProjectStems("import-fill");
    expect(stems?.slots.vocals).toMatchObject({ origin: "imported", name: "acapella.wav" });
    expect(stems?.slots.vocals?.data.byteLength).toBe(acapella.size);
    expect(stems?.slots.instrumental?.origin).toBe("separated");
    expect(useSeparationStore.getState().stemOrigins).toEqual({ vocals: "imported", instrumental: "separated" });
  });

  it("does not separate when both slots are filled", async () => {
    await openSong("import-full");
    await useSeparationStore.getState().importStem("vocals", createAudioFile("v.wav", 2));
    await useSeparationStore.getState().importStem("instrumental", createAudioFile("i.wav", 2));
    stubVocalModel();
    useSeparationStore.setState({ hostingConfigured: true });

    await useSeparationStore.getState().separate();
    expect(SeparationWorker.prototype.process).not.toHaveBeenCalled();
  });
});
