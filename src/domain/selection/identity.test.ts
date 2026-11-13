import { isAddressed, sameAddress } from "@/domain/selection/identity";
import type { SyllableAddress } from "@/domain/selection/model";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function sel(extras: { lineId?: string; wordIndex?: number; type?: "word" | "bg" } = {}): SyllableAddress {
  const { lineId = "l1", wordIndex = 0, type = "word" } = extras;
  return { lineId, type, syllableId: `w${wordIndex}` };
}

// -- sameAddress --------------------------------------------------------

describe("sameAddress", () => {
  it("is true when lineId, word, and type all match", () => {
    expect(sameAddress(sel(), sel())).toBe(true);
  });

  it("is false when lineId differs", () => {
    expect(sameAddress(sel({ lineId: "l1" }), sel({ lineId: "l2" }))).toBe(false);
  });

  it("is false when the word differs", () => {
    expect(sameAddress(sel({ wordIndex: 0 }), sel({ wordIndex: 1 }))).toBe(false);
  });

  it("is false when type differs", () => {
    expect(sameAddress(sel({ type: "word" }), sel({ type: "bg" }))).toBe(false);
  });
});

// -- isAddressed -----------------------------------------------------------

describe("isAddressed", () => {
  it("is true when a matching selection is present", () => {
    expect(isAddressed([sel({ wordIndex: 2 })], "l1", "word", "w2")).toBe(true);
  });

  it("is false for an empty selection list", () => {
    expect(isAddressed([], "l1", "word", "w0")).toBe(false);
  });

  it("distinguishes a bg-track query from a word-track selection at the same index", () => {
    expect(isAddressed([sel({ type: "word" })], "l1", "bg", "w0")).toBe(false);
  });

  it("is false when no selection matches the query", () => {
    expect(isAddressed([sel({ wordIndex: 0 }), sel({ wordIndex: 1 })], "l1", "word", "w5")).toBe(false);
  });
});
