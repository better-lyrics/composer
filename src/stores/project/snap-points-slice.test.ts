import { useProjectStore } from "@/stores/project";
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
    useProjectStore.setState({ customSnapPoints: [], history: [], historyIndex: -1, isDirty: false, isDirtySinceHistory: false });
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
    useProjectStore.setState({ customSnapPoints: [1, 3], history: [], historyIndex: -1, isDirty: false, isDirtySinceHistory: false });
    useProjectStore.getState().removeCustomSnapPoint(0);
    expect(useProjectStore.getState().customSnapPoints).toEqual([3]);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().customSnapPoints).toEqual([1, 3]);
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().customSnapPoints).toEqual([3]);
  });

  it("removeCustomSnapPoint ignores out-of-range indices (no history entry)", () => {
    useProjectStore.setState({ customSnapPoints: [1, 3], history: [], historyIndex: -1, isDirty: false, isDirtySinceHistory: false });
    const before = useProjectStore.getState().history.length;
    useProjectStore.getState().removeCustomSnapPoint(-1);
    useProjectStore.getState().removeCustomSnapPoint(99);
    expect(useProjectStore.getState().customSnapPoints).toEqual([1, 3]);
    expect(useProjectStore.getState().history.length).toBe(before);
  });

  describe("edge cases", () => {
    it("addCustomSnapPoint keeps a duplicate time and stays undoable", () => {
      useProjectStore.setState({ customSnapPoints: [2], history: [], historyIndex: -1, isDirty: false, isDirtySinceHistory: false });
      useProjectStore.getState().addCustomSnapPoint(2);
      expect(useProjectStore.getState().customSnapPoints).toEqual([2, 2]);
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().customSnapPoints).toEqual([2]);
      useProjectStore.getState().redo();
      expect(useProjectStore.getState().customSnapPoints).toEqual([2, 2]);
    });

    it("addCustomSnapPoint filters a negative time via normalize (no point added, but commit still happens)", () => {
      useProjectStore.setState({ customSnapPoints: [4], history: [], historyIndex: -1, isDirty: false, isDirtySinceHistory: false });
      useProjectStore.getState().addCustomSnapPoint(-1);
      expect(useProjectStore.getState().customSnapPoints).toEqual([4]);
    });

    it("addCustomSnapPoint filters a non-finite time via normalize", () => {
      useProjectStore.setState({ customSnapPoints: [4], history: [], historyIndex: -1, isDirty: false, isDirtySinceHistory: false });
      useProjectStore.getState().addCustomSnapPoint(Number.NaN);
      expect(useProjectStore.getState().customSnapPoints).toEqual([4]);
      useProjectStore.getState().addCustomSnapPoint(Number.POSITIVE_INFINITY);
      expect(useProjectStore.getState().customSnapPoints).toEqual([4]);
    });

    it("addCustomSnapPoint keeps zero", () => {
      useProjectStore.setState({ customSnapPoints: [3], history: [], historyIndex: -1, isDirty: false, isDirtySinceHistory: false });
      useProjectStore.getState().addCustomSnapPoint(0);
      expect(useProjectStore.getState().customSnapPoints).toEqual([0, 3]);
    });

    it("removeCustomSnapPoint removing the last point leaves an empty array, undoable", () => {
      useProjectStore.setState({ customSnapPoints: [7], history: [], historyIndex: -1, isDirty: false, isDirtySinceHistory: false });
      useProjectStore.getState().removeCustomSnapPoint(0);
      expect(useProjectStore.getState().customSnapPoints).toEqual([]);
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().customSnapPoints).toEqual([7]);
    });

    it("removeCustomSnapPoint on the last valid index removes only that entry", () => {
      useProjectStore.setState({ customSnapPoints: [1, 2, 3], history: [], historyIndex: -1, isDirty: false, isDirtySinceHistory: false });
      useProjectStore.getState().removeCustomSnapPoint(2);
      expect(useProjectStore.getState().customSnapPoints).toEqual([1, 2]);
    });
  });

  describe("invariants", () => {
    it("addCustomSnapPoint marks the store dirty", () => {
      useProjectStore.setState({ customSnapPoints: [], history: [], historyIndex: -1, isDirty: false, isDirtySinceHistory: false });
      useProjectStore.getState().addCustomSnapPoint(5);
      expect(useProjectStore.getState().isDirty).toBe(true);
    });

    it("out-of-range removeCustomSnapPoint leaves dirty flags untouched", () => {
      useProjectStore.setState({ customSnapPoints: [1, 3], history: [], historyIndex: -1, isDirty: false, isDirtySinceHistory: false });
      useProjectStore.getState().removeCustomSnapPoint(99);
      expect(useProjectStore.getState().isDirty).toBe(false);
      expect(useProjectStore.getState().isDirtySinceHistory).toBe(false);
    });

    it("addCustomSnapPoint does not mutate the previous array reference", () => {
      useProjectStore.setState({ customSnapPoints: [2], history: [], historyIndex: -1, isDirty: false, isDirtySinceHistory: false });
      const previous = useProjectStore.getState().customSnapPoints;
      useProjectStore.getState().addCustomSnapPoint(5);
      expect(previous).toEqual([2]);
      expect(useProjectStore.getState().customSnapPoints).not.toBe(previous);
    });

    it("each add is exactly one undo step", () => {
      useProjectStore.setState({ customSnapPoints: [], history: [], historyIndex: -1, isDirty: false, isDirtySinceHistory: false });
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
