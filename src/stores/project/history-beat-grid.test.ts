import { detectedGrid } from "@/domain/tempo/beat-grid";
import { resetGrid, withBarOneAt, withOffset } from "@/domain/tempo/grid-edits";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";

const beats = Array.from({ length: 17 }, (_, i) => i * 0.5);
const grid = detectedGrid({ beats, downbeats: beats.filter((_, i) => i % 4 === 0) });

describe("project history snapshots the beat grid", () => {
  beforeEach(() =>
    useProjectStore.setState({
      lines: [createLine({ text: "a" })],
      customSnapPoints: [],
      beatGrid: null,
      history: [],
      historyIndex: -1,
      isDirty: false,
      isDirtySinceHistory: false,
    }),
  );

  it("undo steps back through grid edits to no grid, and redo replays them", () => {
    useProjectStore.getState().applyBeatGridWithHistory(grid);
    useProjectStore.getState().applyBeatGridWithHistory(withOffset(grid, 20));

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().beatGrid).toEqual(grid);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().beatGrid).toBeNull();

    useProjectStore.getState().redo();
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().beatGrid?.offsetMs).toBe(20);
  });

  it("a grid set outside history is kept as an undo step before the next edit", () => {
    useProjectStore.getState().setBeatGrid(grid);
    useProjectStore.getState().applyBeatGridWithHistory(withOffset(grid, 30));

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().beatGrid).toEqual(grid);
  });

  it("undoing a lyrics edit leaves the grid alone", () => {
    useProjectStore.getState().applyBeatGridWithHistory(grid);
    useProjectStore.getState().setLinesWithHistory([createLine({ text: "b" })]);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().beatGrid).toEqual(grid);
    expect(useProjectStore.getState().lines[0].text).toBe("a");
  });

  it("history entries do not share the grid object with the store", () => {
    useProjectStore.getState().applyBeatGridWithHistory(grid);
    const entry = useProjectStore.getState().history.at(-1);
    expect(entry?.beatGrid).toEqual(grid);
    expect(entry?.beatGrid).not.toBe(useProjectStore.getState().beatGrid);
  });

  it("nudging the offset again and again is one undo step", () => {
    const store = useProjectStore.getState;
    store().applyBeatGridWithHistory(grid);
    for (const offset of [10, 20, 30]) store().nudgeBeatGridOffsetWithHistory(withOffset(grid, offset));

    store().undo();
    expect(store().beatGrid).toEqual(grid);
    store().redo();
    expect(store().beatGrid?.offsetMs).toBe(30);
  });

  it("a nudge after another edit starts its own step", () => {
    const store = useProjectStore.getState;
    const moved = withBarOneAt(grid, 1);
    store().applyBeatGridWithHistory(grid);
    store().applyBeatGridWithHistory(moved);
    store().nudgeBeatGridOffsetWithHistory(withOffset(moved, 10));
    store().nudgeBeatGridOffsetWithHistory(withOffset(moved, 20));

    store().undo();
    expect(store().beatGrid).toEqual(moved);
    store().undo();
    expect(store().beatGrid).toEqual(grid);
  });

  it("a nudge after a lyrics edit starts its own step", () => {
    const store = useProjectStore.getState;
    store().applyBeatGridWithHistory(grid);
    store().nudgeBeatGridOffsetWithHistory(withOffset(grid, 10));
    store().setLinesWithHistory([createLine({ text: "b" })]);
    store().nudgeBeatGridOffsetWithHistory(withOffset(grid, 20));

    store().undo();
    expect(store().beatGrid?.offsetMs).toBe(10);
    expect(store().lines[0].text).toBe("b");
  });

  it("a nudge after an undo starts its own step", () => {
    const store = useProjectStore.getState;
    store().applyBeatGridWithHistory(grid);
    store().nudgeBeatGridOffsetWithHistory(withOffset(grid, 10));
    store().nudgeBeatGridOffsetWithHistory(withOffset(grid, 20));
    store().undo();
    store().nudgeBeatGridOffsetWithHistory(withOffset(grid, -10));

    store().undo();
    expect(store().beatGrid).toEqual(grid);
    expect(store().canRedo()).toBe(true);
  });

  it("a nudge never joins an edit that only happened to change the offset", () => {
    const store = useProjectStore.getState;
    store().applyBeatGridWithHistory(withOffset(grid, 50));
    store().applyBeatGridWithHistory(resetGrid(withOffset(grid, 50)));
    store().nudgeBeatGridOffsetWithHistory(withOffset(grid, 10));

    store().undo();
    expect(store().beatGrid?.offsetMs).toBe(0);
  });

  it("nudging back to where the nudges started leaves no empty undo step", () => {
    const store = useProjectStore.getState;
    store().applyBeatGridWithHistory(grid);
    store().nudgeBeatGridOffsetWithHistory(withOffset(grid, 10));
    store().nudgeBeatGridOffsetWithHistory(withOffset(grid, 0));
    store().nudgeBeatGridOffsetWithHistory(withOffset(grid, -10));

    store().undo();
    expect(store().beatGrid).toEqual(grid);
    store().undo();
    expect(store().beatGrid).toBeNull();
  });

  it("clearing the grid marks the project dirty", () => {
    useProjectStore.getState().setBeatGrid(grid);
    useProjectStore.setState({ isDirty: false });
    useProjectStore.getState().clearBeatGrid();
    expect(useProjectStore.getState().beatGrid).toBeNull();
    expect(useProjectStore.getState().isDirty).toBe(true);
  });
});
