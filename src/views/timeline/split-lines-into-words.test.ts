/**
 * @vitest-environment node
 */
import type { LyricLine } from "@/domain/line/model";
import { getEffectiveLines } from "@/domain/line/effective-words";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { beforeEach, describe, expect, it } from "vitest";
import { computeSplitIntoWordsUpdates, computeSplitSelections, splitLinesIntoWords } from "./split-lines-into-words";

const lineSynced: LyricLine = { id: "L1", text: "one two three", agentId: "v1", begin: 1, end: 4 };
const wordSynced: LyricLine = {
  id: "L2",
  text: "already words",
  agentId: "v1",
  words: [{ text: "already words", begin: 5, end: 6 }],
};
const anotherSynced: LyricLine = { id: "L3", text: "four five", agentId: "v1", begin: 7, end: 9 };
const sentenceBg: LyricLine = {
  id: "L4",
  text: "main line",
  agentId: "v1",
  words: [
    { text: "main ", begin: 0, end: 2 },
    { text: "line", begin: 2, end: 4 },
  ],
  backgroundText: "ooh yeah baby",
  backgroundWords: [{ text: "ooh yeah baby", begin: 1, end: 4 }],
  backgroundTextSource: "manual",
};

function main(...ids: string[]) {
  return ids.map((lineId) => ({ lineId, type: "word" as const }));
}

function bg(...ids: string[]) {
  return ids.map((lineId) => ({ lineId, type: "bg" as const }));
}

describe("computeSplitIntoWordsUpdates", () => {
  it("converts a line-synced line into a word update with begin/end cleared", () => {
    const updates = computeSplitIntoWordsUpdates(main("L1"), [lineSynced]);
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("L1");
    expect(updates[0].updates.begin).toBeUndefined();
    expect(updates[0].updates.end).toBeUndefined();
    expect(updates[0].updates.words?.length).toBeGreaterThan(0);
  });

  it("skips lines that are already word-synced", () => {
    const updates = computeSplitIntoWordsUpdates(main("L2"), [wordSynced]);
    expect(updates).toHaveLength(0);
  });

  it("skips unknown ids", () => {
    const updates = computeSplitIntoWordsUpdates(main("missing"), [lineSynced]);
    expect(updates).toHaveLength(0);
  });

  it("handles a mix of target ids, converting only the line-synced ones", () => {
    const updates = computeSplitIntoWordsUpdates(main("L1", "L2", "L3"), [lineSynced, wordSynced, anotherSynced]);
    expect(updates.map((u) => u.id).sort()).toEqual(["L1", "L3"]);
  });
});

describe("computeSplitSelections", () => {
  it("produces a word selection per converted word, indexed against effective lines", () => {
    const updates = computeSplitIntoWordsUpdates(main("L1"), [lineSynced]);
    const selections = computeSplitSelections(updates, [lineSynced]);
    expect(selections.length).toBe(updates[0].updates.words?.length);
    expect(selections.every((s) => s.lineId === "L1" && s.lineIndex === 0 && s.type === "word")).toBe(true);
  });

  it("returns no selections when an update id is absent from the effective lines", () => {
    const updates = computeSplitIntoWordsUpdates(main("L1"), [lineSynced]);
    const selections = computeSplitSelections(updates, [anotherSynced]);
    expect(selections).toHaveLength(0);
  });
});

describe("splitLinesIntoWords (store-mutating)", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useProjectStore.getState().clearHistory();
    useTimelineStore.getState().clearSelection();
  });

  it("converts a single line-synced row to word-synced and selects its words", () => {
    useProjectStore.setState({ lines: [{ ...lineSynced }] });
    const effective = getEffectiveLines(useProjectStore.getState().lines);

    splitLinesIntoWords(main("L1"), effective);

    const after = useProjectStore.getState().lines[0];
    expect(after.words?.length).toBeGreaterThan(0);
    expect(after.begin).toBeUndefined();
    expect(after.end).toBeUndefined();
    expect(useTimelineStore.getState().selectedWords.length).toBe(after.words?.length);
  });

  it("converts multiple line-synced rows in one history step", () => {
    useProjectStore.setState({ lines: [{ ...lineSynced }, { ...anotherSynced }] });
    const effective = getEffectiveLines(useProjectStore.getState().lines);

    splitLinesIntoWords(main("L1", "L3"), effective);

    const after = useProjectStore.getState().lines;
    expect(after.find((l) => l.id === "L1")?.words?.length).toBeGreaterThan(0);
    expect(after.find((l) => l.id === "L3")?.words?.length).toBeGreaterThan(0);
  });

  it("leaves a word-synced row untouched and selects nothing", () => {
    useProjectStore.setState({ lines: [{ ...wordSynced }] });
    const effective = getEffectiveLines(useProjectStore.getState().lines);

    splitLinesIntoWords(main("L2"), effective);

    expect(useProjectStore.getState().lines[0].words).toEqual(wordSynced.words);
    expect(useTimelineStore.getState().selectedWords).toHaveLength(0);
  });
});

describe("computeSplitIntoWordsUpdates · background track", () => {
  it("splits a single sentence-long bg word evenly across its span", () => {
    const updates = computeSplitIntoWordsUpdates(bg("L4"), [sentenceBg]);
    expect(updates).toHaveLength(1);
    expect(updates[0].updates.backgroundWords).toEqual([
      { text: "ooh ", begin: 1, end: 2 },
      { text: "yeah ", begin: 2, end: 3 },
      { text: "baby", begin: 3, end: 4 },
    ]);
    expect(updates[0].updates.backgroundText).toBe("ooh yeah baby");
    expect(updates[0].updates.backgroundTextSource).toBe("manual");
    expect("words" in updates[0].updates).toBe(false);
  });

  it("splits only the multi-word bg word and leaves its neighbours' timing alone", () => {
    const line: LyricLine = {
      ...sentenceBg,
      backgroundText: "ah ooh yeah",
      backgroundWords: [
        { text: "ah ", begin: 0, end: 1 },
        { text: "ooh yeah", begin: 1, end: 3 },
      ],
    };
    const updates = computeSplitIntoWordsUpdates(bg("L4"), [line]);
    expect(updates[0].updates.backgroundWords).toEqual([
      { text: "ah ", begin: 0, end: 1 },
      { text: "ooh ", begin: 1, end: 2 },
      { text: "yeah", begin: 2, end: 3 },
    ]);
  });

  it("does not touch the bg track when only the main track is targeted", () => {
    expect(computeSplitIntoWordsUpdates(main("L4"), [sentenceBg])).toHaveLength(0);
  });

  it("targets main and bg together when both are selected on a line-synced line", () => {
    const line: LyricLine = {
      id: "L5",
      text: "one two",
      agentId: "v1",
      begin: 0,
      end: 2,
      backgroundText: "ooh ah",
      backgroundWords: [{ text: "ooh ah", begin: 0, end: 2 }],
    };
    const updates = computeSplitIntoWordsUpdates([...main("L5"), ...bg("L5")], [line]);
    expect(updates).toHaveLength(1);
    expect(updates[0].updates.words?.map((w) => w.text)).toEqual(["one ", "two"]);
    expect(updates[0].updates.backgroundWords?.map((w) => w.text)).toEqual(["ooh ", "ah"]);
  });

  describe("edge cases", () => {
    it("skips a bg track that is already one word per word", () => {
      const line: LyricLine = {
        ...sentenceBg,
        backgroundWords: [
          { text: "ooh ", begin: 1, end: 2 },
          { text: "yeah", begin: 2, end: 3 },
        ],
      };
      expect(computeSplitIntoWordsUpdates(bg("L4"), [line])).toHaveLength(0);
    });

    it("skips a single-word bg", () => {
      const line: LyricLine = {
        ...sentenceBg,
        backgroundText: "ooh",
        backgroundWords: [{ text: "ooh", begin: 1, end: 2 }],
      };
      expect(computeSplitIntoWordsUpdates(bg("L4"), [line])).toHaveLength(0);
    });

    it("skips a line with untimed bg text only", () => {
      const line: LyricLine = { id: "L6", text: "x", agentId: "v1", backgroundText: "ooh yeah" };
      expect(computeSplitIntoWordsUpdates(bg("L6"), [line])).toHaveLength(0);
    });

    it("keeps a trailing space on the last split word when the source word had one", () => {
      const line: LyricLine = {
        ...sentenceBg,
        backgroundWords: [
          { text: "ooh yeah ", begin: 1, end: 3 },
          { text: "baby", begin: 3, end: 4 },
        ],
      };
      const words = computeSplitIntoWordsUpdates(bg("L4"), [line])[0].updates.backgroundWords;
      expect(words?.map((w) => w.text)).toEqual(["ooh ", "yeah ", "baby"]);
    });

    it("emits one update per line even when several bg words on it are selected", () => {
      expect(computeSplitIntoWordsUpdates([...bg("L4"), ...bg("L4")], [sentenceBg])).toHaveLength(1);
    });
  });

  describe("invariants", () => {
    it("does not mutate the input line", () => {
      const snapshot = structuredClone(sentenceBg);
      computeSplitIntoWordsUpdates(bg("L4"), [sentenceBg]);
      expect(sentenceBg).toEqual(snapshot);
    });
  });
});

describe("computeSplitSelections · background track", () => {
  it("selects the new bg words on the bg track", () => {
    const updates = computeSplitIntoWordsUpdates(bg("L4"), [sentenceBg]);
    const selections = computeSplitSelections(updates, [sentenceBg]);
    expect(selections).toEqual([
      { lineId: "L4", lineIndex: 0, wordIndex: 0, type: "bg" },
      { lineId: "L4", lineIndex: 0, wordIndex: 1, type: "bg" },
      { lineId: "L4", lineIndex: 0, wordIndex: 2, type: "bg" },
    ]);
  });
});

describe("splitLinesIntoWords · regressions", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useProjectStore.getState().clearHistory();
    useTimelineStore.getState().clearSelection();
  });

  it("regression: W splits a bg sentence typed into one placeholder word", () => {
    useProjectStore.setState({ lines: [structuredClone(sentenceBg)] });
    const effective = getEffectiveLines(useProjectStore.getState().lines);

    splitLinesIntoWords(bg("L4"), effective);

    const after = useProjectStore.getState().lines[0];
    expect(after.backgroundWords?.map((w) => w.text)).toEqual(["ooh ", "yeah ", "baby"]);
    expect(after.words).toEqual(sentenceBg.words);
    expect(useTimelineStore.getState().selectedWords.every((s) => s.type === "bg")).toBe(true);
    expect(useTimelineStore.getState().selectedWords).toHaveLength(3);
  });
});
