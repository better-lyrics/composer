import type { WordSelection } from "@/domain/selection/model";
import { mergeWordSelections, selectionsAfterWordInsert, toggleWordSelection } from "@/domain/selection/set-ops";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function sel(extras: Partial<WordSelection> = {}): WordSelection {
  return { lineId: "l1", lineIndex: 0, wordIndex: 0, type: "word", ...extras };
}

// -- toggleWordSelection ------------------------------------------------------

describe("toggleWordSelection", () => {
  it("adds a selection that is not yet present", () => {
    expect(toggleWordSelection([], sel({ wordIndex: 1 }))).toEqual([sel({ wordIndex: 1 })]);
  });

  it("removes a selection that is already present", () => {
    expect(toggleWordSelection([sel({ wordIndex: 1 })], sel({ wordIndex: 1 }))).toEqual([]);
  });

  it("removes by identity, ignoring lineIndex", () => {
    expect(toggleWordSelection([sel({ wordIndex: 1, lineIndex: 3 })], sel({ wordIndex: 1, lineIndex: 9 }))).toEqual([]);
  });

  it("leaves other selections intact when removing one", () => {
    expect(toggleWordSelection([sel({ wordIndex: 0 }), sel({ wordIndex: 1 })], sel({ wordIndex: 0 }))).toEqual([
      sel({ wordIndex: 1 }),
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [sel({ wordIndex: 0 })];
    toggleWordSelection(input, sel({ wordIndex: 1 }));
    expect(input).toEqual([sel({ wordIndex: 0 })]);
  });
});

// -- mergeWordSelections ------------------------------------------------------

describe("mergeWordSelections", () => {
  it("returns the incoming selections when existing is empty", () => {
    expect(mergeWordSelections([], [sel()])).toEqual([sel()]);
  });

  it("appends only selections not already present", () => {
    expect(mergeWordSelections([sel({ wordIndex: 0 })], [sel({ wordIndex: 0 }), sel({ wordIndex: 1 })])).toEqual([
      sel({ wordIndex: 0 }),
      sel({ wordIndex: 1 }),
    ]);
  });

  it("does not mutate the existing array", () => {
    const existing = [sel({ wordIndex: 0 })];
    mergeWordSelections(existing, [sel({ wordIndex: 1 })]);
    expect(existing).toEqual([sel({ wordIndex: 0 })]);
  });

  it("dedupes duplicates within the incoming list", () => {
    expect(mergeWordSelections([], [sel({ wordIndex: 0 }), sel({ wordIndex: 0 }), sel({ wordIndex: 1 })])).toEqual([
      sel({ wordIndex: 0 }),
      sel({ wordIndex: 1 }),
    ]);
  });
});

// -- selectionsAfterWordInsert ------------------------------------------------

describe("selectionsAfterWordInsert", () => {
  it("regression: a word inserted before the selection keeps the selection on the same words", () => {
    const selections = [sel({ wordIndex: 1 }), sel({ wordIndex: 2 })];
    expect(selectionsAfterWordInsert(selections, "l1", "word", 1)).toEqual([
      sel({ wordIndex: 2 }),
      sel({ wordIndex: 3 }),
    ]);
  });

  it("leaves selections before the insert, on other tracks and on other lines alone", () => {
    const selections = [sel({ wordIndex: 0 }), sel({ wordIndex: 2, type: "bg" }), sel({ lineId: "l2", wordIndex: 2 })];
    expect(selectionsAfterWordInsert(selections, "l1", "word", 1)).toEqual(selections);
  });
});
