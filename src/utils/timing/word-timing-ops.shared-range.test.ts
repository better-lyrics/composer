import { describe, expect, it } from "vitest";
import { retimeSyncWord } from "@/domain/commands/sync";
import { setWordBoundary } from "@/domain/commands/word-timing";
import type { LyricLine } from "@/domain/line/model";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import { addressAt } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine } from "@/test/factories";

const word = (text: string, begin: number, end: number) => ({ text, begin, end });

function chorus(id: string, instanceIdx: number, begin: number): LyricLine {
  return createLine({
    id,
    text: "I want",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [word("I ", begin, begin + 0.4), word("want", begin + 0.5, begin + 1)],
    backgroundText: "oh",
    backgroundWords: [word("oh", begin + 0.2, begin + 0.8)],
  });
}

function seed(sharesTiming: boolean): void {
  useProjectStore.setState({
    lines: [chorus("c0", 0, 3), chorus("c1", 1, 10)],
    groups: [createGroup({ id: "g1", ...(sharesTiming ? { sharesTiming: true } : {}) })],
  });
}

const store = () => useProjectStore.getState();
const lineById = (id: string) => store().lines.find((line) => line.id === id);
const wordAddress = (lineIdx: number, wordIdx: number) => {
  const address = addressAt(store().lines, store().lines[lineIdx].id, "word", wordIdx);
  if (!address) throw new Error("no word there");
  return address;
};

describe("word timing ops with a shared time range", () => {
  it("stops a first word nudge where the earliest instance reaches zero", () => {
    seed(true);

    useProjectStore
      .getState()
      .commit(
        retimeSyncWord(
          { lineId: store().lines[1].id, track: "word", wordIndex: 0 },
          "begin",
          { by: -5 },
          Number.POSITIVE_INFINITY,
        ),
      );

    expect(timedSyllables(mainTrack(lineById("c1")!))[0].begin).toBe(7);
    expect(timedSyllables(mainTrack(lineById("c0")!))[0].begin).toBe(0);
  });

  it("stops a first word set before the range", () => {
    seed(true);

    useProjectStore
      .getState()
      .commit(
        retimeSyncWord(
          { lineId: store().lines[1].id, track: "word", wordIndex: 0 },
          "begin",
          { to: 2 },
          Number.POSITIVE_INFINITY,
        ),
      );

    expect(timedSyllables(mainTrack(lineById("c1")!))[0].begin).toBe(7);
    expect(timedSyllables(mainTrack(lineById("c0")!))[0].begin).toBe(0);
  });

  it("stops a first background word at the start of the range", () => {
    seed(true);

    useProjectStore
      .getState()
      .commit(
        retimeSyncWord(
          { lineId: store().lines[1].id, track: "bg", wordIndex: 0 },
          "begin",
          { by: -5 },
          Number.POSITIVE_INFINITY,
        ),
      );

    expect(timedSyllables(backgroundTrack(lineById("c1")!))[0].begin).toBe(7);
    expect(timedSyllables(backgroundTrack(lineById("c0")!))[0].begin).toBe(0);
  });

  describe("regressions", () => {
    it("moves a first word of an old group to zero, as before", () => {
      seed(false);

      useProjectStore
        .getState()
        .commit(
          retimeSyncWord(
            { lineId: store().lines[1].id, track: "word", wordIndex: 0 },
            "begin",
            { by: -15 },
            Number.POSITIVE_INFINITY,
          ),
        );

      expect(timedSyllables(mainTrack(lineById("c1")!))[0].begin).toBe(0);
      expect(timedSyllables(mainTrack(lineById("c0")!))[0].begin).toBe(3);
    });

    it("keeps no end limit for a last word", () => {
      seed(true);

      useProjectStore
        .getState()
        .commit(
          retimeSyncWord(
            { lineId: store().lines[1].id, track: "word", wordIndex: 1 },
            "end",
            { by: 100 },
            Number.POSITIVE_INFINITY,
          ),
        );

      expect(timedSyllables(mainTrack(lineById("c1")!))[1].end).toBe(111);
      expect(timedSyllables(mainTrack(lineById("c0")!))[1].end).toBe(104);
    });
  });
});

describe("word timing ops with a song end", () => {
  const SONG_END = 12;

  it("stops a last word end where the latest instance reaches the song end", () => {
    seed(true);

    useProjectStore
      .getState()
      .commit(
        retimeSyncWord({ lineId: store().lines[0].id, track: "word", wordIndex: 1 }, "end", { by: 100 }, SONG_END),
      );

    expect(timedSyllables(mainTrack(lineById("c0")!))[1].end).toBe(5);
    expect(timedSyllables(mainTrack(lineById("c1")!))[1].end).toBe(12);
  });

  it("stops a last word set past the range", () => {
    seed(true);

    useProjectStore
      .getState()
      .commit(
        retimeSyncWord({ lineId: store().lines[0].id, track: "word", wordIndex: 1 }, "end", { to: 100 }, SONG_END),
      );

    expect(timedSyllables(mainTrack(lineById("c0")!))[1].end).toBe(5);
    expect(timedSyllables(mainTrack(lineById("c1")!))[1].end).toBe(12);
  });

  it("stops a last background word end where the latest instance reaches the song end", () => {
    seed(true);

    useProjectStore
      .getState()
      .commit(retimeSyncWord({ lineId: store().lines[0].id, track: "bg", wordIndex: 0 }, "end", { by: 100 }, SONG_END));

    expect(timedSyllables(backgroundTrack(lineById("c0")!))[0].end).toBe(5);
    expect(timedSyllables(backgroundTrack(lineById("c1")!))[0].end).toBe(12);
  });

  describe("edge cases", () => {
    it.each([0, Number.NaN])("treats a song length of %s as no song end", (duration) => {
      seed(true);

      useProjectStore
        .getState()
        .commit(
          retimeSyncWord({ lineId: store().lines[0].id, track: "word", wordIndex: 1 }, "end", { by: 100 }, duration),
        );

      expect(timedSyllables(mainTrack(lineById("c0")!))[1].end).toBe(104);
      expect(timedSyllables(mainTrack(lineById("c1")!))[1].end).toBe(111);
    });
  });

  describe("regressions", () => {
    it("moves a last word of an old group without touching its sibling", () => {
      seed(false);

      useProjectStore
        .getState()
        .commit(
          retimeSyncWord({ lineId: store().lines[0].id, track: "word", wordIndex: 1 }, "end", { by: 3 }, SONG_END),
        );

      expect(timedSyllables(mainTrack(lineById("c0")!))[1].end).toBe(7);
      expect(timedSyllables(mainTrack(lineById("c1")!))[1].end).toBe(11);
    });
  });
});

describe("setWordBoundary with a shared time range", () => {
  const setBoundary = (lineIdx: number, edge: "begin" | "end", wordIdx: number, time: number) =>
    store().commit(
      setWordBoundary({
        address: wordAddress(lineIdx, wordIdx),
        edge,
        time,
        minDuration: 0.05,
        rolling: false,
        syllablesFollowRolling: false,
        duration: 12,
      }),
    );

  it("stops a first word begin where the earliest instance reaches zero", () => {
    seed(true);

    setBoundary(1, "begin", 0, 1);

    expect(timedSyllables(mainTrack(lineById("c1")!))[0].begin).toBe(7);
    expect(timedSyllables(mainTrack(lineById("c0")!))[0].begin).toBe(0);
  });

  it("stops a last word end where the latest instance reaches the song end", () => {
    seed(true);

    setBoundary(0, "end", 1, 100);

    expect(timedSyllables(mainTrack(lineById("c0")!))[1].end).toBe(5);
    expect(timedSyllables(mainTrack(lineById("c1")!))[1].end).toBe(12);
  });

  describe("regressions", () => {
    it("stops a line of an old group at zero, as before", () => {
      seed(false);

      setBoundary(1, "begin", 0, -1);

      expect(timedSyllables(mainTrack(lineById("c1")!))[0].begin).toBe(0);
    });
  });
});
