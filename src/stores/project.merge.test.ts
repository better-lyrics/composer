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

  it("strips a stray trailing space from the merged group's last syllable when it is line-last", () => {
    useProjectStore.getState().setLines([
      {
        id: "line-1",
        text: "ev er y ",
        agentId: "v1",
        words: [
          { text: "ev ", begin: 0, end: 0.3 },
          { text: "er ", begin: 0.3, end: 0.6 },
          { text: "y ", begin: 0.6, end: 0.9 },
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

  it("keeps backgroundText in sync with backgroundWords after a bg merge", () => {
    useProjectStore.getState().setLines([
      {
        id: "line-1",
        text: "main",
        agentId: "v1",
        words: [{ text: "main", begin: 0, end: 1 }],
        backgroundWords: [
          { text: "ev ", begin: 1, end: 1.2 },
          { text: "er ", begin: 1.2, end: 1.4 },
          { text: "y ", begin: 1.4, end: 1.6 },
        ],
        backgroundText: "ev er y ",
      },
    ]);

    useProjectStore.getState().mergeWordsIntoSyllableGroup("line-1", "backgroundWords", [0, 1, 2]);

    const line = useProjectStore.getState().lines[0];
    const bgJoined = (line.backgroundWords ?? []).map((w) => w.text).join("");
    expect(line.backgroundText).toBe(bgJoined);
  });

  it("keeps text in sync with words after a main-track merge", () => {
    useProjectStore.getState().setLines([seedMainLine()]);

    useProjectStore.getState().mergeWordsIntoSyllableGroup("line-1", "words", [0, 1, 2]);

    const line = useProjectStore.getState().lines[0];
    const joined = (line.words ?? []).map((w) => w.text).join("");
    expect(line.text).toBe(joined);
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

  it("preserves internal timing gaps between merged syllables", () => {
    useProjectStore.getState().setLines([
      {
        id: "line-1",
        text: "ev er y",
        agentId: "v1",
        words: [
          { text: "ev", begin: 0, end: 0.2 },
          { text: "er", begin: 0.5, end: 0.7 },
          { text: "y", begin: 1.0, end: 1.3 },
        ],
      },
    ]);

    useProjectStore.getState().mergeWordsIntoSyllableGroup("line-1", "words", [0, 1, 2]);

    const words = useProjectStore.getState().lines[0].words ?? [];
    expect(words[0].begin).toBe(0);
    expect(words[0].end).toBe(0.2);
    expect(words[1].begin).toBe(0.5);
    expect(words[1].end).toBe(0.7);
    expect(words[2].begin).toBe(1.0);
    expect(words[2].end).toBe(1.3);
  });

  it("ignores a missing line", () => {
    useProjectStore.getState().setLines([seedMainLine()]);
    const beforeIndex = useProjectStore.getState().historyIndex;

    useProjectStore.getState().mergeWordsIntoSyllableGroup("missing", "words", [0, 1]);

    expect(useProjectStore.getState().historyIndex).toBe(beforeIndex);
  });
});

// -- partial-merge auto-expand -----------------------------------------------

describe("mergeWordsIntoSyllableGroup · partial-merge auto-expand", () => {
  it("auto-expands a partial selection to include all groupmates", () => {
    useProjectStore.getState().setLines([
      {
        id: "line-1",
        text: "everything",
        agentId: "v1",
        words: [
          { text: "ev", begin: 0, end: 0.2, syllableGroupId: "gA" },
          { text: "er", begin: 0.2, end: 0.4, syllableGroupId: "gA" },
          { text: "y", begin: 0.4, end: 0.6, syllableGroupId: "gA" },
          { text: "thing", begin: 0.6, end: 1, syllableGroupId: "gA" },
        ],
      },
    ]);

    useProjectStore.getState().mergeWordsIntoSyllableGroup("line-1", "words", [0, 1, 2]);

    const words = useProjectStore.getState().lines[0].words ?? [];
    const newId = words[0].syllableGroupId;
    expect(newId).toBeDefined();
    expect(newId).not.toBe("gA");
    expect(words.every((w) => w.syllableGroupId === newId)).toBe(true);
  });

  it("auto-expands a selection that spans a group boundary plus extra words", () => {
    useProjectStore.getState().setLines([
      {
        id: "line-1",
        text: "every world",
        agentId: "v1",
        words: [
          { text: "ev", begin: 0, end: 0.2, syllableGroupId: "gA" },
          { text: "er", begin: 0.2, end: 0.4, syllableGroupId: "gA" },
          { text: "y ", begin: 0.4, end: 0.6, syllableGroupId: "gA" },
          { text: "world", begin: 0.6, end: 1 },
        ],
      },
    ]);

    useProjectStore.getState().mergeWordsIntoSyllableGroup("line-1", "words", [2, 3]);

    const words = useProjectStore.getState().lines[0].words ?? [];
    const newId = words[0].syllableGroupId;
    expect(newId).toBeDefined();
    expect(newId).not.toBe("gA");
    expect(words.every((w) => w.syllableGroupId === newId)).toBe(true);
  });
});

// -- linked-sibling propagation ----------------------------------------------

describe("mergeWordsIntoSyllableGroup · linked propagation", () => {
  function seedTwoLinkedInstances() {
    useProjectStore.getState().addGroup({ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 });
    useProjectStore.getState().setLines([
      {
        id: "a0",
        text: "ev er y",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [
          { text: "ev ", begin: 0, end: 0.3 },
          { text: "er ", begin: 0.3, end: 0.6 },
          { text: "y", begin: 0.6, end: 0.9 },
        ],
      },
      {
        id: "a1",
        text: "ev er y",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [
          { text: "ev ", begin: 10, end: 10.3 },
          { text: "er ", begin: 10.3, end: 10.6 },
          { text: "y", begin: 10.6, end: 10.9 },
        ],
      },
    ]);
  }

  it("fans out to linked siblings, stamping a fresh groupId per line", () => {
    seedTwoLinkedInstances();
    useProjectStore.getState().mergeWordsIntoSyllableGroup("a0", "words", [0, 1, 2]);

    const lines = useProjectStore.getState().lines;
    const a0 = lines.find((l) => l.id === "a0");
    const a1 = lines.find((l) => l.id === "a1");

    const a0Ids = a0?.words?.map((w) => w.syllableGroupId);
    const a1Ids = a1?.words?.map((w) => w.syllableGroupId);
    expect(a0Ids?.every((id) => id !== undefined && id === a0Ids[0])).toBe(true);
    expect(a1Ids?.every((id) => id !== undefined && id === a1Ids[0])).toBe(true);
    expect(a0Ids?.[0]).not.toBe(a1Ids?.[0]);
  });

  it("skips siblings with mismatched word counts", () => {
    seedTwoLinkedInstances();
    useProjectStore.setState((state) => ({
      lines: state.lines.map((l) =>
        l.id === "a1"
          ? {
              ...l,
              words: [
                { text: "ev ", begin: 10, end: 10.3 },
                { text: "ery", begin: 10.3, end: 10.9 },
              ],
            }
          : l,
      ),
    }));
    useProjectStore.getState().mergeWordsIntoSyllableGroup("a0", "words", [0, 1, 2]);

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(a1?.words?.every((w) => w.syllableGroupId === undefined)).toBe(true);
  });

  it("skips detached siblings", () => {
    seedTwoLinkedInstances();
    useProjectStore.setState((state) => ({
      lines: state.lines.map((l) => (l.id === "a1" ? { ...l, detached: true } : l)),
    }));
    useProjectStore.getState().mergeWordsIntoSyllableGroup("a0", "words", [0, 1, 2]);

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(a1?.words?.every((w) => w.syllableGroupId === undefined)).toBe(true);
  });
});

// -- mergeSyllableGroupIntoWord ------------------------------------------------

describe("mergeSyllableGroupIntoWord", () => {
  function seedGroupedLine(): LyricLine {
    return {
      id: "line-1",
      text: "beautiful",
      agentId: "v1",
      words: [
        { text: "beau", begin: 0, end: 0.3, syllableGroupId: "g1" },
        { text: "ti", begin: 0.3, end: 0.6, syllableGroupId: "g1" },
        { text: "ful", begin: 0.6, end: 0.9, syllableGroupId: "g1" },
      ],
    };
  }

  it("collapses a syllable group into one word", () => {
    useProjectStore.getState().setLines([seedGroupedLine()]);
    useProjectStore.getState().mergeSyllableGroupIntoWord("line-1", "words", [0, 1, 2]);
    const words = useProjectStore.getState().lines[0].words ?? [];
    expect(words).toHaveLength(1);
    expect(words[0].text).toBe("beautiful");
    expect(words[0].begin).toBe(0);
    expect(words[0].end).toBe(0.9);
    expect(words[0].syllableGroupId).toBeUndefined();
  });

  it("collapses the whole group when only one syllable is selected", () => {
    useProjectStore.getState().setLines([seedGroupedLine()]);
    useProjectStore.getState().mergeSyllableGroupIntoWord("line-1", "words", [1]);
    const words = useProjectStore.getState().lines[0].words ?? [];
    expect(words.map((w) => w.text)).toEqual(["beautiful"]);
  });

  it("syncs line.text to the collapsed words", () => {
    useProjectStore.getState().setLines([seedGroupedLine()]);
    useProjectStore.getState().mergeSyllableGroupIntoWord("line-1", "words", [0]);
    expect(useProjectStore.getState().lines[0].text).toBe("beautiful");
  });

  it("leaves non-grouped words untouched and is a no-op on a non-grouped selection", () => {
    useProjectStore.getState().setLines([seedMainLine()]);
    const before = useProjectStore.getState().lines[0];
    useProjectStore.getState().mergeSyllableGroupIntoWord("line-1", "words", [0, 1]);
    expect(useProjectStore.getState().lines[0]).toBe(before);
  });

  it("collapses two groups touched by one multi-selection", () => {
    useProjectStore.getState().setLines([
      {
        id: "line-1",
        text: "abcd",
        agentId: "v1",
        words: [
          { text: "a", begin: 0, end: 0.1, syllableGroupId: "g1" },
          { text: "b", begin: 0.1, end: 0.2, syllableGroupId: "g1" },
          { text: "c", begin: 0.2, end: 0.3, syllableGroupId: "g2" },
          { text: "d", begin: 0.3, end: 0.4, syllableGroupId: "g2" },
        ],
      },
    ]);
    useProjectStore.getState().mergeSyllableGroupIntoWord("line-1", "words", [0, 3]);
    expect((useProjectStore.getState().lines[0].words ?? []).map((w) => w.text)).toEqual(["ab", "cd"]);
  });

  it("works on the background track and syncs backgroundText", () => {
    useProjectStore.getState().setLines([
      {
        id: "line-1",
        text: "main",
        agentId: "v1",
        words: [{ text: "main", begin: 0, end: 1 }],
        backgroundWords: [
          { text: "oo", begin: 1, end: 1.2, syllableGroupId: "b1" },
          { text: "oh", begin: 1.2, end: 1.5, syllableGroupId: "b1" },
        ],
        backgroundText: "ooh",
      },
    ]);
    useProjectStore.getState().mergeSyllableGroupIntoWord("line-1", "backgroundWords", [0, 1]);
    const line = useProjectStore.getState().lines[0];
    expect((line.backgroundWords ?? []).map((w) => w.text)).toEqual(["oooh"]);
    expect(line.backgroundText).toBe("oooh");
  });

  it("is undoable", () => {
    useProjectStore.getState().setLines([seedGroupedLine()]);
    useProjectStore.getState().mergeSyllableGroupIntoWord("line-1", "words", [0, 1, 2]);
    expect(useProjectStore.getState().canUndo()).toBe(true);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines[0].words ?? []).toHaveLength(3);
  });
});

describe("mergeSyllableGroupIntoWord · linked propagation", () => {
  function seedTwoLinkedInstances() {
    useProjectStore.getState().addGroup({ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 });
    useProjectStore.getState().setLines([
      {
        id: "a0",
        text: "every",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [
          { text: "ev", begin: 0, end: 0.3, syllableGroupId: "g_a0" },
          { text: "er", begin: 0.3, end: 0.6, syllableGroupId: "g_a0" },
          { text: "y", begin: 0.6, end: 1, syllableGroupId: "g_a0" },
        ],
      },
      {
        id: "a1",
        text: "every",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [
          { text: "ev", begin: 10, end: 10.3, syllableGroupId: "g_a1" },
          { text: "er", begin: 10.3, end: 10.6, syllableGroupId: "g_a1" },
          { text: "y", begin: 10.6, end: 11, syllableGroupId: "g_a1" },
        ],
      },
    ]);
  }

  it("collapses the group on every linked sibling", () => {
    seedTwoLinkedInstances();
    useProjectStore.getState().mergeSyllableGroupIntoWord("a0", "words", [0, 1, 2]);

    const lines = useProjectStore.getState().lines;
    const a0 = lines.find((l) => l.id === "a0");
    const a1 = lines.find((l) => l.id === "a1");
    expect(a0?.words?.map((w) => w.text)).toEqual(["every"]);
    expect(a1?.words?.map((w) => w.text)).toEqual(["every"]);
  });
});

// -- snapSyllablesFlush -------------------------------------------------------

describe("snapSyllablesFlush", () => {
  function seedGappedGroupLine(): LyricLine {
    return {
      id: "line-1",
      text: "beautiful",
      agentId: "v1",
      words: [
        { text: "beau", begin: 0, end: 0.3, syllableGroupId: "g1" },
        { text: "ti", begin: 0.5, end: 0.8, syllableGroupId: "g1" },
        { text: "ful", begin: 1.0, end: 1.3, syllableGroupId: "g1" },
      ],
    };
  }

  it("closes internal gaps by extending each earlier syllable's end to the next begin", () => {
    useProjectStore.getState().setLines([seedGappedGroupLine()]);

    useProjectStore.getState().snapSyllablesFlush("line-1", "words");

    const words = useProjectStore.getState().lines[0].words ?? [];
    expect(words[0].end).toBe(words[1].begin);
    expect(words[1].end).toBe(words[2].begin);
    expect(words[0].begin).toBe(0);
    expect(words[1].begin).toBe(0.5);
    expect(words[2].begin).toBe(1.0);
    expect(words[2].end).toBe(1.3);
  });

  it("is a no-op when the line has no syllable group", () => {
    useProjectStore.getState().setLines([seedMainLine()]);
    const before = useProjectStore.getState().lines[0];

    useProjectStore.getState().snapSyllablesFlush("line-1", "words");

    expect(useProjectStore.getState().lines[0]).toBe(before);
  });

  it("is a no-op when the syllable group is already flush", () => {
    useProjectStore.getState().setLines([
      {
        id: "line-1",
        text: "beautiful",
        agentId: "v1",
        words: [
          { text: "beau", begin: 0, end: 0.3, syllableGroupId: "g1" },
          { text: "ti", begin: 0.3, end: 0.6, syllableGroupId: "g1" },
          { text: "ful", begin: 0.6, end: 0.9, syllableGroupId: "g1" },
        ],
      },
    ]);
    const before = useProjectStore.getState().lines[0];

    useProjectStore.getState().snapSyllablesFlush("line-1", "words");

    expect(useProjectStore.getState().lines[0]).toBe(before);
  });

  it("works on the background track", () => {
    useProjectStore.getState().setLines([
      {
        id: "line-1",
        text: "main",
        agentId: "v1",
        words: [{ text: "main", begin: 0, end: 1 }],
        backgroundWords: [
          { text: "oo", begin: 1, end: 1.2, syllableGroupId: "b1" },
          { text: "oh", begin: 1.5, end: 1.7, syllableGroupId: "b1" },
        ],
        backgroundText: "oooh",
      },
    ]);

    useProjectStore.getState().snapSyllablesFlush("line-1", "backgroundWords");

    const bg = useProjectStore.getState().lines[0].backgroundWords ?? [];
    expect(bg[0].end).toBe(bg[1].begin);
    expect(bg[0].begin).toBe(1);
    expect(bg[1].begin).toBe(1.5);
  });

  it("does not touch a linked sibling", () => {
    useProjectStore.getState().addGroup({ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 });
    useProjectStore.getState().setLines([
      {
        id: "a0",
        text: "beautiful",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [
          { text: "beau", begin: 0, end: 0.3, syllableGroupId: "g_a0" },
          { text: "ti", begin: 0.5, end: 0.8, syllableGroupId: "g_a0" },
          { text: "ful", begin: 1.0, end: 1.3, syllableGroupId: "g_a0" },
        ],
      },
      {
        id: "a1",
        text: "beautiful",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [
          { text: "beau", begin: 10, end: 10.3, syllableGroupId: "g_a1" },
          { text: "ti", begin: 10.5, end: 10.8, syllableGroupId: "g_a1" },
          { text: "ful", begin: 11.0, end: 11.3, syllableGroupId: "g_a1" },
        ],
      },
    ]);
    const a1Before = useProjectStore.getState().lines.find((l) => l.id === "a1");

    useProjectStore.getState().snapSyllablesFlush("a0", "words");

    const lines = useProjectStore.getState().lines;
    const a0 = lines.find((l) => l.id === "a0");
    const a1 = lines.find((l) => l.id === "a1");
    const a0Words = a0?.words ?? [];
    expect(a0Words[0].end).toBe(a0Words[1].begin);
    expect(a0Words[1].end).toBe(a0Words[2].begin);
    expect(a1).toBe(a1Before);
  });

  it("is undoable", () => {
    useProjectStore.getState().setLines([seedGappedGroupLine()]);
    const before = useProjectStore.getState().lines[0].words?.map((w) => ({ begin: w.begin, end: w.end }));

    useProjectStore.getState().snapSyllablesFlush("line-1", "words");
    expect(useProjectStore.getState().canUndo()).toBe(true);

    useProjectStore.getState().undo();
    const restored = useProjectStore.getState().lines[0].words?.map((w) => ({ begin: w.begin, end: w.end }));
    expect(restored).toEqual(before);
  });
});
