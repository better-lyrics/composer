/**
 * @vitest-environment node
 */
import { type LooseLine, type LyricLine, reconcileLine, useProjectStore } from "@/stores/project";
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
