/**
 * @vitest-environment node
 */
import { useAlignmentStore } from "@/stores/alignment";
import { INITIAL_STATE, useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { createGroup } from "@/test/factories";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cached = vi.hoisted(() => ({ value: true }));
const seen = vi.hoisted(() => ({
  segments: [] as { hanReading: string; parts: string[][] }[],
  japanese: [] as boolean[],
  // Lines whose window starts after this song time fall back, as if the model found no path.
  fallBackAfter: null as number | null,
}));

// Real model resolution: hosting is configured, the manifest fetch finds none
// (the built-in model only), and the browser cache answers from `cached`.
vi.stubEnv("VITE_VOCAL_MODEL_BASE_URL", "https://models.test");
vi.stubGlobal("fetch", async () => new Response(null, { status: 404 }));
vi.stubGlobal("caches", {
  open: async () => ({ match: async () => (cached.value ? new Response() : undefined) }),
});

vi.mock("@/audio/alignment/vocals-pcm", () => ({
  loadVocalsPcm: async () => ({ samples: new Float32Array(44100 * 60), sampleRate: 44100 }),
}));

// Stands in for the model: splits by characters, and can't pronounce "zzz".
vi.mock("@/audio/alignment/hubertfa/hubertfa-aligner", async () => {
  const { splitByCharacters } = await import("@/audio/alignment/split-by-characters");
  type Segment = Parameters<typeof splitByCharacters>[0] & { hanReading: string; windowBegin: number };
  return {
    hubertfaAligner: {
      id: "fake",
      listensToAudio: true,
      prepare: async (_progress: unknown, _signal: unknown, options: { japanese: boolean }) => {
        seen.japanese.push(options.japanese);
      },
      release: () => {},
      isLoaded: () => true,
      align: async (segment: Segment) => {
        seen.segments.push({ hanReading: segment.hanReading, parts: segment.words.map((w) => w.parts) });
        const unknown =
          segment.words.some((w) => w.text === "zzz") ||
          (seen.fallBackAfter !== null && segment.windowBegin > seen.fallBackAfter);
        const intervals = splitByCharacters(segment);
        // The audio calls for splitting an unsplit "yellow" into "yel|low".
        const parts = segment.words.flatMap((w) => w.parts);
        const splits = parts.flatMap((part, i) =>
          part === "yellow" ? [{ part: i, at: [3], intervals: [intervals[i], intervals[i]] }] : [],
        );
        return { intervals, fellBack: unknown, unknownWords: unknown ? ["zzz"] : [], guessedWords: [], splits };
      },
    },
  };
});

describe("alignment store", () => {
  beforeEach(() => {
    cached.value = true;
    seen.segments = [];
    seen.japanese = [];
    seen.fallBackAfter = null;
    useProjectStore.setState({ groups: [] });
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

    expect(result).toEqual({ aligned: 1, skipped: 0, fellBack: 0, unknownWords: [], guessedWords: [] });
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

  it("regression: groups every split word it writes, from the lyrics or from the audio, separately", async () => {
    useProjectStore.getState().setLines([{ id: "L1", text: "hel|lo yellow there", agentId: "v1", begin: 1, end: 4 }]);
    await useAlignmentStore.getState().alignLines();

    const words = useProjectStore.getState().lines[0].words!;
    expect(words.map((w) => w.text)).toEqual(["hel", "lo ", "yel", "low ", "there"]);
    const [a, b, c, d, e] = words.map((w) => w.syllableGroupId);
    expect(a).toBeDefined();
    expect(c).toBeDefined();
    expect([a === b, c === d, a === c, e]).toEqual([true, true, false, undefined]);
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

  it("regression: ignores a second run started while the first is still resolving its model", async () => {
    useProjectStore.getState().setLines([{ id: "L1", text: "one", agentId: "v1", begin: 1, end: 2 }]);

    const { alignLines } = useAlignmentStore.getState();
    const [first, second] = await Promise.all([alignLines(), alignLines()]);

    expect(first).toMatchObject({ aligned: 1 });
    expect(second).toBeNull();
    expect(seen.japanese).toHaveLength(1);
  });

  it("regression: saves nothing into a project opened while the run was going", async () => {
    useProjectStore.getState().setLines([{ id: "L1", text: "one", agentId: "v1", begin: 1, end: 2 }]);

    const run = useAlignmentStore.getState().alignLines();
    useProjectStore.getState().startProjectSession();

    expect(await run).toBeNull();
    expect(useProjectStore.getState().lines[0].words).toBeUndefined();
  });

  it("regression: saves nothing when cancelled before the model has loaded", async () => {
    useProjectStore.getState().setLines([{ id: "L1", text: "one", agentId: "v1", begin: 1, end: 2 }]);

    const run = useAlignmentStore.getState().alignLines();
    useAlignmentStore.getState().cancel();

    expect(await run).toBeNull();
    expect(useProjectStore.getState().lines[0].words).toBeUndefined();
    expect(useAlignmentStore.getState().status).toBe("idle");
  });

  it("regression: keeps the untimed text of a partly synced line it doesn't touch", async () => {
    useProjectStore.getState().setLines([
      { id: "L1", text: "hello there", agentId: "v1", begin: 1, end: 2 },
      { id: "L2", text: "one more line", agentId: "v1", words: [{ text: "one ", begin: 3, end: 4 }] },
    ]);

    await useAlignmentStore.getState().alignLines(["L1"]);

    expect(useProjectStore.getState().lines[1].text).toBe("one more line");
  });

  it("regression: a split and the syllable timing that follows it undo in one step", async () => {
    const whole = { text: "hello", begin: 1, end: 2 };
    useProjectStore.getState().setLinesWithHistory([{ id: "L1", text: "hello", agentId: "v1", words: [whole] }]);
    const before = useProjectStore.getState().lines;
    // Split off-centre, so the model's even-by-letter timing moves the boundary.
    useProjectStore.getState().setLinesWithHistory([
      {
        id: "L1",
        text: "hello",
        agentId: "v1",
        words: [
          { text: "hel", begin: 1, end: 1.9, syllableGroupId: "g" },
          { text: "lo", begin: 1.9, end: 2, syllableGroupId: "g" },
        ],
      },
    ]);

    await useAlignmentStore.getState().retimeNewSyllables(before);
    expect(useProjectStore.getState().lines[0].words?.[0].end).not.toBe(1.9);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines[0].words).toEqual([whole]);
  });

  it("regression: syllable timing found for one shared instance reaches the others", async () => {
    const chorus = (instanceIdx: number, begin: number, split: number) => ({
      id: `c${instanceIdx}`,
      text: "hello",
      agentId: "v1",
      groupId: "g1",
      instanceIdx,
      templateLineIdx: 0,
      words: [
        { text: "hel", begin, end: begin + split, syllableGroupId: `s${instanceIdx}` },
        { text: "lo", begin: begin + split, end: begin + 1, syllableGroupId: `s${instanceIdx}` },
      ],
    });
    useProjectStore.setState({ groups: [createGroup({ id: "g1", sharesTiming: true })] });
    useProjectStore.getState().setLinesWithHistory([
      {
        id: "c0",
        text: "hello",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [{ text: "hello", begin: 10, end: 11 }],
      },
      {
        id: "c1",
        text: "hello",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [{ text: "hello", begin: 40, end: 41 }],
      },
    ]);
    const before = useProjectStore.getState().lines;
    useProjectStore.getState().setLinesWithHistory([chorus(0, 10, 0.9), chorus(1, 40, 0.9)]);
    // The second instance's alignment falls back; it should still get the first one's timing.
    seen.fallBackAfter = 30;

    await useAlignmentStore.getState().retimeNewSyllables(before);

    const [first, second] = useProjectStore.getState().lines;
    expect(first.words![0].end).not.toBeCloseTo(10.9, 6);
    expect(second.words![0].end - 40).toBeCloseTo(first.words![0].end - 10, 6);
  });

  it("refuses without separated vocals", async () => {
    useSeparationStore.setState({ stemUrls: {} });
    useProjectStore.getState().setLines([{ id: "L1", text: "one", agentId: "v1", begin: 1, end: 2 }]);

    expect(await useAlignmentStore.getState().alignLines()).toBeNull();
    expect(useAlignmentStore.getState().error?.code).toBe("needs-vocals");
  });

  it("times unspaced Chinese one character at a time, read as Mandarin", async () => {
    useProjectStore.getState().setLines([{ id: "L1", text: "我爱你", agentId: "v1", begin: 1, end: 2 }]);

    await useAlignmentStore.getState().alignLines();

    expect(seen.segments[0]).toEqual({ hanReading: "zh", parts: [["我", "爱", "你"]] });
    expect(seen.japanese).toEqual([false]);
    expect(useProjectStore.getState().lines[0].words?.map((w) => w.text)).toEqual(["我", "爱", "你"]);
  });

  it("reads kanji as Japanese when any line has kana, and loads the kanji dictionary", async () => {
    useProjectStore.getState().setLines([
      { id: "L1", text: "夜空", agentId: "v1", begin: 1, end: 2 },
      { id: "L2", text: "きみと dance", agentId: "v1", begin: 3, end: 4 },
    ]);

    await useAlignmentStore.getState().alignLines();

    expect(seen.japanese).toEqual([true]);
    expect(seen.segments.map((s) => s.hanReading)).toEqual(["ja", "ja"]);
    expect(seen.segments[1].parts).toEqual([["き", "み", "と"], ["dance"]]);
  });

  it("refuses lyrics in other languages", async () => {
    useProjectStore.setState({ metadata: { ...INITIAL_STATE.metadata, language: "ko" } });
    useProjectStore.getState().setLines([{ id: "L1", text: "one", agentId: "v1", begin: 1, end: 2 }]);

    expect(await useAlignmentStore.getState().alignLines()).toBeNull();
    expect(useAlignmentStore.getState().error?.code).toBe("unsupported-language");
  });
});
