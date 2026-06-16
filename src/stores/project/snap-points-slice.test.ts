import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";

describe("project snap points: setCustomSnapPoints", () => {
  beforeEach(() => useProjectStore.setState({ customSnapPoints: [] }));

  it("filters non-finite and negative values and sorts ascending", () => {
    useProjectStore.getState().setCustomSnapPoints([3, 1, -2, Number.NaN, Number.POSITIVE_INFINITY]);
    expect(useProjectStore.getState().customSnapPoints).toEqual([1, 3]);
  });

  it("keeps zero and allows duplicates", () => {
    useProjectStore.getState().setCustomSnapPoints([2, 0, 2]);
    expect(useProjectStore.getState().customSnapPoints).toEqual([0, 2, 2]);
  });
});

describe("project snap points: clearCustomSnapPoints", () => {
  it("clearCustomSnapPoints empties a populated array", () => {
    useProjectStore.setState({ customSnapPoints: [1, 2, 3] });
    useProjectStore.getState().clearCustomSnapPoints();
    expect(useProjectStore.getState().customSnapPoints).toEqual([]);
  });

  it("clearCustomSnapPoints on an already-empty array stays empty", () => {
    useProjectStore.setState({ customSnapPoints: [] });
    useProjectStore.getState().clearCustomSnapPoints();
    expect(useProjectStore.getState().customSnapPoints).toEqual([]);
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
    expect(useProjectStore.getState().customSnapPoints).toEqual([5]);
    useProjectStore.getState().addCustomSnapPoint(2);
    expect(useProjectStore.getState().customSnapPoints).toEqual([2, 5]); // sorted
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().customSnapPoints).toEqual([5]);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().customSnapPoints).toEqual([]);
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().customSnapPoints).toEqual([5]);
  });

  it("removeCustomSnapPoint removes by index and is undoable", () => {
    useProjectStore.setState({
      customSnapPoints: [1, 3],
      history: [],
      historyIndex: -1,
      isDirty: false,
      isDirtySinceHistory: false,
    });
    useProjectStore.getState().removeCustomSnapPoint(0);
    expect(useProjectStore.getState().customSnapPoints).toEqual([3]);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().customSnapPoints).toEqual([1, 3]);
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().customSnapPoints).toEqual([3]);
  });

  it("removeCustomSnapPoint ignores out-of-range indices (no history entry)", () => {
    useProjectStore.setState({
      customSnapPoints: [1, 3],
      history: [],
      historyIndex: -1,
      isDirty: false,
      isDirtySinceHistory: false,
    });
    const before = useProjectStore.getState().history.length;
    useProjectStore.getState().removeCustomSnapPoint(-1);
    useProjectStore.getState().removeCustomSnapPoint(99);
    expect(useProjectStore.getState().customSnapPoints).toEqual([1, 3]);
    expect(useProjectStore.getState().history.length).toBe(before);
  });

  describe("edge cases", () => {
    it("addCustomSnapPoint keeps a duplicate time and stays undoable", () => {
      useProjectStore.setState({
        customSnapPoints: [2],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().addCustomSnapPoint(2);
      expect(useProjectStore.getState().customSnapPoints).toEqual([2, 2]);
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().customSnapPoints).toEqual([2]);
      useProjectStore.getState().redo();
      expect(useProjectStore.getState().customSnapPoints).toEqual([2, 2]);
    });

    it("addCustomSnapPoint filters a negative time via normalize (no point added, but commit still happens)", () => {
      useProjectStore.setState({
        customSnapPoints: [4],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().addCustomSnapPoint(-1);
      expect(useProjectStore.getState().customSnapPoints).toEqual([4]);
    });

    it("addCustomSnapPoint filters a non-finite time via normalize", () => {
      useProjectStore.setState({
        customSnapPoints: [4],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().addCustomSnapPoint(Number.NaN);
      expect(useProjectStore.getState().customSnapPoints).toEqual([4]);
      useProjectStore.getState().addCustomSnapPoint(Number.POSITIVE_INFINITY);
      expect(useProjectStore.getState().customSnapPoints).toEqual([4]);
    });

    it("addCustomSnapPoint keeps zero", () => {
      useProjectStore.setState({
        customSnapPoints: [3],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().addCustomSnapPoint(0);
      expect(useProjectStore.getState().customSnapPoints).toEqual([0, 3]);
    });

    it("removeCustomSnapPoint removing the last point leaves an empty array, undoable", () => {
      useProjectStore.setState({
        customSnapPoints: [7],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().removeCustomSnapPoint(0);
      expect(useProjectStore.getState().customSnapPoints).toEqual([]);
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().customSnapPoints).toEqual([7]);
    });

    it("removeCustomSnapPoint on the last valid index removes only that entry", () => {
      useProjectStore.setState({
        customSnapPoints: [1, 2, 3],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().removeCustomSnapPoint(2);
      expect(useProjectStore.getState().customSnapPoints).toEqual([1, 2]);
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

    it("out-of-range removeCustomSnapPoint leaves dirty flags untouched", () => {
      useProjectStore.setState({
        customSnapPoints: [1, 3],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().removeCustomSnapPoint(99);
      expect(useProjectStore.getState().isDirty).toBe(false);
      expect(useProjectStore.getState().isDirtySinceHistory).toBe(false);
    });

    it("addCustomSnapPoint does not mutate the previous array reference", () => {
      useProjectStore.setState({
        customSnapPoints: [2],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      const previous = useProjectStore.getState().customSnapPoints;
      useProjectStore.getState().addCustomSnapPoint(5);
      expect(previous).toEqual([2]);
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
      expect(useProjectStore.getState().customSnapPoints).toEqual([1, 2, 3]);
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().customSnapPoints).toEqual([1, 2]);
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().customSnapPoints).toEqual([1]);
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().customSnapPoints).toEqual([]);
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
      customSnapPoints: [2],
      history: [],
      historyIndex: -1,
      isDirty: false,
      isDirtySinceHistory: false,
    });
    const baseline = useProjectStore.getState().customSnapPoints; // [2]
    useProjectStore.getState().moveCustomSnapPoint(0, 4); // live, no history
    expect(useProjectStore.getState().customSnapPoints).toEqual([4]);
    useProjectStore.getState().moveCustomSnapPoint(0, 6); // live, no history
    expect(useProjectStore.getState().customSnapPoints).toEqual([6]);
    expect(useProjectStore.getState().history.length).toBe(0); // moves alone create no history
    useProjectStore.getState().commitSnapPointDrag(baseline);
    expect(useProjectStore.getState().customSnapPoints).toEqual([6]);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().customSnapPoints).toEqual([2]); // back to pre-drag, ONE step
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().customSnapPoints).toEqual([6]);
  });

  it("moveCustomSnapPoint ignores out-of-range index", () => {
    useProjectStore.setState({
      customSnapPoints: [2],
      history: [],
      historyIndex: -1,
      isDirty: false,
      isDirtySinceHistory: false,
    });
    useProjectStore.getState().moveCustomSnapPoint(-1, 9);
    useProjectStore.getState().moveCustomSnapPoint(5, 9);
    expect(useProjectStore.getState().customSnapPoints).toEqual([2]);
  });

  it("commitSnapPointDrag with no net change creates no history entry (click without drag)", () => {
    useProjectStore.setState({
      customSnapPoints: [2],
      history: [],
      historyIndex: -1,
      isDirty: false,
      isDirtySinceHistory: false,
    });
    useProjectStore.getState().commitSnapPointDrag([2]); // baseline == current, nothing moved
    expect(useProjectStore.getState().history.length).toBe(0);
    expect(useProjectStore.getState().isDirty).toBe(false);
  });

  it("seeds the pre-drag baseline when it differs from the latest history entry", () => {
    // history top is [2]; a non-history setCustomSnapPoints moved live state to [5] before the drag started
    useProjectStore.setState({
      customSnapPoints: [5],
      history: [{ lines: [], groups: [], customSnapPoints: [2], timestamp: 1 }],
      historyIndex: 0,
      isDirty: true,
      isDirtySinceHistory: false,
    });
    const baseline = useProjectStore.getState().customSnapPoints; // [5]
    useProjectStore.getState().moveCustomSnapPoint(0, 8);
    useProjectStore.getState().commitSnapPointDrag(baseline); // baseline [5] != top entry [2]
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().customSnapPoints).toEqual([5]); // returns to pre-drag [5], not stale [2]
  });

  describe("edge cases", () => {
    it("two independent drags are two undo steps", () => {
      useProjectStore.setState({
        customSnapPoints: [2],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });

      const firstBaseline = useProjectStore.getState().customSnapPoints; // [2]
      useProjectStore.getState().moveCustomSnapPoint(0, 4);
      useProjectStore.getState().commitSnapPointDrag(firstBaseline);
      expect(useProjectStore.getState().customSnapPoints).toEqual([4]);

      const secondBaseline = useProjectStore.getState().customSnapPoints; // [4]
      useProjectStore.getState().moveCustomSnapPoint(0, 9);
      useProjectStore.getState().commitSnapPointDrag(secondBaseline);
      expect(useProjectStore.getState().customSnapPoints).toEqual([9]);

      useProjectStore.getState().undo();
      expect(useProjectStore.getState().customSnapPoints).toEqual([4]); // back through second drag
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().customSnapPoints).toEqual([2]); // back through first drag
      useProjectStore.getState().redo();
      expect(useProjectStore.getState().customSnapPoints).toEqual([4]);
      useProjectStore.getState().redo();
      expect(useProjectStore.getState().customSnapPoints).toEqual([9]);
    });

    it("a drag that crosses another point re-sorts the live array", () => {
      useProjectStore.setState({
        customSnapPoints: [2, 8],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().moveCustomSnapPoint(0, 9); // index 0 dragged past index 1
      expect(useProjectStore.getState().customSnapPoints).toEqual([8, 9]); // normalize re-sorts
    });

    it("commitSnapPointDrag normalizes the baseline it receives", () => {
      useProjectStore.setState({
        customSnapPoints: [3],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      // Caller hands an unsorted, partly-invalid baseline; commit must normalize it.
      const dirtyBaseline = [5, -1, Number.NaN, 1];
      useProjectStore.getState().moveCustomSnapPoint(0, 7);
      expect(useProjectStore.getState().customSnapPoints).toEqual([7]);
      useProjectStore.getState().commitSnapPointDrag(dirtyBaseline);
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().customSnapPoints).toEqual([1, 5]); // normalized baseline restored
    });

    it("moveCustomSnapPoint filters a non-finite target time via normalize", () => {
      useProjectStore.setState({
        customSnapPoints: [2, 5],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().moveCustomSnapPoint(0, Number.NaN);
      expect(useProjectStore.getState().customSnapPoints).toEqual([5]); // moved point filtered out
    });

    it("moveCustomSnapPoint clamps a negative target time out via normalize", () => {
      useProjectStore.setState({
        customSnapPoints: [2, 5],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().moveCustomSnapPoint(1, -3);
      expect(useProjectStore.getState().customSnapPoints).toEqual([2]); // negative target dropped
    });

    it("moveCustomSnapPoint keeps zero as a valid target", () => {
      useProjectStore.setState({
        customSnapPoints: [4],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().moveCustomSnapPoint(0, 0);
      expect(useProjectStore.getState().customSnapPoints).toEqual([0]);
    });
  });

  describe("invariants", () => {
    it("moveCustomSnapPoint does not mutate the previous array reference", () => {
      useProjectStore.setState({
        customSnapPoints: [2, 5],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      const previous = useProjectStore.getState().customSnapPoints;
      useProjectStore.getState().moveCustomSnapPoint(0, 4);
      expect(previous).toEqual([2, 5]);
      expect(useProjectStore.getState().customSnapPoints).not.toBe(previous);
    });

    it("live moves never touch history or dirty flags", () => {
      useProjectStore.setState({
        customSnapPoints: [2],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      useProjectStore.getState().moveCustomSnapPoint(0, 4);
      useProjectStore.getState().moveCustomSnapPoint(0, 6);
      expect(useProjectStore.getState().history.length).toBe(0);
      expect(useProjectStore.getState().isDirty).toBe(false);
      expect(useProjectStore.getState().isDirtySinceHistory).toBe(false);
    });

    it("an out-of-range move leaves the array reference untouched", () => {
      useProjectStore.setState({
        customSnapPoints: [2],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      const previous = useProjectStore.getState().customSnapPoints;
      useProjectStore.getState().moveCustomSnapPoint(9, 1);
      expect(useProjectStore.getState().customSnapPoints).toBe(previous);
    });

    it("a committed drag marks the store dirty and clears isDirtySinceHistory", () => {
      useProjectStore.setState({
        customSnapPoints: [2],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      const baseline = useProjectStore.getState().customSnapPoints;
      useProjectStore.getState().moveCustomSnapPoint(0, 6);
      useProjectStore.getState().commitSnapPointDrag(baseline);
      expect(useProjectStore.getState().isDirty).toBe(true);
      expect(useProjectStore.getState().isDirtySinceHistory).toBe(false);
    });

    it("a drag preserves lines and groups across undo/redo", () => {
      const lines = [createLine({ text: "hi" })];
      useProjectStore.setState({
        customSnapPoints: [2],
        lines: structuredClone(lines),
        groups: [],
        history: [],
        historyIndex: -1,
        isDirty: false,
        isDirtySinceHistory: false,
      });
      const baseline = useProjectStore.getState().customSnapPoints;
      useProjectStore.getState().moveCustomSnapPoint(0, 6);
      useProjectStore.getState().commitSnapPointDrag(baseline);
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().lines).toEqual(lines);
      useProjectStore.getState().redo();
      expect(useProjectStore.getState().lines).toEqual(lines);
    });
  });
});
