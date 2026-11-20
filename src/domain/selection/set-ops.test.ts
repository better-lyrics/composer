import type { SyllableAddress } from "@/domain/selection/model";
import { mergeAddresses, toggleAddress } from "@/domain/selection/set-ops";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function sel(extras: { lineId?: string; wordIndex?: number; type?: "word" | "bg" } = {}): SyllableAddress {
  const { lineId = "l1", wordIndex = 0, type = "word" } = extras;
  return { lineId, type, syllableId: `w${wordIndex}` };
}

// -- toggleAddress ------------------------------------------------------

describe("toggleAddress", () => {
  it("adds a selection that is not yet present", () => {
    expect(toggleAddress([], sel({ wordIndex: 1 }))).toEqual([sel({ wordIndex: 1 })]);
  });

  it("removes a selection that is already present", () => {
    expect(toggleAddress([sel({ wordIndex: 1 })], sel({ wordIndex: 1 }))).toEqual([]);
  });

  it("leaves other selections intact when removing one", () => {
    expect(toggleAddress([sel({ wordIndex: 0 }), sel({ wordIndex: 1 })], sel({ wordIndex: 0 }))).toEqual([
      sel({ wordIndex: 1 }),
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [sel({ wordIndex: 0 })];
    toggleAddress(input, sel({ wordIndex: 1 }));
    expect(input).toEqual([sel({ wordIndex: 0 })]);
  });
});

// -- mergeAddresses ------------------------------------------------------

describe("mergeAddresses", () => {
  it("returns the incoming selections when existing is empty", () => {
    expect(mergeAddresses([], [sel()])).toEqual([sel()]);
  });

  it("appends only selections not already present", () => {
    expect(mergeAddresses([sel({ wordIndex: 0 })], [sel({ wordIndex: 0 }), sel({ wordIndex: 1 })])).toEqual([
      sel({ wordIndex: 0 }),
      sel({ wordIndex: 1 }),
    ]);
  });

  it("does not mutate the existing array", () => {
    const existing = [sel({ wordIndex: 0 })];
    mergeAddresses(existing, [sel({ wordIndex: 1 })]);
    expect(existing).toEqual([sel({ wordIndex: 0 })]);
  });

  it("dedupes duplicates within the incoming list", () => {
    expect(mergeAddresses([], [sel({ wordIndex: 0 }), sel({ wordIndex: 0 }), sel({ wordIndex: 1 })])).toEqual([
      sel({ wordIndex: 0 }),
      sel({ wordIndex: 1 }),
    ]);
  });
});
