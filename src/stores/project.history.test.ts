import { fieldUpdates } from "@/test/field-updates";
import { type LineFields, lineFromFields } from "@/domain/line/line-from-fields";
import { backgroundTrack, mainTrack, roleWords, timedSyllables } from "@/domain/line/track";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
/**
 * @vitest-environment node
 */
import { useProjectStore } from "@/stores/project";
import { MAX_HISTORY_SIZE } from "@/stores/project/history-helpers";
import { beforeEach, describe, expect, it } from "vitest";
import { pasteLyrics } from "@/domain/commands/edit-text";
import { removeSinger, replaceLyrics } from "@/domain/commands/lyrics-replace";
import { pasteLines } from "@/domain/commands/instance-rows";

function seedLine(id: string, overrides: Partial<LineFields> = {}): LyricLine {
  return lineFromFields({ id, text: "hello world", agentId: "v1", ...overrides });
}

function seedGroup(id: string, overrides: Partial<LinkGroup> = {}): LinkGroup {
  return { id, label: "Chorus", color: "#f472b6", templateVersion: 1, ...overrides };
}

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

// -- setLinesWithHistory and updateLinesWithHistory ----------------------------

describe("setLinesWithHistory", () => {
  it("pushes a history entry that undo restores", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a"), seedLine("b")] });
    const before = useProjectStore.getState().lines;

    useProjectStore
      .getState()
      .commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { agentId: "v2" }), seedLine("b")]));
    expect(mainTrack(useProjectStore.getState().lines[0]).agentId).toBe("v2");
    expect(useProjectStore.getState().canUndo()).toBe(true);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines).toEqual(before);
  });
});

describe("setLinesWithHistory groups", () => {
  it("commits lines and groups as one entry", () => {
    useProjectStore
      .getState()
      .commit(replaceLyrics([seedLine("a")], [seedGroup("g1")], useProjectStore.getState().agents));
    expect(useProjectStore.getState().groups).toHaveLength(1);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().groups).toHaveLength(0);
  });

  it("without a groups argument commits a lines-only entry and leaves existing groups untouched", () => {
    useProjectStore.getState().restoreLyrics({ groups: [seedGroup("g1")] });
    useProjectStore.getState().clearHistory();

    useProjectStore
      .getState()
      .commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { agentId: "v2" })]));

    expect(mainTrack(useProjectStore.getState().lines[0]).agentId).toBe("v2");
    expect(useProjectStore.getState().groups).toEqual([seedGroup("g1")]);
    expect(useProjectStore.getState().canUndo()).toBe(true);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().groups).toEqual([seedGroup("g1")]);
  });

  it("forwards an explicit empty groups array, replacing existing groups", () => {
    useProjectStore.getState().restoreLyrics({ groups: [seedGroup("g1")] });
    useProjectStore.getState().clearHistory();

    useProjectStore.getState().commit(replaceLyrics([seedLine("a")], [], useProjectStore.getState().agents));
    expect(useProjectStore.getState().groups).toEqual([]);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().groups).toEqual([seedGroup("g1")]);
  });

  it("reverts both lines and groups with a single undo, restores both with a single redo", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a")] });
    useProjectStore.getState().restoreLyrics({ groups: [seedGroup("g1")] });
    useProjectStore.getState().clearHistory();

    useProjectStore
      .getState()
      .commit(
        replaceLyrics(
          [seedLine("a", { agentId: "v2", groupId: "g2" }), seedLine("b")],
          [seedGroup("g2")],
          useProjectStore.getState().agents,
        ),
      );
    expect(useProjectStore.getState().lines).toHaveLength(2);
    expect(useProjectStore.getState().groups).toEqual([seedGroup("g2")]);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines).toHaveLength(1);
    expect(mainTrack(useProjectStore.getState().lines[0]).agentId).toBe("v1");
    expect(useProjectStore.getState().groups).toEqual([seedGroup("g1")]);

    useProjectStore.getState().redo();
    expect(useProjectStore.getState().lines).toHaveLength(2);
    expect(mainTrack(useProjectStore.getState().lines[0]).agentId).toBe("v2");
    expect(useProjectStore.getState().groups).toEqual([seedGroup("g2")]);
  });

  it("restores the previous groups exactly when undoing a groups replacement", () => {
    const initialGroups = [seedGroup("g1", { label: "Verse", color: "#aaa" }), seedGroup("g2")];
    useProjectStore.getState().restoreLyrics({ groups: initialGroups });
    useProjectStore.getState().clearHistory();

    useProjectStore
      .getState()
      .commit(
        replaceLyrics([seedLine("a")], [seedGroup("g3", { label: "Bridge" })], useProjectStore.getState().agents),
      );
    expect(useProjectStore.getState().groups).toEqual([seedGroup("g3", { label: "Bridge" })]);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().groups).toEqual(initialGroups);
  });

  it("still commits the lines argument correctly when groups is passed", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { agentId: "v1" })] });
    useProjectStore.getState().clearHistory();

    useProjectStore
      .getState()
      .commit(replaceLyrics([seedLine("a", { agentId: "v2" })], [seedGroup("g1")], useProjectStore.getState().agents));
    expect(mainTrack(useProjectStore.getState().lines[0]).agentId).toBe("v2");

    useProjectStore.getState().undo();
    expect(mainTrack(useProjectStore.getState().lines[0]).agentId).toBe("v1");
  });
});

describe("updateLinesWithHistory", () => {
  it("merges multiple line updates into one history step", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a"), seedLine("b"), seedLine("c")] });

    useProjectStore.getState().commit(
      pasteLines(
        fieldUpdates([
          { id: "a", updates: { agentId: "v2" } },
          { id: "c", updates: { agentId: "v3" } },
        ]),
      ),
    );

    expect(useProjectStore.getState().lines.map((l) => mainTrack(l).agentId)).toEqual(["v2", "v1", "v3"]);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines.map((l) => mainTrack(l).agentId)).toEqual(["v1", "v1", "v1"]);

    useProjectStore.getState().redo();
    expect(useProjectStore.getState().lines.map((l) => mainTrack(l).agentId)).toEqual(["v2", "v1", "v3"]);
  });

  it("snapshots a pending non-history edit before a subsequent history-aware update so undo lands on the typed state", () => {
    // Reproduces issue #33 follow-up: typing in Edit (uses setLines, no
    // history) followed by clicking Place (updateLineWithHistory) used to
    // make Cmd+Z drop the user back past their typing.
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "" })] });
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "" })]));

    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "our favorite song is on" })] });
    expect(lineText(useProjectStore.getState().lines[0])).toBe("our favorite song is on");

    useProjectStore.getState().commit(pasteLines(fieldUpdates([{ id: "a", updates: { begin: 5, end: 7 } }])));
    const placed = useProjectStore.getState().lines[0];
    expect(lineText(placed)).toBe("our favorite song is on");
    expect(mainTrack(placed).begin).toBe(5);

    useProjectStore.getState().undo();
    const afterUndo = useProjectStore.getState().lines[0];
    expect(lineText(afterUndo)).toBe("our favorite song is on");
    expect(mainTrack(afterUndo).begin).toBeUndefined();
  });

  it("snapshots pending edit before updateLinesWithHistory too", () => {
    useProjectStore
      .getState()
      .commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "alpha" })]));
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "alpha edited" })] });
    useProjectStore.getState().commit(pasteLines(fieldUpdates([{ id: "a", updates: { begin: 1, end: 2 } }])));
    useProjectStore.getState().undo();
    expect(lineText(useProjectStore.getState().lines[0])).toBe("alpha edited");
    expect(mainTrack(useProjectStore.getState().lines[0]).begin).toBeUndefined();
  });

  it("clears words and background words via undefined updates and is undoable", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        seedLine("a", {
          words: [{ id: "w1", text: "hi", sep: "", begin: 0, end: 1, joinsNext: false }],
          backgroundWords: [{ id: "w2", text: "ah", sep: "", begin: 0, end: 0.5, joinsNext: false }],
          backgroundText: "ah",
        }),
      ],
    });

    useProjectStore.getState().commit(
      pasteLines(
        fieldUpdates([
          {
            id: "a",
            updates: { words: undefined, backgroundWords: undefined },
          },
        ]),
      ),
    );

    const cleared = useProjectStore.getState().lines[0];
    expect(roleWords(cleared, "main")).toBeUndefined();
    expect(roleWords(cleared, "bg")).toBeUndefined();

    useProjectStore.getState().undo();
    const restored = useProjectStore.getState().lines[0];
    expect(timedSyllables(mainTrack(restored))).toEqual([{ text: "hi", sep: "", begin: 0, end: 1, joinsNext: false }]);
    expect(timedSyllables(backgroundTrack(restored))).toEqual([
      { text: "ah", sep: "", begin: 0, end: 0.5, joinsNext: false },
    ]);
  });
});

// -- closeLyricBurst ------------------------------------------------------------

describe("closeLyricBurst", () => {
  it("records a typing run as a single undo entry", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "hello" })] });
    const baseline = useProjectStore.getState().lines;

    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "hello wor" })] });
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "hello world" })] });

    useProjectStore.getState().closeLyricBurst({ lines: baseline, wasPending: false });

    useProjectStore.getState().undo();
    expect(lineText(useProjectStore.getState().lines[0])).toBe("hello");

    useProjectStore.getState().redo();
    expect(lineText(useProjectStore.getState().lines[0])).toBe("hello world");
  });

  it("is a no-op when nothing changed since the last history entry", () => {
    useProjectStore
      .getState()
      .commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "hello" })]));
    const indexBefore = useProjectStore.getState().historyIndex;
    useProjectStore.getState().closeLyricBurst({ lines: useProjectStore.getState().lines, wasPending: false });
    expect(useProjectStore.getState().historyIndex).toBe(indexBefore);
  });

  it("truncates the redo branch when committed mid-history", () => {
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "one" })]));
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "two" })]));
    useProjectStore
      .getState()
      .commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "three" })]));

    useProjectStore.getState().undo();
    useProjectStore.getState().undo();
    expect(lineText(useProjectStore.getState().lines[0])).toBe("one");

    const baseline = useProjectStore.getState().lines;
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "one edited" })] });
    useProjectStore.getState().closeLyricBurst({ lines: baseline, wasPending: false });

    expect(lineText(useProjectStore.getState().lines[0])).toBe("one edited");
    expect(useProjectStore.getState().canRedo()).toBe(false);
    expect(useProjectStore.getState().historyIndex).toBe(useProjectStore.getState().history.length - 1);

    useProjectStore.getState().undo();
    expect(lineText(useProjectStore.getState().lines[0])).toBe("one");
  });

  it("seeds the baseline entry when history is empty so undo can return to it", () => {
    expect(useProjectStore.getState().history).toEqual([]);

    const baseline = [seedLine("a", { text: "start" })];
    useProjectStore.getState().restoreLyrics({ lines: baseline });
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "start typed" })] });

    useProjectStore.getState().closeLyricBurst({ lines: baseline, wasPending: false });

    expect(useProjectStore.getState().canUndo()).toBe(true);
    expect(lineText(useProjectStore.getState().lines[0])).toBe("start typed");

    useProjectStore.getState().undo();
    expect(lineText(useProjectStore.getState().lines[0])).toBe("start");
  });

  it("does not mutate the baseline array passed in", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "frozen" })] });
    const baseline = useProjectStore.getState().lines;
    const baselineSnapshot = structuredClone(baseline);

    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "frozen edited" })] });
    useProjectStore.getState().closeLyricBurst({ lines: baseline, wasPending: false });

    expect(baseline).toEqual(baselineSnapshot);
  });

  it("keeps history entries safe from later in-place writes", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "clone me" })] });
    const baseline = useProjectStore.getState().lines;

    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "clone me edited" })] });
    useProjectStore.getState().closeLyricBurst({ lines: baseline, wasPending: false });

    const committedIndex = useProjectStore.getState().historyIndex;
    const live = useProjectStore.getState().lines[0];
    expect(() => {
      live.groupId = "live mutation";
    }).toThrow(TypeError);

    expect(lineText(useProjectStore.getState().history[committedIndex].lines[0])).toBe("clone me edited");
  });

  it("never lets history exceed MAX_HISTORY_SIZE", () => {
    for (let i = 0; i < MAX_HISTORY_SIZE + 50; i++) {
      const baseline = useProjectStore.getState().lines;
      useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: `edit ${i}` })] });
      useProjectStore.getState().closeLyricBurst({ lines: baseline, wasPending: false });
    }
    expect(useProjectStore.getState().history.length).toBeLessThanOrEqual(MAX_HISTORY_SIZE);
    expect(useProjectStore.getState().historyIndex).toBe(useProjectStore.getState().history.length - 1);
  });

  it("leaves canUndo true and canRedo false after a commit", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "base" })] });
    const baseline = useProjectStore.getState().lines;

    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "base typed" })] });
    useProjectStore.getState().closeLyricBurst({ lines: baseline, wasPending: false });

    expect(useProjectStore.getState().canUndo()).toBe(true);
    expect(useProjectStore.getState().canRedo()).toBe(false);
  });

  it("clears isDirtySinceHistory after a commit", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "dirty" })] });
    const baseline = useProjectStore.getState().lines;

    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "dirty typed" })] });
    expect(useProjectStore.getState().isDirtySinceHistory).toBe(true);

    useProjectStore.getState().closeLyricBurst({ lines: baseline, wasPending: false });
    expect(useProjectStore.getState().isDirtySinceHistory).toBe(false);
  });

  it("no-op path leaves history, historyIndex, and isDirtySinceHistory untouched", () => {
    useProjectStore
      .getState()
      .commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "stable" })]));
    const historyBefore = useProjectStore.getState().history;
    const indexBefore = useProjectStore.getState().historyIndex;
    const dirtyBefore = useProjectStore.getState().isDirtySinceHistory;

    useProjectStore.getState().closeLyricBurst({ lines: useProjectStore.getState().lines, wasPending: false });

    expect(useProjectStore.getState().history).toBe(historyBefore);
    expect(useProjectStore.getState().historyIndex).toBe(indexBefore);
    expect(useProjectStore.getState().isDirtySinceHistory).toBe(dirtyBefore);
  });
});

// -- closeLyricBurst · pre-dirty baseline seeding ----------------------------

describe("closeLyricBurst · pre-dirty baseline seeding", () => {
  it("seeds the baseline when a non-history mutation dirtied the store before the run", () => {
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "A" })]));
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "B" })] });
    const baseline = useProjectStore.getState().lines;
    const baselineWasDirty = useProjectStore.getState().isDirtySinceHistory;
    expect(baselineWasDirty).toBe(true);

    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "C" })] });
    useProjectStore.getState().closeLyricBurst({ lines: baseline, wasPending: baselineWasDirty });

    useProjectStore.getState().undo();
    expect(lineText(useProjectStore.getState().lines[0])).toBe("B");
    useProjectStore.getState().undo();
    expect(lineText(useProjectStore.getState().lines[0])).toBe("A");
  });

  it("does not seed a duplicate baseline when the store was clean before the run", () => {
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "A" })]));
    const baseline = useProjectStore.getState().lines;
    const baselineWasDirty = useProjectStore.getState().isDirtySinceHistory;
    expect(baselineWasDirty).toBe(false);
    const lengthBefore = useProjectStore.getState().history.length;

    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "C" })] });
    useProjectStore.getState().closeLyricBurst({ lines: baseline, wasPending: baselineWasDirty });

    expect(useProjectStore.getState().history.length).toBe(lengthBefore + 1);
    useProjectStore.getState().undo();
    expect(lineText(useProjectStore.getState().lines[0])).toBe("A");
  });

  it("treats an omitted baselineWasDirty as clean", () => {
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "A" })]));
    const baseline = useProjectStore.getState().lines;
    const lengthBefore = useProjectStore.getState().history.length;

    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "C" })] });
    useProjectStore.getState().closeLyricBurst({ lines: baseline, wasPending: false });

    expect(useProjectStore.getState().history.length).toBe(lengthBefore + 1);
  });

  it("seeds the baseline only once on the dirty path when history is empty", () => {
    expect(useProjectStore.getState().history).toEqual([]);
    const baseline = [seedLine("a", { text: "A" })];
    useProjectStore.getState().restoreLyrics({ lines: baseline });
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "C" })] });

    useProjectStore.getState().closeLyricBurst({ lines: baseline, wasPending: true });

    expect(useProjectStore.getState().history).toHaveLength(2);
    useProjectStore.getState().undo();
    expect(lineText(useProjectStore.getState().lines[0])).toBe("A");
  });

  it("truncates the redo branch when the dirty path commits mid-history", () => {
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "one" })]));
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "two" })]));
    useProjectStore
      .getState()
      .commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "three" })]));
    useProjectStore.getState().undo();
    useProjectStore.getState().undo();
    expect(lineText(useProjectStore.getState().lines[0])).toBe("one");

    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "one cross-view" })] });
    const baseline = useProjectStore.getState().lines;
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "one typed" })] });
    useProjectStore.getState().closeLyricBurst({ lines: baseline, wasPending: true });

    expect(useProjectStore.getState().canRedo()).toBe(false);
    expect(lineText(useProjectStore.getState().lines[0])).toBe("one typed");
    useProjectStore.getState().undo();
    expect(lineText(useProjectStore.getState().lines[0])).toBe("one cross-view");
    useProjectStore.getState().undo();
    expect(lineText(useProjectStore.getState().lines[0])).toBe("one");
  });

  it("does not mutate the baseline array on the dirty path", () => {
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "A" })]));
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "B" })] });
    const baseline = useProjectStore.getState().lines;
    const baselineSnapshot = structuredClone(baseline);

    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "C" })] });
    useProjectStore.getState().closeLyricBurst({ lines: baseline, wasPending: true });

    expect(baseline).toEqual(baselineSnapshot);
  });

  it("keeps the seeded baseline entry safe from later in-place writes", () => {
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "A" })]));
    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "B" })] });
    const baseline = useProjectStore.getState().lines;

    useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "C" })] });
    useProjectStore.getState().closeLyricBurst({ lines: baseline, wasPending: true });

    expect(() => {
      baseline[0].groupId = "live mutation";
    }).toThrow(TypeError);
    useProjectStore.getState().undo();
    expect(lineText(useProjectStore.getState().lines[0])).toBe("B");
  });

  it("no-ops when isDirtySinceHistory is false even if baselineWasDirty is true", () => {
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "A" })]));
    const indexBefore = useProjectStore.getState().historyIndex;

    useProjectStore.getState().closeLyricBurst({ lines: useProjectStore.getState().lines, wasPending: true });

    expect(useProjectStore.getState().historyIndex).toBe(indexBefore);
  });
});

// -- Undo with a pending non-history edit -------------------------------------

describe("undo with a pending non-history edit", () => {
  const texts = () => useProjectStore.getState().lines.map((line) => lineText(line));

  describe("regressions", () => {
    it("regression: undo after a non-history replace returns to the last committed state and redo returns to the replace", () => {
      const store = useProjectStore.getState();
      store.commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "Old" })]));
      store.commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "Old edited" })]));
      store.restoreLyrics({ lines: [seedLine("n1", { text: "New A" }), seedLine("n2", { text: "New B" })] });

      useProjectStore.getState().undo();
      expect(texts()).toEqual(["Old edited"]);

      useProjectStore.getState().redo();
      expect(texts()).toEqual(["New A", "New B"]);
    });

    it("regression: undo after a non-history replace with a single committed entry keeps the lyrics", () => {
      useProjectStore
        .getState()
        .commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "Old" })]));
      useProjectStore.getState().restoreLyrics({ lines: [seedLine("n1", { text: "New" })] });

      useProjectStore.getState().undo();

      expect(texts()).toEqual(["Old"]);
    });
  });

  describe("edge cases", () => {
    it("is a no-op when nothing has ever been committed", () => {
      useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "Typed" })] });

      useProjectStore.getState().undo();

      expect(texts()).toEqual(["Typed"]);
    });

    it("reports canUndo while a pending edit sits on top of the oldest entry", () => {
      useProjectStore
        .getState()
        .commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "Old" })]));
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().canUndo()).toBe(false);

      useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "Typed" })] });

      expect(useProjectStore.getState().canUndo()).toBe(true);
    });
  });

  describe("invariants", () => {
    it("drops the redo branch when the pending edit is snapshotted", () => {
      const store = useProjectStore.getState();
      store.commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "A" })]));
      store.commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { text: "B" })]));
      useProjectStore.getState().undo();
      useProjectStore.getState().restoreLyrics({ lines: [seedLine("a", { text: "Typed" })] });

      useProjectStore.getState().undo();
      expect(texts()).toEqual(["A"]);
      useProjectStore.getState().redo();
      expect(texts()).toEqual(["Typed"]);
      expect(useProjectStore.getState().canRedo()).toBe(false);
    });
  });
});

// -- Agents in history --------------------------------------------------------

describe("agents in history", () => {
  const agentIds = () => useProjectStore.getState().agents.map((agent) => agent.id);

  describe("regressions", () => {
    it("regression: undoing an agent removal restores the agent and the lines that used it together", () => {
      const store = useProjectStore.getState();
      store.addAgent({ id: "v3", type: "person", name: "Carol" });
      store.commit(
        pasteLyrics(useProjectStore.getState().lines, [
          seedLine("a", { agentId: "v3" }),
          seedLine("b", { agentId: "v1" }),
        ]),
      );

      useProjectStore.getState().commit(removeSinger("v3"));
      expect(agentIds()).not.toContain("v3");
      expect(mainTrack(useProjectStore.getState().lines[0]).agentId).toBe("v1");

      useProjectStore.getState().undo();
      expect(agentIds()).toContain("v3");
      expect(mainTrack(useProjectStore.getState().lines[0]).agentId).toBe("v3");

      useProjectStore.getState().redo();
      expect(agentIds()).not.toContain("v3");
      expect(mainTrack(useProjectStore.getState().lines[0]).agentId).toBe("v1");
    });
  });

  describe("happy paths", () => {
    it("undoes an agent rename", () => {
      useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a")]));
      useProjectStore.getState().updateAgent("v1", { name: "Renamed" });

      useProjectStore.getState().undo();

      expect(useProjectStore.getState().agents.find((agent) => agent.id === "v1")?.name).not.toBe("Renamed");
    });
  });

  describe("invariants", () => {
    it("never leaves a line pointing at an agent that is not in the list, across undo and redo", () => {
      const store = useProjectStore.getState();
      store.addAgent({ id: "v3", type: "person", name: "Carol" });
      store.commit(pasteLyrics(useProjectStore.getState().lines, [seedLine("a", { agentId: "v3" })]));
      useProjectStore.getState().commit(removeSinger("v3"));

      for (const step of ["undo", "redo", "undo"] as const) {
        useProjectStore.getState()[step]();
        const { agents, lines } = useProjectStore.getState();
        const known = new Set(agents.map((agent) => agent.id));
        expect(lines.every((line) => !mainTrack(line).agentId || known.has(mainTrack(line).agentId))).toBe(true);
      }
    });

    it("keeps at least one agent: removing the only agent is a no-op", () => {
      useProjectStore.getState().restoreLyrics({ agents: [{ id: "v1", type: "person" }] });
      useProjectStore.getState().commit(removeSinger("v1"));
      expect(agentIds()).toEqual(["v1"]);
    });
  });
});
