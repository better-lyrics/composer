import { describe, expect, it, beforeEach } from "vitest";
import { detectedGrid } from "@/domain/tempo/beat-grid";
import { withOffset } from "@/domain/tempo/grid-edits";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";

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

  it("clearing the grid marks the project dirty", () => {
    useProjectStore.getState().setBeatGrid(grid);
    useProjectStore.setState({ isDirty: false });
    useProjectStore.getState().clearBeatGrid();
    expect(useProjectStore.getState().beatGrid).toBeNull();
    expect(useProjectStore.getState().isDirty).toBe(true);
  });
});
