/**
 * @vitest-environment node
 */
import { type LyricLine, useProjectStore } from "@/stores/project";
import { getSyllablePositions } from "@/utils/syllable-groups";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

function seedMainLine(overrides: Partial<LyricLine> = {}): LyricLine {
  return {
    id: "line-1",
    text: "ev er y world",
    agentId: "v1",
    words: [
      { text: "ev ", begin: 0, end: 0.3 },
      { text: "er ", begin: 0.3, end: 0.6 },
      { text: "y ", begin: 0.6, end: 0.9 },
      { text: "world", begin: 0.9, end: 1.5 },
    ],
    ...overrides,
  };
}

// -- mergeWordsIntoSyllableGroup ----------------------------------------------

describe("mergeWordsIntoSyllableGroup", () => {
  it("stamps a shared syllableGroupId on a contiguous main-track selection", () => {
    useProjectStore.getState().setLines([seedMainLine()]);

    useProjectStore.getState().mergeWordsIntoSyllableGroup("line-1", "words", [0, 1, 2]);

    const line = useProjectStore.getState().lines[0];
    const words = line.words ?? [];
    expect(words[0].syllableGroupId).toBeDefined();
    expect(words[0].syllableGroupId).toBe(words[1].syllableGroupId);
    expect(words[1].syllableGroupId).toBe(words[2].syllableGroupId);
    expect(words[3].syllableGroupId).toBeUndefined();
  });

  it("strips internal trailing spaces and preserves the group-last trailing space when more words follow", () => {
    useProjectStore.getState().setLines([seedMainLine()]);

    useProjectStore.getState().mergeWordsIntoSyllableGroup("line-1", "words", [0, 1, 2]);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.map((w) => w.text)).toEqual(["ev", "er", "y ", "world"]);
  });

  it("strips all trailing spaces when the merged group is line-last", () => {
    useProjectStore.getState().setLines([
      {
        id: "line-1",
        text: "ev er y",
        agentId: "v1",
        words: [
          { text: "ev ", begin: 0, end: 0.3 },
          { text: "er ", begin: 0.3, end: 0.6 },
          { text: "y", begin: 0.6, end: 0.9 },
        ],
      },
    ]);

    useProjectStore.getState().mergeWordsIntoSyllableGroup("line-1", "words", [0, 1, 2]);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.map((w) => w.text)).toEqual(["ev", "er", "y"]);
  });

  it("renders the merged group as first/middle/last via getSyllablePositions", () => {
    useProjectStore.getState().setLines([seedMainLine()]);

    useProjectStore.getState().mergeWordsIntoSyllableGroup("line-1", "words", [0, 1, 2]);

    const line = useProjectStore.getState().lines[0];
    expect(getSyllablePositions(line.words ?? [])).toEqual(["first", "middle", "last", "none"]);
  });

  it("is a no-op when fewer than two indices are passed", () => {
    useProjectStore.getState().setLines([seedMainLine()]);
    const beforeIndex = useProjectStore.getState().historyIndex;

    useProjectStore.getState().mergeWordsIntoSyllableGroup("line-1", "words", [0]);
    useProjectStore.getState().mergeWordsIntoSyllableGroup("line-1", "words", []);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.every((w) => w.syllableGroupId === undefined)).toBe(true);
    expect(useProjectStore.getState().historyIndex).toBe(beforeIndex);
  });

  it("is a no-op when the selection is non-contiguous", () => {
    useProjectStore.getState().setLines([seedMainLine()]);

    useProjectStore.getState().mergeWordsIntoSyllableGroup("line-1", "words", [0, 2]);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.every((w) => w.syllableGroupId === undefined)).toBe(true);
  });

  it("works on the background track", () => {
    useProjectStore.getState().setLines([
      {
        id: "line-1",
        text: "main",
        agentId: "v1",
        words: [{ text: "main", begin: 0, end: 1 }],
        backgroundWords: [
          { text: "ah ", begin: 1, end: 1.2 },
          { text: "ooh", begin: 1.2, end: 1.5 },
        ],
        backgroundText: "ah ooh",
      },
    ]);

    useProjectStore.getState().mergeWordsIntoSyllableGroup("line-1", "backgroundWords", [0, 1]);

    const line = useProjectStore.getState().lines[0];
    const bg = line.backgroundWords ?? [];
    expect(bg[0].syllableGroupId).toBeDefined();
    expect(bg[0].syllableGroupId).toBe(bg[1].syllableGroupId);
    expect(bg.map((w) => w.text)).toEqual(["ah", "ooh"]);
  });

  it("is undoable", () => {
    useProjectStore.getState().setLines([seedMainLine()]);
    const before = useProjectStore.getState().lines[0].words?.map((w) => w.text);

    useProjectStore.getState().mergeWordsIntoSyllableGroup("line-1", "words", [0, 1, 2]);
    expect(useProjectStore.getState().canUndo()).toBe(true);

    useProjectStore.getState().undo();
    const restored = useProjectStore.getState().lines[0];
    expect(restored.words?.map((w) => w.text)).toEqual(before);
    expect(restored.words?.every((w) => w.syllableGroupId === undefined)).toBe(true);
  });

  it("overwrites any prior syllableGroupIds in the selection with the new shared id", () => {
    useProjectStore.getState().setLines([
      {
        id: "line-1",
        text: "ev er y",
        agentId: "v1",
        words: [
          { text: "ev", begin: 0, end: 0.3, syllableGroupId: "old1" },
          { text: "er", begin: 0.3, end: 0.6, syllableGroupId: "old2" },
          { text: "y", begin: 0.6, end: 0.9 },
        ],
      },
    ]);

    useProjectStore.getState().mergeWordsIntoSyllableGroup("line-1", "words", [0, 1, 2]);

    const line = useProjectStore.getState().lines[0];
    const ids = line.words?.map((w) => w.syllableGroupId);
    expect(ids?.[0]).toBeDefined();
    expect(ids?.[0]).not.toBe("old1");
    expect(ids?.[0]).not.toBe("old2");
    expect(ids?.[0]).toBe(ids?.[1]);
    expect(ids?.[1]).toBe(ids?.[2]);
  });

  it("ignores out-of-bounds indices", () => {
    useProjectStore.getState().setLines([seedMainLine()]);
    const beforeIndex = useProjectStore.getState().historyIndex;

    useProjectStore.getState().mergeWordsIntoSyllableGroup("line-1", "words", [10, 11]);

    expect(useProjectStore.getState().historyIndex).toBe(beforeIndex);
  });

  it("ignores a missing line", () => {
    useProjectStore.getState().setLines([seedMainLine()]);
    const beforeIndex = useProjectStore.getState().historyIndex;

    useProjectStore.getState().mergeWordsIntoSyllableGroup("missing", "words", [0, 1]);

    expect(useProjectStore.getState().historyIndex).toBe(beforeIndex);
  });
});
