import { beforeEach, describe, expect, it } from "vitest";
import { useTimelineStore } from "@/views/timeline/timeline-store";

describe("rollingEditMode", () => {
  it("defaults to off and toggles", () => {
    useTimelineStore.setState({ rollingEditMode: false });
    expect(useTimelineStore.getState().rollingEditMode).toBe(false);
    useTimelineStore.getState().toggleRollingEditMode();
    expect(useTimelineStore.getState().rollingEditMode).toBe(true);
  });
});

describe("markerMode", () => {
  beforeEach(() => {
    useTimelineStore.setState({ markerMode: false });
  });

  it("defaults to false", () => {
    expect(useTimelineStore.getState().markerMode).toBe(false);
  });

  it("toggleMarkerMode flips it", () => {
    useTimelineStore.getState().toggleMarkerMode();
    expect(useTimelineStore.getState().markerMode).toBe(true);
  });

  describe("invariants", () => {
    it("toggling twice returns to false", () => {
      const s = useTimelineStore.getState();
      s.toggleMarkerMode();
      s.toggleMarkerMode();
      expect(useTimelineStore.getState().markerMode).toBe(false);
    });

    it("is independent of customSnapPoints", () => {
      const s = useTimelineStore.getState();
      useTimelineStore.setState({ customSnapPoints: [] });
      s.toggleMarkerMode();
      expect(useTimelineStore.getState().customSnapPoints).toEqual([]);

      s.addCustomSnapPoint(2);
      expect(useTimelineStore.getState().markerMode).toBe(true);

      s.toggleMarkerMode();
      expect(useTimelineStore.getState().customSnapPoints).toEqual([2]);
    });
  });
});

describe("customSnapPoints", () => {
  beforeEach(() => {
    useTimelineStore.setState({ customSnapPoints: [] });
  });

  it("addCustomSnapPoint inserts, filters non-finite/negative, sorts asc", () => {
    const s = useTimelineStore.getState();
    s.addCustomSnapPoint(3);
    s.addCustomSnapPoint(1);
    s.addCustomSnapPoint(-2);
    s.addCustomSnapPoint(Number.NaN);
    expect(useTimelineStore.getState().customSnapPoints).toEqual([1, 3]);
  });

  it("removeCustomSnapPoint removes by index", () => {
    const s = useTimelineStore.getState();
    s.addCustomSnapPoint(1);
    s.addCustomSnapPoint(2);
    s.addCustomSnapPoint(3);
    s.removeCustomSnapPoint(1);
    expect(useTimelineStore.getState().customSnapPoints).toEqual([1, 3]);
  });

  it("moveCustomSnapPoint repositions and re-sorts", () => {
    const s = useTimelineStore.getState();
    s.addCustomSnapPoint(1);
    s.addCustomSnapPoint(3);
    s.moveCustomSnapPoint(0, 5);
    expect(useTimelineStore.getState().customSnapPoints).toEqual([3, 5]);
  });

  it("clearCustomSnapPoints empties", () => {
    const s = useTimelineStore.getState();
    s.addCustomSnapPoint(1);
    s.addCustomSnapPoint(2);
    s.clearCustomSnapPoints();
    expect(useTimelineStore.getState().customSnapPoints).toEqual([]);
  });

  describe("edge cases", () => {
    it("keeps duplicate times (no dedupe, mirrors setVocalOnsetSnapPoints)", () => {
      const s = useTimelineStore.getState();
      s.addCustomSnapPoint(2);
      s.addCustomSnapPoint(2);
      expect(useTimelineStore.getState().customSnapPoints).toEqual([2, 2]);
    });

    it("accepts zero as a valid snap point", () => {
      const s = useTimelineStore.getState();
      s.addCustomSnapPoint(0);
      expect(useTimelineStore.getState().customSnapPoints).toEqual([0]);
    });

    it("rejects Infinity and -Infinity", () => {
      const s = useTimelineStore.getState();
      s.addCustomSnapPoint(Number.POSITIVE_INFINITY);
      s.addCustomSnapPoint(Number.NEGATIVE_INFINITY);
      expect(useTimelineStore.getState().customSnapPoints).toEqual([]);
    });

    it("moveCustomSnapPoint to a non-finite value drops the moved entry", () => {
      const s = useTimelineStore.getState();
      s.addCustomSnapPoint(1);
      s.addCustomSnapPoint(3);
      s.moveCustomSnapPoint(0, Number.NaN);
      expect(useTimelineStore.getState().customSnapPoints).toEqual([3]);
    });

    it("moveCustomSnapPoint to a negative value drops the moved entry", () => {
      const s = useTimelineStore.getState();
      s.addCustomSnapPoint(1);
      s.addCustomSnapPoint(3);
      s.moveCustomSnapPoint(1, -5);
      expect(useTimelineStore.getState().customSnapPoints).toEqual([1]);
    });

    it("moveCustomSnapPoint with out-of-range index is a no-op", () => {
      const s = useTimelineStore.getState();
      s.addCustomSnapPoint(1);
      s.addCustomSnapPoint(3);
      s.moveCustomSnapPoint(5, 99);
      expect(useTimelineStore.getState().customSnapPoints).toEqual([1, 3]);
      s.moveCustomSnapPoint(-1, 99);
      expect(useTimelineStore.getState().customSnapPoints).toEqual([1, 3]);
    });

    it("removeCustomSnapPoint with out-of-range index is a no-op", () => {
      const s = useTimelineStore.getState();
      s.addCustomSnapPoint(1);
      s.addCustomSnapPoint(3);
      s.removeCustomSnapPoint(5);
      expect(useTimelineStore.getState().customSnapPoints).toEqual([1, 3]);
      s.removeCustomSnapPoint(-1);
      expect(useTimelineStore.getState().customSnapPoints).toEqual([1, 3]);
    });

    it("clearCustomSnapPoints on an already-empty array stays empty", () => {
      const s = useTimelineStore.getState();
      s.clearCustomSnapPoints();
      expect(useTimelineStore.getState().customSnapPoints).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("stays sorted ascending after every operation", () => {
      const s = useTimelineStore.getState();
      s.addCustomSnapPoint(9);
      s.addCustomSnapPoint(2);
      s.addCustomSnapPoint(5);
      expect(useTimelineStore.getState().customSnapPoints).toEqual([2, 5, 9]);
      s.moveCustomSnapPoint(0, 7);
      expect(useTimelineStore.getState().customSnapPoints).toEqual([5, 7, 9]);
      s.removeCustomSnapPoint(1);
      expect(useTimelineStore.getState().customSnapPoints).toEqual([5, 9]);
    });

    it("writes a new array reference each mutation (no in-place mutation)", () => {
      const s = useTimelineStore.getState();
      s.addCustomSnapPoint(1);
      const afterAdd = useTimelineStore.getState().customSnapPoints;
      s.addCustomSnapPoint(2);
      const afterSecondAdd = useTimelineStore.getState().customSnapPoints;
      expect(afterSecondAdd).not.toBe(afterAdd);

      s.moveCustomSnapPoint(0, 4);
      const afterMove = useTimelineStore.getState().customSnapPoints;
      expect(afterMove).not.toBe(afterSecondAdd);

      s.removeCustomSnapPoint(0);
      const afterRemove = useTimelineStore.getState().customSnapPoints;
      expect(afterRemove).not.toBe(afterMove);
    });

    it("out-of-range move is a true no-op and preserves the array reference", () => {
      const s = useTimelineStore.getState();
      s.addCustomSnapPoint(1);
      const before = useTimelineStore.getState().customSnapPoints;
      s.moveCustomSnapPoint(99, 5);
      const after = useTimelineStore.getState().customSnapPoints;
      expect(after).toEqual([1]);
      expect(after).toBe(before);
    });
  });
});
