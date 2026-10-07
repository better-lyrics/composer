/**
 * @vitest-environment node
 */
import { useAlignmentStore } from "@/stores/alignment";
import { INITIAL_STATE, useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cached = vi.hoisted(() => ({ value: true }));

vi.mock("@/audio/alignment/hubertfa/model-registry", () => ({
  getAlignmentAssets: () => ({
    model: { url: "https://models.test/model.onnx", approxBytes: 1 },
    dictionary: { url: "https://models.test/dict.txt", approxBytes: 1 },
    approxMb: 399,
  }),
}));

vi.mock("@/audio/separation/model-cache", () => ({ hasCachedModel: async () => cached.value }));

vi.mock("@/audio/alignment/vocals-pcm", () => ({
  loadVocalsPcm: async () => ({ samples: new Float32Array(44100 * 60), sampleRate: 44100 }),
}));

// Stands in for the model: splits by characters, and can't pronounce "zzz".
vi.mock("@/audio/alignment/hubertfa/hubertfa-aligner", async () => {
  const { splitByCharacters } = await import("@/audio/alignment/split-by-characters");
  return {
    hubertfaAligner: {
      id: "fake",
      listensToAudio: true,
      prepare: async () => {},
      release: () => {},
      align: async (segment: { words: string[]; taps: { begin: number; end: number } }) => {
        const unknown = segment.words.includes("zzz");
        return { intervals: splitByCharacters(segment), fellBack: unknown, unknownWords: unknown ? ["zzz"] : [] };
      },
    },
  };
});

describe("alignment store", () => {
  beforeEach(() => {
    cached.value = true;
    useProjectStore.setState(INITIAL_STATE);
    useAlignmentStore.setState({ status: "idle", progress: { done: 0, total: 0 }, error: null });
    useSeparationStore.setState({ stemUrls: { vocals: "blob:vocals" } });
  });

  it("turns line-synced lines into word-synced lines inside their taps", async () => {
    useProjectStore.getState().setLines([
      { id: "L1", text: "hello there", agentId: "v1", begin: 10, end: 12 },
      { id: "L2", text: "", agentId: "v1", begin: 13, end: 14 },
    ]);

    const result = await useAlignmentStore.getState().alignLines();

    expect(result).toEqual({ aligned: 1, skipped: 0, fellBack: 0, unknownWords: [] });
    const [line, empty] = useProjectStore.getState().lines;
    expect(line.words?.map((w) => w.text)).toEqual(["hello ", "there"]);
    expect(line.words?.[0].begin).toBeGreaterThanOrEqual(10);
    expect(line.words?.[1].end).toBeLessThanOrEqual(12);
    expect(empty.words).toBeUndefined();
  });

  it("keeps syllable splits from the lyrics", async () => {
    useProjectStore.getState().setLines([{ id: "L1", text: "hel|lo you", agentId: "v1", begin: 1, end: 2 }]);
    await useAlignmentStore.getState().alignLines();
    expect(useProjectStore.getState().lines[0].words?.map((w) => w.text)).toEqual(["hel", "lo ", "you"]);
  });

  it("leaves word-synced and unselected lines alone", async () => {
    const words = [{ text: "kept", begin: 3, end: 4 }];
    useProjectStore.getState().setLines([
      { id: "L1", text: "kept", agentId: "v1", words },
      { id: "L2", text: "not chosen", agentId: "v1", begin: 5, end: 6 },
      { id: "L3", text: "chosen", agentId: "v1", begin: 7, end: 8 },
    ]);

    await useAlignmentStore.getState().alignLines(["L1", "L3"]);

    const [first, second, third] = useProjectStore.getState().lines;
    expect(first.words).toEqual(words);
    expect(second.words).toBeUndefined();
    expect(third.words?.map((w) => w.text)).toEqual(["chosen"]);
  });

  it("re-aligns word-synced lines, keeping each part and only changing its times", async () => {
    const words = [
      { text: "hel", begin: 1, end: 1.1, syllableGroupId: "g1" },
      { text: "lo ", begin: 1.1, end: 1.2, syllableGroupId: "g1" },
      { text: "you", begin: 1.2, end: 3, explicit: true as const },
    ];
    useProjectStore.getState().setLines([{ id: "L1", text: "hel|lo you", agentId: "v1", words }]);

    const result = await useAlignmentStore.getState().alignLines(undefined, { realign: true });

    expect(result).toMatchObject({ aligned: 1 });
    const after = useProjectStore.getState().lines[0].words!;
    expect(after.map((w) => w.text)).toEqual(["hel", "lo ", "you"]);
    expect(after[0].syllableGroupId).toBe("g1");
    expect(after[2].explicit).toBe(true);
    expect(after[0].begin).toBe(1);
    expect(after[2].end).toBeCloseTo(3);
    expect(after[1].begin).not.toBe(1.1);
  });

  it("switches the Sync tab to word mode once lines have word timing", async () => {
    useProjectStore.getState().setGranularity("line");
    useProjectStore.getState().setLines([{ id: "L1", text: "one two", agentId: "v1", begin: 1, end: 2 }]);

    await useAlignmentStore.getState().alignLines();

    expect(useProjectStore.getState().granularity).toBe("word");
  });

  it("applies the whole run as one undo step", async () => {
    useProjectStore.getState().setLinesWithHistory([
      { id: "L1", text: "one", agentId: "v1", begin: 1, end: 2 },
      { id: "L2", text: "two", agentId: "v1", begin: 3, end: 4 },
    ]);

    await useAlignmentStore.getState().alignLines();
    useProjectStore.getState().undo();

    const lines = useProjectStore.getState().lines;
    expect(lines.every((l) => l.words === undefined)).toBe(true);
    expect(lines[0].begin).toBe(1);
  });

  it("reports lines with unknown words without stopping the run", async () => {
    useProjectStore.getState().setLines([
      { id: "L1", text: "zzz now", agentId: "v1", begin: 1, end: 2 },
      { id: "L2", text: "fine", agentId: "v1", begin: 3, end: 4 },
    ]);

    const result = await useAlignmentStore.getState().alignLines();

    expect(result).toMatchObject({ aligned: 2, fellBack: 1, unknownWords: ["zzz"] });
  });

  it("asks before downloading the model", async () => {
    cached.value = false;
    useProjectStore.getState().setLines([{ id: "L1", text: "one", agentId: "v1", begin: 1, end: 2 }]);

    expect(await useAlignmentStore.getState().alignLines()).toBeNull();
    expect(useAlignmentStore.getState().error?.code).toBe("needs-model");
    expect(useProjectStore.getState().lines[0].words).toBeUndefined();

    expect(await useAlignmentStore.getState().alignLines(undefined, { allowDownload: true })).toMatchObject({
      aligned: 1,
    });
  });

  it("refuses without separated vocals", async () => {
    useSeparationStore.setState({ stemUrls: {} });
    useProjectStore.getState().setLines([{ id: "L1", text: "one", agentId: "v1", begin: 1, end: 2 }]);

    expect(await useAlignmentStore.getState().alignLines()).toBeNull();
    expect(useAlignmentStore.getState().error?.code).toBe("needs-vocals");
  });

  it("refuses non-Latin lyrics when the project language is unset", async () => {
    useProjectStore.getState().setLines([{ id: "L1", text: "君の名は", agentId: "v1", begin: 1, end: 2 }]);

    expect(await useAlignmentStore.getState().alignLines()).toBeNull();
    expect(useAlignmentStore.getState().error?.code).toBe("unsupported-language");
  });

  it("refuses lyrics in other languages", async () => {
    useProjectStore.setState({ metadata: { ...INITIAL_STATE.metadata, language: "ja" } });
    useProjectStore.getState().setLines([{ id: "L1", text: "one", agentId: "v1", begin: 1, end: 2 }]);

    expect(await useAlignmentStore.getState().alignLines()).toBeNull();
    expect(useAlignmentStore.getState().error?.code).toBe("unsupported-language");
  });
});
