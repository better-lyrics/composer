/**
 * @vitest-environment node
 */
import { useProjectStore } from "@/stores/project";
import { reconcileLine, type LooseLine, type LyricLine } from "@/domain/line/model";
import { beforeEach, describe, expect, it } from "vitest";

function seedLine(id: string, overrides: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({ id, text: "hello world", agentId: "v1", ...overrides });
}

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

// -- setLinesWithHistory and updateLinesWithHistory ----------------------------

describe("setLinesWithHistory", () => {
  it("pushes a history entry that undo restores", () => {
    useProjectStore.getState().setLines([seedLine("a"), seedLine("b")]);
    const before = useProjectStore.getState().lines;

    useProjectStore.getState().setLinesWithHistory([seedLine("a", { agentId: "v2" }), seedLine("b")]);
    expect(useProjectStore.getState().lines[0].agentId).toBe("v2");
    expect(useProjectStore.getState().canUndo()).toBe(true);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines).toEqual(before);
  });
});

describe("updateLinesWithHistory", () => {
  it("merges multiple line updates into one history step", () => {
    useProjectStore.getState().setLines([seedLine("a"), seedLine("b"), seedLine("c")]);

    useProjectStore.getState().updateLinesWithHistory([
      { id: "a", updates: { agentId: "v2" } },
      { id: "c", updates: { agentId: "v3" } },
    ]);

    expect(useProjectStore.getState().lines.map((l) => l.agentId)).toEqual(["v2", "v1", "v3"]);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines.map((l) => l.agentId)).toEqual(["v1", "v1", "v1"]);

    useProjectStore.getState().redo();
    expect(useProjectStore.getState().lines.map((l) => l.agentId)).toEqual(["v2", "v1", "v3"]);
  });

  it("snapshots a pending non-history edit before a subsequent history-aware update so undo lands on the typed state", () => {
    // Reproduces issue #33 follow-up: typing in Edit (uses setLines, no
    // history) followed by clicking Place (updateLineWithHistory) used to
    // make Cmd+Z drop the user back past their typing.
    useProjectStore.getState().setLines([seedLine("a", { text: "" })]);
    useProjectStore.getState().setLinesWithHistory([seedLine("a", { text: "" })]);

    useProjectStore.getState().setLines([seedLine("a", { text: "our favorite song is on" })]);
    expect(useProjectStore.getState().lines[0].text).toBe("our favorite song is on");

    useProjectStore.getState().updateLineWithHistory("a", { begin: 5, end: 7 });
    const placed = useProjectStore.getState().lines[0];
    expect(placed.text).toBe("our favorite song is on");
    expect(placed.begin).toBe(5);

    useProjectStore.getState().undo();
    const afterUndo = useProjectStore.getState().lines[0];
    expect(afterUndo.text).toBe("our favorite song is on");
    expect(afterUndo.begin).toBeUndefined();
  });

  it("snapshots pending edit before updateLinesWithHistory too", () => {
    useProjectStore.getState().setLinesWithHistory([seedLine("a", { text: "alpha" })]);
    useProjectStore.getState().setLines([seedLine("a", { text: "alpha edited" })]);
    useProjectStore.getState().updateLinesWithHistory([{ id: "a", updates: { begin: 1, end: 2 } }]);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines[0].text).toBe("alpha edited");
    expect(useProjectStore.getState().lines[0].begin).toBeUndefined();
  });

  it("clears words and background words via undefined updates and is undoable", () => {
    useProjectStore.getState().setLines([
      seedLine("a", {
        words: [{ text: "hi", begin: 0, end: 1 }],
        backgroundWords: [{ text: "ah", begin: 0, end: 0.5 }],
        backgroundText: "ah",
      }),
    ]);

    useProjectStore.getState().updateLinesWithHistory([
      {
        id: "a",
        updates: { words: undefined, backgroundWords: undefined },
      },
    ]);

    const cleared = useProjectStore.getState().lines[0];
    expect(cleared.words).toBeUndefined();
    expect(cleared.backgroundWords).toBeUndefined();

    useProjectStore.getState().undo();
    const restored = useProjectStore.getState().lines[0];
    expect(restored.words).toEqual([{ text: "hi", begin: 0, end: 1 }]);
    expect(restored.backgroundWords).toEqual([{ text: "ah", begin: 0, end: 0.5 }]);
  });
});

// -- commitPendingLineEdit -----------------------------------------------------

describe("commitPendingLineEdit", () => {
  it("records a typing run as a single undo entry", () => {
    const store = useProjectStore.getState();
    store.setLines([seedLine("a", { text: "hello" })]);
    const baseline = useProjectStore.getState().lines;

    store.setLines([seedLine("a", { text: "hello wor" })]);
    store.setLines([seedLine("a", { text: "hello world" })]);

    useProjectStore.getState().commitPendingLineEdit(baseline);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines[0].text).toBe("hello");

    useProjectStore.getState().redo();
    expect(useProjectStore.getState().lines[0].text).toBe("hello world");
  });

  it("is a no-op when nothing changed since the last history entry", () => {
    const store = useProjectStore.getState();
    store.setLinesWithHistory([seedLine("a", { text: "hello" })]);
    const indexBefore = useProjectStore.getState().historyIndex;
    useProjectStore.getState().commitPendingLineEdit(useProjectStore.getState().lines);
    expect(useProjectStore.getState().historyIndex).toBe(indexBefore);
  });

  it("truncates the redo branch when committed mid-history", () => {
    useProjectStore.getState().setLinesWithHistory([seedLine("a", { text: "one" })]);
    useProjectStore.getState().setLinesWithHistory([seedLine("a", { text: "two" })]);
    useProjectStore.getState().setLinesWithHistory([seedLine("a", { text: "three" })]);

    useProjectStore.getState().undo();
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines[0].text).toBe("one");

    const baseline = useProjectStore.getState().lines;
    useProjectStore.getState().setLines([seedLine("a", { text: "one edited" })]);
    useProjectStore.getState().commitPendingLineEdit(baseline);

    expect(useProjectStore.getState().lines[0].text).toBe("one edited");
    expect(useProjectStore.getState().canRedo()).toBe(false);
    expect(useProjectStore.getState().historyIndex).toBe(useProjectStore.getState().history.length - 1);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines[0].text).toBe("one");
  });

  it("seeds the baseline entry when history is empty so undo can return to it", () => {
    expect(useProjectStore.getState().history).toEqual([]);

    const baseline = [seedLine("a", { text: "start" })];
    useProjectStore.getState().setLines(baseline);
    useProjectStore.getState().setLines([seedLine("a", { text: "start typed" })]);

    useProjectStore.getState().commitPendingLineEdit(baseline);

    expect(useProjectStore.getState().canUndo()).toBe(true);
    expect(useProjectStore.getState().lines[0].text).toBe("start typed");

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines[0].text).toBe("start");
  });

  it("does not mutate the baseline array passed in", () => {
    useProjectStore.getState().setLines([seedLine("a", { text: "frozen" })]);
    const baseline = useProjectStore.getState().lines;
    const baselineSnapshot = structuredClone(baseline);

    useProjectStore.getState().setLines([seedLine("a", { text: "frozen edited" })]);
    useProjectStore.getState().commitPendingLineEdit(baseline);

    expect(baseline).toEqual(baselineSnapshot);
  });

  it("stores history entries as independent clones", () => {
    useProjectStore.getState().setLines([seedLine("a", { text: "clone me" })]);
    const baseline = useProjectStore.getState().lines;

    useProjectStore.getState().setLines([seedLine("a", { text: "clone me edited" })]);
    useProjectStore.getState().commitPendingLineEdit(baseline);

    const committedIndex = useProjectStore.getState().historyIndex;
    useProjectStore.getState().lines[0].text = "live mutation";

    expect(useProjectStore.getState().history[committedIndex].lines[0].text).toBe("clone me edited");
  });

  it("never lets history exceed MAX_HISTORY_SIZE", () => {
    for (let i = 0; i < 150; i++) {
      const baseline = useProjectStore.getState().lines;
      useProjectStore.getState().setLines([seedLine("a", { text: `edit ${i}` })]);
      useProjectStore.getState().commitPendingLineEdit(baseline);
    }
    expect(useProjectStore.getState().history.length).toBeLessThanOrEqual(100);
    expect(useProjectStore.getState().historyIndex).toBe(useProjectStore.getState().history.length - 1);
  });

  it("leaves canUndo true and canRedo false after a commit", () => {
    useProjectStore.getState().setLines([seedLine("a", { text: "base" })]);
    const baseline = useProjectStore.getState().lines;

    useProjectStore.getState().setLines([seedLine("a", { text: "base typed" })]);
    useProjectStore.getState().commitPendingLineEdit(baseline);

    expect(useProjectStore.getState().canUndo()).toBe(true);
    expect(useProjectStore.getState().canRedo()).toBe(false);
  });

  it("clears isDirtySinceHistory after a commit", () => {
    useProjectStore.getState().setLines([seedLine("a", { text: "dirty" })]);
    const baseline = useProjectStore.getState().lines;

    useProjectStore.getState().setLines([seedLine("a", { text: "dirty typed" })]);
    expect(useProjectStore.getState().isDirtySinceHistory).toBe(true);

    useProjectStore.getState().commitPendingLineEdit(baseline);
    expect(useProjectStore.getState().isDirtySinceHistory).toBe(false);
  });

  it("no-op path leaves history, historyIndex, and isDirtySinceHistory untouched", () => {
    useProjectStore.getState().setLinesWithHistory([seedLine("a", { text: "stable" })]);
    const historyBefore = useProjectStore.getState().history;
    const indexBefore = useProjectStore.getState().historyIndex;
    const dirtyBefore = useProjectStore.getState().isDirtySinceHistory;

    useProjectStore.getState().commitPendingLineEdit(useProjectStore.getState().lines);

    expect(useProjectStore.getState().history).toBe(historyBefore);
    expect(useProjectStore.getState().historyIndex).toBe(indexBefore);
    expect(useProjectStore.getState().isDirtySinceHistory).toBe(dirtyBefore);
  });
});
