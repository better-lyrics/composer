import { EMPTY_SELECTION, selectAllOf, toggleSelection, visibleSelection } from "@/views/library/selection";
import { describe, expect, it } from "vitest";

const ORDER = ["a", "b", "c", "d"];

describe("toggleSelection", () => {
  it("adds and removes one project and remembers it as the anchor", () => {
    const one = toggleSelection(EMPTY_SELECTION, "b", false, ORDER);
    expect([...one.picked]).toEqual(["b"]);
    expect(one.anchorId).toBe("b");
    expect(toggleSelection(one, "b", false, ORDER).picked.size).toBe(0);
  });

  it("adds the whole range from the anchor on shift, in either direction", () => {
    const anchored = toggleSelection(EMPTY_SELECTION, "b", false, ORDER);
    expect([...toggleSelection(anchored, "d", true, ORDER).picked].toSorted()).toEqual(["b", "c", "d"]);
    const reversed = toggleSelection(EMPTY_SELECTION, "c", false, ORDER);
    expect([...toggleSelection(reversed, "a", true, ORDER).picked].toSorted()).toEqual(["a", "b", "c"]);
  });

  describe("edge cases", () => {
    it("toggles one project when shift has no anchor or the anchor is not shown", () => {
      expect([...toggleSelection(EMPTY_SELECTION, "c", true, ORDER).picked]).toEqual(["c"]);
      const hiddenAnchor = { picked: new Set(["z"]), anchorId: "z" };
      expect([...toggleSelection(hiddenAnchor, "c", true, ORDER).picked].toSorted()).toEqual(["c", "z"]);
    });
  });

  describe("invariants", () => {
    it("never mutates the previous state", () => {
      const before = toggleSelection(EMPTY_SELECTION, "a", false, ORDER);
      const snapshot = [...before.picked];
      toggleSelection(before, "d", true, ORDER);
      expect([...before.picked]).toEqual(snapshot);
    });
  });
});

describe("selectAllOf and visibleSelection", () => {
  it("selects every shown project", () => {
    expect([...selectAllOf(EMPTY_SELECTION, ORDER).picked]).toEqual(ORDER);
  });

  it("keeps only the picked projects the view shows", () => {
    const state = { picked: new Set(["a", "z"]), anchorId: "a" };
    expect([...visibleSelection(state, ORDER)]).toEqual(["a"]);
  });

  describe("invariants", () => {
    it("returns the same empty set when nothing is selected", () => {
      expect(visibleSelection(EMPTY_SELECTION, ORDER)).toBe(visibleSelection(EMPTY_SELECTION, ["x"]));
    });
  });
});
