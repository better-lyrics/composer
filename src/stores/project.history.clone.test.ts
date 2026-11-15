/**
 * @vitest-environment node
 */
import { detectedGrid } from "@/domain/tempo/beat-grid";
import { withOffset } from "@/domain/tempo/grid-edits";
import { useProjectStore } from "@/stores/project";
import type { ProjectState } from "@/stores/project/types";
import { createGroup, createLine } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";

// Pins the contract that history entries round-trip exactly and are never
// changed by later edits. Entries share the store's immutable objects, so a
// later in-place write must throw instead of reaching an entry.

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

const beats = Array.from({ length: 9 }, (_, i) => i * 0.5);
const grid = detectedGrid({ beats, downbeats: beats.filter((_, i) => i % 4 === 0) });

function recorded(state: ProjectState) {
  return structuredClone({
    lines: state.lines,
    groups: state.groups,
    agents: state.agents,
    customSnapPoints: state.customSnapPoints,
    beatGrid: state.beatGrid,
  });
}

const chorus = (instanceIdx: number, begin: number) =>
  createLine({
    id: `c${instanceIdx}`,
    text: "I want",
    words: [
      { text: "I", sep: " ", begin, end: begin + 0.4 },
      { text: "want", begin: begin + 0.5, end: begin + 1 },
    ],
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
  });

describe("history snapshot integrity", () => {
  it("undo restores nested word arrays without aliasing the post-state", () => {
    const store = useProjectStore.getState();
    store.setLinesWithHistory([
      {
        id: "L1",
        text: "hello",
        agentId: "v1",
        words: [{ id: "w1", text: "hello", sep: "", begin: 0, end: 1 }],
      },
    ]);
    store.updateLineWithHistory("L1", { words: [{ id: "w2", text: "hello!", sep: "", begin: 0, end: 1 }] });
    const beforeUndo = useProjectStore.getState().lines[0].words?.[0].text;
    expect(beforeUndo).toBe("hello!");
    store.undo();
    expect(useProjectStore.getState().lines[0].words?.[0].text).toBe("hello");
    const restored = useProjectStore.getState().lines[0].words;
    expect(() => {
      if (restored) restored[0].text = "MUTATED";
    }).toThrow(TypeError);
    store.redo();
    expect(useProjectStore.getState().lines[0].words?.[0].text).toBe("hello!");
    store.undo();
    expect(useProjectStore.getState().lines[0].words?.[0].text).toBe("hello");
  });

  it("undo restores groups[] alongside lines[]", () => {
    const store = useProjectStore.getState();
    store.addGroupWithLines({ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }, [
      {
        id: "L1",
        text: "x",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
      },
    ]);
    expect(useProjectStore.getState().groups).toHaveLength(1);
    store.removeGroup("g1");
    expect(useProjectStore.getState().groups).toHaveLength(0);
    store.undo();
    expect(useProjectStore.getState().groups).toHaveLength(1);
    expect(useProjectStore.getState().groups[0].label).toBe("Chorus");
  });

  it("undo and redo preserve identity of nested structures across multiple steps", () => {
    const store = useProjectStore.getState();
    store.setLinesWithHistory([
      {
        id: "A",
        text: "a",
        agentId: "v1",
        words: [
          { id: "w3", text: "a", sep: " ", begin: 0, end: 0.5 },
          { id: "w4", text: "b", sep: "", begin: 0.5, end: 1 },
        ],
      },
    ]);
    store.updateLineWithHistory("A", { words: [{ id: "w5", text: "ab", sep: "", begin: 0, end: 1 }] });
    store.updateLineWithHistory("A", { words: [{ id: "w6", text: "ABC", sep: "", begin: 0, end: 1 }] });
    store.undo();
    expect(useProjectStore.getState().lines[0].words?.[0].text).toBe("ab");
    store.undo();
    expect(useProjectStore.getState().lines[0].words?.length).toBe(2);
    store.redo();
    expect(useProjectStore.getState().lines[0].words?.[0].text).toBe("ab");
    store.redo();
    expect(useProjectStore.getState().lines[0].words?.[0].text).toBe("ABC");
  });

  it("undo and redo return every snapshotted field to its exact recorded state", () => {
    const store = useProjectStore.getState;
    store().setLines([createLine({ id: "a", text: "first" }), createLine({ id: "b", text: "second" })]);
    store().setCustomSnapPoints([2, 5]);
    store().setBeatGrid(grid);
    store().addAgent({ id: "v2", type: "person", name: "Second" });
    store().setLinesWithHistory(store().lines, [createGroup({ id: "g1" })]);
    const start = recorded(store());

    store().updateLineWithHistory("a", { text: "first edited" });
    store().applyBeatGridWithHistory(withOffset(grid, 20));
    const afterA = recorded(store());

    store().removeAgentWithHistory("v2");
    const afterB = recorded(store());

    store().undo();
    expect(recorded(store())).toEqual(afterA);
    store().undo();
    store().undo();
    expect(recorded(store())).toEqual(start);
    store().redo();
    store().redo();
    expect(recorded(store())).toEqual(afterA);
    store().redo();
    expect(recorded(store())).toEqual(afterB);
  });

  it("undo gives back the same objects for lines the undone step did not change", () => {
    const store = useProjectStore.getState;
    store().setLinesWithHistory([createLine({ id: "a", text: "one" }), createLine({ id: "b", text: "two" })]);
    const before = store().lines;

    store().updateLineWithHistory("a", { text: "one edited" });
    expect(store().lines[1]).toBe(before[1]);
    store().undo();

    expect(store().lines[0]).toBe(before[0]);
    expect(store().lines[1]).toBe(before[1]);
    expect(store().groups).toBe(store().history[store().historyIndex].groups);
  });

  it("an entry is never changed by the edits that follow it", () => {
    const store = useProjectStore.getState;
    useProjectStore.setState({
      groups: [createGroup({ id: "g1", sharesTiming: true })],
      lines: [chorus(0, 10), chorus(1, 40)],
      isDirtySinceHistory: true,
    });
    store().setBeatGrid(grid);
    store().updateLineWithHistory("c0", { text: "I want it" });
    const committedIndex = store().historyIndex;
    const committed = structuredClone(store().history[committedIndex]);

    const nudged = (store().lines[0].words ?? []).map((word) => ({ ...word, begin: word.begin + 0.2 }));
    store().updateLinesWithHistory([{ id: "c0", updates: { words: nudged } }], {
      deriveText: false,
      propagateToSiblings: false,
    });
    expect(store().lines[1].words?.[0].begin).toBeCloseTo(40.2, 6);
    store().applyLineUpdatesToCurrentStep([{ id: "c1", updates: { agentId: "v2" } }]);
    store().nudgeBeatGridOffsetWithHistory(withOffset(grid, 10));
    store().nudgeBeatGridOffsetWithHistory(withOffset(grid, 20));

    expect(store().history[committedIndex]).toEqual(committed);
  });

  it("mutating a line that is in history throws", () => {
    const store = useProjectStore.getState;
    store().setLinesWithHistory([createLine({ id: "a", text: "kept" })]);
    const line = store().history[store().historyIndex].lines[0];

    expect(() => {
      line.text = "changed in place";
    }).toThrow(TypeError);
    expect(() => store().lines.push(createLine({ id: "b" }))).toThrow(TypeError);
    expect(store().lines.map((entry) => entry.text)).toEqual(["kept"]);
  });

  it("an in-place write to a committed store line throws, and undo then redo give back the same objects", () => {
    const store = useProjectStore.getState;
    store().setLinesWithHistory([createLine({ id: "a", text: "first" })]);
    store().updateLineWithHistory("a", { text: "second" });
    const committedLines = store().lines;

    expect(() => {
      store().lines[0].text = "changed in place";
    }).toThrow(TypeError);
    store().undo();
    store().redo();

    expect(store().lines).toBe(committedLines);
    expect(store().lines[0]).toBe(committedLines[0]);
    expect(store().lines[0].text).toBe("second");
  });
});
