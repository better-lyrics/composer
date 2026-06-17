import { useProjectStore } from "@/stores/project";
import { createLine, snapPoints } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function times(): number[] {
  return useProjectStore.getState().customSnapPoints.map((point) => point.time);
}

function idAt(index: number): string {
  return useProjectStore.getState().customSnapPoints[index].id;
}

function idOfTime(time: number): string {
  const point = useProjectStore.getState().customSnapPoints.find((p) => p.time === time);
  if (!point) throw new Error(`no snap point at time ${time}`);
  return point.id;
}

describe("project snap points: setCustomSnapPoints", () => {
  beforeEach(() => useProjectStore.setState({ customSnapPoints: [] }));

  it("filters non-finite and negative values and sorts ascending", () => {
    useProjectStore.getState().setCustomSnapPoints([3, 1, -2, Number.NaN, Number.POSITIVE_INFINITY]);
    expect(times()).toEqual([1, 3]);
  });

  it("keeps zero and allows duplicates", () => {
    useProjectStore.getState().setCustomSnapPoints([2, 0, 2]);
    expect(times()).toEqual([0, 2, 2]);
  });
});

describe("project snap points: clearCustomSnapPoints", () => {
  it("clearCustomSnapPoints empties a populated array", () => {
    useProjectStore.setState({ customSnapPoints: snapPoints([1, 2, 3]) });
    useProjectStore.getState().clearCustomSnapPoints();
    expect(times()).toEqual([]);
  });

  it("clearCustomSnapPoints on an already-empty array stays empty", () => {
    useProjectStore.setState({ customSnapPoints: [] });
    useProjectStore.getState().clearCustomSnapPoints();
    expect(times()).toEqual([]);
  });
});

describe("project snap points: history-aware mutators", () => {
  beforeEach(() =>
    useProjectStore.setState({
      customSnapPoints: [],
      history: [],
      historyIndex: -1,
      isDirty: false,
      isDirtySinceHistory: false,
    }),
  );

  it("addCustomSnapPoint adds, normalizes, and is undoable", () => {
    useProjectStore.setState({
      customSnapPoints: [],
      history: [],
      historyIndex: -1,
      isDirty: false,
      isDirtySinceHistory: false,
    });
    useProjectStore.getState().addCustomSnapPoint(5);
    expect(times()).toEqual([5]);
    useProjectStore.getState().addCustomSnapPoint(2);
    expect(times()).toEqual([2, 5]); // sorted
    useProjectStore.getState().undo();
    expect(times()).toEqual([5]);
    useProjectStore.getState().undo();
    expect(times()).toEqual([]);
    useProjectStore.getState().redo();
    expect(times()).toEqual([5]);
  });

  it("removeCustomSnapPoint removes by id and is undoable", () => {
    useProjectStore.setState({
      customSnapPoints: snapPoints([1, 3]),
      history: [],
      historyIndex: -1,
      isDirty: false,
      isDirtySinceHistory: false,
    });
    useProjectStore.getState().removeCustomSnapPoint(idOfTime(1));
    expect(times()).toEqual([3]);
    useProjectStore.getState().undo();
    expect(times()).toEqual([1, 3]);
    useProjectStore.getState().redo();
    expect(times()).toEqual([3]);
  });

  it("removeCustomSnapPoint ignores unknown ids (no history entry)", () => {
    useProjectStore.setState({
      customSnapPoints: snapPoints([1, 3]),
      history: [],
      historyIndex: -1,
      isDirty: false,
      isDirtySinceHistory: false,
    });
    const before = useProjectStore.getState().history.length;
    useProjectStore.getState().removeCustomSnapPoint("nope-1");
    useProjectStore.getState().removeCustomSnapPoint("nope-2");
    expect(times()).toEqual([1, 3]);
    expect(useProjectStore.getState().history.length).toBe(before);
  });

  describe("edge cases", () => {
    it("addCustomSnapPoint keeps a duplicate time and stays undoable", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([2]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().addCustomSnapPoint(2);
      expect(times()).toEqual([2, 2]);
      useProjectStore.getState().undo();
      expect(times()).toEqual([2]);
      useProjectStore.getState().redo();
      expect(times()).toEqual([2, 2]);
    });

    it("addCustomSnapPoint filters a negative time via normalize (no point added, but commit still happens)", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([4]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().addCustomSnapPoint(-1);
      expect(times()).toEqual([4]);
    });

    it("addCustomSnapPoint filters a non-finite time via normalize", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([4]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().addCustomSnapPoint(Number.NaN);
      expect(times()).toEqual([4]);
      useProjectStore.getState().addCustomSnapPoint(Number.POSITIVE_INFINITY);
      expect(times()).toEqual([4]);
    });

    it("addCustomSnapPoint keeps zero", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([3]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().addCustomSnapPoint(0);
      expect(times()).toEqual([0, 3]);
    });

    it("removeCustomSnapPoint removing the last point leaves an empty array, undoable", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([7]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().removeCustomSnapPoint(idOfTime(7));
      expect(times()).toEqual([]);
      useProjectStore.getState().undo();
      expect(times()).toEqual([7]);
    });

    it("removeCustomSnapPoint on the last entry removes only that entry", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([1, 2, 3]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().removeCustomSnapPoint(idOfTime(3));
      expect(times()).toEqual([1, 2]);
    });
  });

  describe("invariants", () => {
    it("addCustomSnapPoint marks the store dirty", () => {
      useProjectStore.setState({
        customSnapPoints: [],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().addCustomSnapPoint(5);
      expect(useProjectStore.getState().isDirty).toBe(true);
    });

    it("unknown-id removeCustomSnapPoint leaves dirty flags untouched", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([1, 3]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().removeCustomSnapPoint("nope");
      expect(useProjectStore.getState().isDirty).toBe(false);
      expect(useProjectStore.getState().isDirtySinceHistory).toBe(false);
    });

    it("addCustomSnapPoint does not mutate the previous array reference", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([2]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      const previous = useProjectStore.getState().customSnapPoints;
      useProjectStore.getState().addCustomSnapPoint(5);
      expect(previous.map((p) => p.time)).toEqual([2]);
      expect(useProjectStore.getState().customSnapPoints).not.toBe(previous);
    });

    it("each add is exactly one undo step", () => {
      useProjectStore.setState({
        customSnapPoints: [],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().addCustomSnapPoint(1);
      useProjectStore.getState().addCustomSnapPoint(2);
      useProjectStore.getState().addCustomSnapPoint(3);
      expect(times()).toEqual([1, 2, 3]);
      useProjectStore.getState().undo();
      expect(times()).toEqual([1, 2]);
      useProjectStore.getState().undo();
      expect(times()).toEqual([1]);
      useProjectStore.getState().undo();
      expect(times()).toEqual([]);
    });
  });
});

describe("project snap points: drag = one undo step", () => {
  beforeEach(() =>
    useProjectStore.setState({
      customSnapPoints: [],
      history: [],
      historyIndex: -1,
      isDirty: false,
      isDirtySinceHistory: false,
    }),
  );

  it("a drag (live moves + commit) is a single undo step", () => {
    useProjectStore.setState({
      customSnapPoints: snapPoints([2]),
      history: [],
      historyIndex: -1,
      isDirty: false,
      isDirtySinceHistory: false,
    });
    const baseline = useProjectStore.getState().customSnapPoints; // [2]
    const id = idAt(0);
    useProjectStore.getState().moveCustomSnapPoint(id, 4); // live, no history
    expect(times()).toEqual([4]);
    useProjectStore.getState().moveCustomSnapPoint(id, 6); // live, no history
    expect(times()).toEqual([6]);
    expect(useProjectStore.getState().history.length).toBe(0); // moves alone create no history
    useProjectStore.getState().commitSnapPointDrag(baseline);
    expect(times()).toEqual([6]);
    useProjectStore.getState().undo();
    expect(times()).toEqual([2]); // back to pre-drag, ONE step
    useProjectStore.getState().redo();
    expect(times()).toEqual([6]);
  });

  it("moveCustomSnapPoint ignores unknown id", () => {
    useProjectStore.setState({
      customSnapPoints: snapPoints([2]),
      history: [],
      historyIndex: -1,
      isDirty: false,
      isDirtySinceHistory: false,
    });
    useProjectStore.getState().moveCustomSnapPoint("nope-1", 9);
    useProjectStore.getState().moveCustomSnapPoint("nope-2", 9);
    expect(times()).toEqual([2]);
  });

  it("commitSnapPointDrag with no net change creates no history entry (click without drag)", () => {
    const baseline = snapPoints([2]);
    useProjectStore.setState({
      customSnapPoints: structuredClone(baseline),
      history: [],
      historyIndex: -1,
      isDirty: false,
      isDirtySinceHistory: false,
    });
    useProjectStore.getState().commitSnapPointDrag(useProjectStore.getState().customSnapPoints); // baseline == current
    expect(useProjectStore.getState().history.length).toBe(0);
    expect(useProjectStore.getState().isDirty).toBe(false);
  });

  it("seeds the pre-drag baseline when it differs from the latest history entry", () => {
    // history top is [2]; a non-history setCustomSnapPoints moved live state to [5] before the drag started
    const topEntry = snapPoints([2]);
    useProjectStore.setState({
      customSnapPoints: snapPoints([5]),
      history: [{ lines: [], groups: [], customSnapPoints: topEntry, timestamp: 1 }],
      historyIndex: 0,
      isDirty: true,
      isDirtySinceHistory: false,
    });
    const baseline = useProjectStore.getState().customSnapPoints; // [5]
    useProjectStore.getState().moveCustomSnapPoint(idAt(0), 8);
    useProjectStore.getState().commitSnapPointDrag(baseline); // baseline [5] != top entry [2]
    useProjectStore.getState().undo();
    expect(times()).toEqual([5]); // returns to pre-drag [5], not stale [2]
  });

  describe("edge cases", () => {
    it("two independent drags are two undo steps", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([2]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });

      const firstBaseline = useProjectStore.getState().customSnapPoints; // [2]
      useProjectStore.getState().moveCustomSnapPoint(idAt(0), 4);
      useProjectStore.getState().commitSnapPointDrag(firstBaseline);
      expect(times()).toEqual([4]);

      const secondBaseline = useProjectStore.getState().customSnapPoints; // [4]
      useProjectStore.getState().moveCustomSnapPoint(idAt(0), 9);
      useProjectStore.getState().commitSnapPointDrag(secondBaseline);
      expect(times()).toEqual([9]);

      useProjectStore.getState().undo();
      expect(times()).toEqual([4]); // back through second drag
      useProjectStore.getState().undo();
      expect(times()).toEqual([2]); // back through first drag
      useProjectStore.getState().redo();
      expect(times()).toEqual([4]);
      useProjectStore.getState().redo();
      expect(times()).toEqual([9]);
    });

    it("a drag that crosses another point re-sorts the live array", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([2, 8]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().moveCustomSnapPoint(idOfTime(2), 9); // dragged past the 8 point
      expect(times()).toEqual([8, 9]); // normalize re-sorts
    });

    it("commitSnapPointDrag normalizes the baseline it receives", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([3]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      // Caller hands an unsorted, partly-invalid baseline; commit must normalize it.
      const dirtyBaseline = snapPoints([5, -1, Number.NaN, 1]);
      useProjectStore.getState().moveCustomSnapPoint(idAt(0), 7);
      expect(times()).toEqual([7]);
      useProjectStore.getState().commitSnapPointDrag(dirtyBaseline);
      useProjectStore.getState().undo();
      expect(times()).toEqual([1, 5]); // normalized baseline restored
    });

    it("moveCustomSnapPoint filters a non-finite target time via normalize", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([2, 5]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().moveCustomSnapPoint(idOfTime(2), Number.NaN);
      expect(times()).toEqual([5]); // moved point filtered out
    });

    it("moveCustomSnapPoint clamps a negative target time out via normalize", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([2, 5]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().moveCustomSnapPoint(idOfTime(5), -3);
      expect(times()).toEqual([2]); // negative target dropped
    });

    it("moveCustomSnapPoint keeps zero as a valid target", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([4]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().moveCustomSnapPoint(idAt(0), 0);
      expect(times()).toEqual([0]);
    });
  });

  describe("invariants", () => {
    it("moveCustomSnapPoint does not mutate the previous array reference", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([2, 5]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      const previous = useProjectStore.getState().customSnapPoints;
      useProjectStore.getState().moveCustomSnapPoint(idOfTime(2), 4);
      expect(previous.map((p) => p.time)).toEqual([2, 5]);
      expect(useProjectStore.getState().customSnapPoints).not.toBe(previous);
    });

    it("live moves never touch history or dirty flags", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([2]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      const id = idAt(0);
      useProjectStore.getState().moveCustomSnapPoint(id, 4);
      useProjectStore.getState().moveCustomSnapPoint(id, 6);
      expect(useProjectStore.getState().history.length).toBe(0);
      expect(useProjectStore.getState().isDirty).toBe(false);
      expect(useProjectStore.getState().isDirtySinceHistory).toBe(false);
    });

    it("an unknown-id move leaves the array reference untouched", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([2]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      const previous = useProjectStore.getState().customSnapPoints;
      useProjectStore.getState().moveCustomSnapPoint("nope", 1);
      expect(useProjectStore.getState().customSnapPoints).toBe(previous);
    });

    it("a committed drag marks the store dirty and clears isDirtySinceHistory", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([2]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      const baseline = useProjectStore.getState().customSnapPoints;
      useProjectStore.getState().moveCustomSnapPoint(idAt(0), 6);
      useProjectStore.getState().commitSnapPointDrag(baseline);
      expect(useProjectStore.getState().isDirty).toBe(true);
      expect(useProjectStore.getState().isDirtySinceHistory).toBe(false);
    });

    it("a drag preserves lines and groups across undo/redo", () => {
      const lines = [createLine({ text: "hi" })];
      useProjectStore.setState({
        customSnapPoints: snapPoints([2]),
        lines: structuredClone(lines),
        groups: [],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      const baseline = useProjectStore.getState().customSnapPoints;
      useProjectStore.getState().moveCustomSnapPoint(idAt(0), 6);
      useProjectStore.getState().commitSnapPointDrag(baseline);
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().lines).toEqual(lines);
      useProjectStore.getState().redo();
      expect(useProjectStore.getState().lines).toEqual(lines);
    });

    it("regression: a drag preserves the dragged point's id across moves and commit", () => {
      useProjectStore.setState({
        customSnapPoints: snapPoints([2, 8]),
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      const baseline = useProjectStore.getState().customSnapPoints;
      const movedId = idOfTime(2);
      const stationaryId = idOfTime(8);
      useProjectStore.getState().moveCustomSnapPoint(movedId, 5);
      useProjectStore.getState().moveCustomSnapPoint(movedId, 9); // crosses the 8 point, reorders
      useProjectStore.getState().commitSnapPointDrag(baseline);
      const final = useProjectStore.getState().customSnapPoints;
      expect(final.map((p) => p.time)).toEqual([8, 9]);
      expect(final.length).toBe(2);
      // The moved point kept its identity even after reordering past its sibling.
      expect(final.find((p) => p.id === movedId)?.time).toBe(9);
      expect(final.find((p) => p.id === stationaryId)?.time).toBe(8);
    });
  });
});
