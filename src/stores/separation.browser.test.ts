import { hashFile } from "@/audio/separation/audio-codec";
import {
  beginLoadingStemJob,
  endLoadingStemJob,
  isStemJobLoading,
  listStemJobs,
  putStem,
  stemJobKey,
} from "@/audio/separation/stem-store";
import { SeparationWorker } from "@/audio/separation/worker-host";
import { useAudioStore } from "@/stores/audio";
import { isStemJobInUse, toggledStem, useSeparationStore } from "@/stores/separation";
import { adoptOpenProjectId } from "@/lib/open-project-session";
import { loadProjectStems } from "@/lib/project-stems";
import { createAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject } from "@/test/projects";
import { afterEach, describe, expect, it, vi } from "vitest";

// -- Helpers ------------------------------------------------------------------

type ProcessResult = Awaited<ReturnType<SeparationWorker["process"]>>;

const ENCODE_SECONDS = 60;

// The vocal model needs an 85 MB download, so these tests stand in for it at the worker boundary only.
function stubVocalModel(): { finishNextRun: (vocals?: Float32Array[]) => void } {
  const pending: Array<(result: ProcessResult) => void> = [];
  vi.spyOn(SeparationWorker.prototype, "init").mockResolvedValue(undefined);
  vi.spyOn(SeparationWorker.prototype, "process").mockImplementation(
    () => new Promise<ProcessResult>((resolve) => pending.push(resolve)),
  );
  return {
    finishNextRun: (vocals) => {
      const frames = ENCODE_SECONDS * 44_100;
      const channels = vocals ?? [new Float32Array(frames), new Float32Array(frames)];
      pending.shift()?.({ vocals: channels, numChannels: channels.length, totalFrames: frames });
    },
  };
}

async function startSeparation(): Promise<{ run: Promise<void>; model: ReturnType<typeof stubVocalModel> }> {
  const model = stubVocalModel();
  useSeparationStore.setState({ hostingConfigured: true });
  useAudioStore.getState().setSource({ type: "file", file: createAudioFile("separate-me.wav") });
  const run = useSeparationStore.getState().separate();
  await expect.poll(() => useSeparationStore.getState().jobKey).not.toBeNull();
  return { run, model };
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -- Tests --------------------------------------------------------------------

describe("refreshForCurrentSource", () => {
  it("marks the job key in use while it reads cached stems and clears it once ready", async () => {
    const file = createAudioFile("song.wav");
    const audioHash = await hashFile(file);
    await putStem(audioHash, "vocals", "fp32", new Blob([new Uint8Array(20_000_000)]));
    await putStem(audioHash, "instrumental", "fp32", new Blob([new Uint8Array(20_000_000)]));
    const jobKey = stemJobKey(audioHash, "fp32");

    useAudioStore.getState().setSource({ type: "file", file });
    const refreshing = useSeparationStore.getState().refreshForCurrentSource();
    await expect.poll(() => isStemJobLoading(jobKey), { interval: 1 }).toBe(true);
    await refreshing;

    expect(isStemJobLoading(jobKey)).toBe(false);
    expect(useSeparationStore.getState().jobKey).toBe(jobKey);
    expect(useSeparationStore.getState().status).toBe("ready");
    expect((await listStemJobs()).map((job) => job.jobKey)).toContain(jobKey);
  });

  describe("edge cases", () => {
    it("clears the marker even when no cached stems exist for the job", async () => {
      const file = createAudioFile("no-stems.wav");
      const audioHash = await hashFile(file);
      const jobKey = stemJobKey(audioHash, "fp32");

      useAudioStore.getState().setSource({ type: "file", file });
      const refreshing = useSeparationStore.getState().refreshForCurrentSource();
      await refreshing;

      expect(isStemJobLoading(jobKey)).toBe(false);
      expect(useSeparationStore.getState().jobKey).toBe(jobKey);
      expect(useSeparationStore.getState().status).toBe("idle");
    });
  });
});

describe("isStemJobInUse", () => {
  it("is true for the open project's job key and for a job that is loading", () => {
    useSeparationStore.setState({ jobKey: "open|fp32|v2" });
    beginLoadingStemJob("loading|fp32|v2");
    try {
      expect(isStemJobInUse("open|fp32|v2")).toBe(true);
      expect(isStemJobInUse("loading|fp32|v2")).toBe(true);
    } finally {
      endLoadingStemJob("loading|fp32|v2");
    }
  });

  describe("edge cases", () => {
    it("is false for any other job, and with no job key at all", () => {
      expect(isStemJobInUse("other|fp32|v2")).toBe(false);
      useSeparationStore.setState({ jobKey: "open|fp32|v2" });
      expect(isStemJobInUse("other|fp32|v2")).toBe(false);
    });
  });
});

describe("separate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores both stems and becomes ready", async () => {
    const { run, model } = await startSeparation();
    model.finishNextRun();
    await run;

    const state = useSeparationStore.getState();
    expect(state.status).toBe("ready");
    expect(Object.keys(state.stemUrls).toSorted()).toEqual(["instrumental", "vocals"]);
  });

  describe("error paths", () => {
    it("reports an unknown error when the stems cannot be encoded", async () => {
      const { run, model } = await startSeparation();
      const detached = new Float32Array(4);
      structuredClone(detached.buffer, { transfer: [detached.buffer] });
      model.finishNextRun([detached, new Float32Array(0)]);
      await run;

      const state = useSeparationStore.getState();
      expect(state.status).toBe("error");
      expect(state.error?.code).toBe("unknown");
      expect(state.stemUrls).toEqual({});
    });
  });

  describe("regressions", () => {
    it("regression: a cancel while the stems encode ends idle and discards the result", async () => {
      const { run, model } = await startSeparation();
      model.finishNextRun();
      await settle(0);
      useSeparationStore.getState().cancel();
      await run;
      await settle(100);

      const state = useSeparationStore.getState();
      expect(state.status).toBe("idle");
      expect(state.stemUrls).toEqual({});
      expect(state.availableStems).toEqual(["original"]);
    });

    it("regression: a project switch while the stems encode never offers the old song's stems", async () => {
      const { run, model } = await startSeparation();
      model.finishNextRun();
      await settle(0);
      useSeparationStore.getState().reset();
      useAudioStore.getState().setSource({ type: "file", file: createAudioFile("next-project.wav") });
      await run;
      await settle(100);

      const state = useSeparationStore.getState();
      expect(state.status).toBe("idle");
      expect(state.stemUrls).toEqual({});
      expect(state.jobKey).toBeNull();
    });

    it("regression: a cancelled run never overwrites a newer separation", async () => {
      const { run: first, model } = await startSeparation();
      model.finishNextRun();
      await settle(0);
      useSeparationStore.getState().cancel();
      const second = useSeparationStore.getState().separate();
      await expect.poll(() => useSeparationStore.getState().status).toBe("processing");
      await first;
      await settle(100);
      expect(useSeparationStore.getState().status).toBe("processing");

      model.finishNextRun();
      await second;
      expect(useSeparationStore.getState().status).toBe("ready");
    });
  });
});

describe("toggledStem", () => {
  const ALL_STEMS = ["original", "vocals", "instrumental"] as const;

  it("switches from Original to Vocals the first time", () => {
    useSeparationStore.setState({ availableStems: [...ALL_STEMS], currentStem: "original" });
    expect(toggledStem()).toBe("vocals");
  });

  it("goes back to Original from a stem", () => {
    useSeparationStore.setState({ availableStems: [...ALL_STEMS], currentStem: "vocals" });
    expect(toggledStem()).toBe("original");
  });

  it("returns to the last stem the user picked", () => {
    useSeparationStore.setState({ availableStems: [...ALL_STEMS] });
    useSeparationStore.getState().selectStem("instrumental");
    useSeparationStore.getState().selectStem("original");
    expect(toggledStem()).toBe("instrumental");
  });

  describe("regressions", () => {
    it("regression: returns to the stem a project was restored on", () => {
      useSeparationStore.getState().restoreCurrentStem("instrumental");
      useSeparationStore.setState({ availableStems: [...ALL_STEMS] });
      useSeparationStore.getState().selectStem(toggledStem());
      expect(toggledStem()).toBe("instrumental");
    });
  });

  describe("edge cases", () => {
    it("selecting the toggled stem does nothing before separation", () => {
      useSeparationStore.getState().selectStem(toggledStem());
      expect(useSeparationStore.getState().currentStem).toBe("original");
    });

    it("an unavailable stem pick does not change the remembered stem", () => {
      useSeparationStore.getState().selectStem("instrumental");
      useSeparationStore.setState({ availableStems: [...ALL_STEMS], currentStem: "original" });
      expect(toggledStem()).toBe("vocals");
    });
  });
});

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
