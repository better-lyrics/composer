import { forkOpenProject } from "@/lib/open-project";
import { adoptOpenProjectId } from "@/lib/open-project-session";
import { removeProjectData } from "@/lib/project-repository";
import { loadProjectStems } from "@/lib/project-stems";
import { useAudioStore } from "@/stores/audio";
import { storeSeparatedStems } from "@/stores/separated-stem-write";
import { useSeparationStore } from "@/stores/separation";
import { createAudioFile, createMp3File } from "@/test/audio-fixtures";
import { seedStoredProject } from "@/test/projects";
import { describe, expect, it } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("imported stems", () => {
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

  it("regression: a slower earlier import never overwrites the file chosen after it", async () => {
    await openSong("import-race");
    const earlier = useSeparationStore.getState().importStem("vocals", createMp3File("first.mp3"));
    const later = useSeparationStore.getState().importStem("vocals", createAudioFile("second.wav", 2));
    await Promise.all([earlier, later]);
    await useSeparationStore.getState().acceptPendingImport();

    expect((await loadProjectStems("import-race"))?.slots.vocals?.name).toBe("second.wav");
  });

  it("separation fills only the empty slot and never replaces an imported stem", async () => {
    await openSong("import-fill");
    const acapella = createAudioFile("acapella.wav", 2);
    await useSeparationStore.getState().importStem("vocals", acapella);
    const modelOutput = {
      vocals: createAudioFile("model-vocals.wav", 2),
      instrumental: createAudioFile("model-inst.wav", 2),
    };

    await storeSeparatedStems({
      audioHash: "song",
      songKey: (await loadProjectStems("import-fill"))?.songKey ?? "",
      variant: "fp32",
      files: modelOutput,
      durationSeconds: 2,
      projectId: "import-fill",
      emptySlots: ["vocals", "instrumental"],
    });

    const stems = await loadProjectStems("import-fill");
    expect(stems?.slots.vocals).toMatchObject({ origin: "imported", name: "acapella.wav" });
    expect(stems?.slots.vocals?.data.byteLength).toBe(acapella.size);
    expect(stems?.slots.instrumental?.origin).toBe("separated");
  });

  it("does not start a separation when both slots are filled", async () => {
    await openSong("import-full");
    await useSeparationStore.getState().importStem("vocals", createAudioFile("v.wav", 2));
    await useSeparationStore.getState().importStem("instrumental", createAudioFile("i.wav", 2));
    useSeparationStore.setState({ hostingConfigured: true });

    await useSeparationStore.getState().separate();
    expect(useSeparationStore.getState().status).toBe("ready");
  });
});
