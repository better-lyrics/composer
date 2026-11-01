import { timeRangeResolver } from "@/domain/group/shared-timing";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { shiftLineTiming } from "@/domain/line/shift";
import type { WordSelection } from "@/domain/selection/model";
import { commitGesture } from "@/domain/sync/commit-gesture";
import { clampBoundaryTime } from "@/domain/word/boundary";
import { boundsOverlap } from "@/domain/word/overlap";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord } from "@/test/factories";
import { stretchSelections } from "@/views/timeline/stretch-selection";
import { nudgeSelectedWords } from "@/views/timeline/utils";
import { beforeEach, describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const DURATION = 20;
const MIN_WORD_DURATION = 0.05;
const INSTANCE_STARTS = [2, 10, 17.5];
const SOURCE_INSTANCE = 1;

function chorusLines(instanceIdx: number): LyricLine[] {
  const start = INSTANCE_STARTS[instanceIdx];
  return [
    createLine({
      id: `a${instanceIdx}`,
      text: "I want",
      groupId: "g1",
      instanceIdx,
      templateLineIdx: 0,
      words: [
        createWord({ text: "I ", begin: start, end: start + 0.4 }),
        createWord({ text: "want", begin: start + 0.5, end: start + 1 }),
      ],
      backgroundText: "oh",
      backgroundWords: [createWord({ text: "oh", begin: start + 0.2, end: start + 0.8 })],
    }),
    createLine({
      id: `b${instanceIdx}`,
      text: "you now",
      groupId: "g1",
      instanceIdx,
      templateLineIdx: 1,
      words: [
        createWord({ text: "you ", begin: start + 1.2, end: start + 1.6 }),
        createWord({ text: "now", begin: start + 1.7, end: start + 2.2 }),
      ],
    }),
  ];
}

function seedSong(): void {
  const verse = createLine({ id: "x", text: "hey", words: [createWord({ text: "hey", begin: 6, end: 7 })] });
  useProjectStore.setState({
    lines: [...chorusLines(0), verse, ...chorusLines(1), ...chorusLines(2)],
    groups: [createGroup({ id: "g1", sharesTiming: true })],
  });
}

// -- Helpers ------------------------------------------------------------------

const store = () => useProjectStore.getState();
const lineById = (id: string): LyricLine => {
  const line = store().lines.find((candidate) => candidate.id === id);
  if (!line) throw new Error(`missing line ${id}`);
  return line;
};
const rangeOf = () => timeRangeResolver(store().lines, store().groups, DURATION);

function commit(updates: LineUpdate[]): void {
  store().updateLinesWithHistory(updates, { deriveText: false, propagateToSiblings: false });
}

function selectWords(lineId: string, count: number): WordSelection[] {
  return Array.from({ length: count }, (_, wordIndex) => ({ lineId, lineIndex: 0, wordIndex, type: "word" as const }));
}

function expectTrackClean(track: readonly WordTiming[] | undefined, label: string): void {
  if (!track) return;
  track.forEach((word, index) => {
    expect(word.begin, `${label} word ${index} starts inside the song`).toBeGreaterThanOrEqual(0);
    expect(word.end, `${label} word ${index} ends inside the song`).toBeLessThanOrEqual(DURATION);
    if (index > 0)
      expect(boundsOverlap(track[index - 1], word), `${label} words ${index - 1} and ${index}`).toBe(false);
  });
}

function expectNoOverlapInSharedInstances(): void {
  for (const line of store().lines.filter((candidate) => candidate.groupId === "g1")) {
    expectTrackClean(line.words, `${line.id} main`);
    expectTrackClean(line.backgroundWords, `${line.id} background`);
  }
}

function expectCopiesFollowSource(templateLine: "a" | "b"): void {
  const source = lineById(`${templateLine}${SOURCE_INSTANCE}`).words ?? [];
  for (const instanceIdx of [0, 2]) {
    const offset = INSTANCE_STARTS[instanceIdx] - INSTANCE_STARTS[SOURCE_INSTANCE];
    const copy = lineById(`${templateLine}${instanceIdx}`).words ?? [];
    copy.forEach((word, index) => expect(word.begin).toBeCloseTo(source[index].begin + offset, 6));
  }
}

// -- Tests --------------------------------------------------------------------

describe("shared timing edits leave no overlap in any placed instance", () => {
  beforeEach(seedSong);

  it("word nudge", () => {
    const { updates } = nudgeSelectedWords(store().lines, selectWords("a1", 2), -50, rangeOf());
    commit(updates);

    expect(lineById("a1").words?.[0].begin).toBe(8);
    expectCopiesFollowSource("a");
    expectNoOverlapInSharedInstances();
  });

  it("boundary drag", () => {
    const words = lineById("b1").words ?? [];
    const end = clampBoundaryTime({
      words,
      wordIndex: words.length - 1,
      edge: "end",
      time: 50,
      minDuration: MIN_WORD_DURATION,
      rollNeighbour: false,
      range: rangeOf()(lineById("b1")),
    });
    commit([
      {
        id: "b1",
        updates: { words: words.map((word, index) => (index === words.length - 1 ? { ...word, end } : word)) },
      },
    ]);

    expect(lineById("b1").words?.at(-1)?.end).toBe(12.5);
    expectCopiesFollowSource("b");
    expectNoOverlapInSharedInstances();
  });

  it("stretch", () => {
    const selection = [...selectWords("a1", 2), ...selectWords("b1", 2)];
    const { updates, appliedFactor } = stretchSelections(store().lines, selection, 10, {
      rangeOf: rangeOf(),
      minWordDuration: MIN_WORD_DURATION,
    });
    commit(updates);

    expect(appliedFactor).toBeCloseTo((12.5 - 10) / 2.2, 6);
    expectCopiesFollowSource("a");
    expectCopiesFollowSource("b");
    expectNoOverlapInSharedInstances();
  });

  it("line shift", () => {
    const line = lineById("a1");
    commit([{ id: line.id, updates: shiftLineTiming(line, -50, rangeOf()(line)) }]);

    expect(lineById("a1").words?.[0].begin).toBe(8);
    expectCopiesFollowSource("a");
    expectNoOverlapInSharedInstances();
  });

  it("sync gesture closing time", () => {
    const gesture = commitGesture(store().lines, "tap-word", {
      cursor: { lineIndex: 3, wordIndex: 0 },
      jumped: false,
      time: 6.5,
      defaultWordDuration: 0.3,
      groups: store().groups,
    });
    if (!gesture) throw new Error("tap produced no commit");
    commit(gesture.lineUpdates);

    expect(lineById("a1").words?.[0].begin).toBe(8);
    expect(lineById("x").words?.[0].end).toBe(8);
    expectCopiesFollowSource("a");
    expectNoOverlapInSharedInstances();
  });
});
