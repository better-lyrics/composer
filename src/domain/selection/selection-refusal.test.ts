import { describe, expect, it } from "vitest";
import type { SyllableAddress } from "@/domain/selection/model";
import { selectionRefusal } from "@/domain/selection/selection-refusal";

// -- Helpers ------------------------------------------------------------------

function address(syllableId: string, extras: Partial<SyllableAddress> = {}): SyllableAddress {
  return { lineId: "l1", type: "word", syllableId, ...extras };
}

// -- selectionRefusal ---------------------------------------------------------

describe("selectionRefusal", () => {
  it("refuses editing or splitting more than one word", () => {
    const selection = [address("w1"), address("w2")];
    expect(selectionRefusal("editText", selection)).toEqual({ reason: "needs-one-word", selected: 2 });
    expect(selectionRefusal("split", selection)).toEqual({ reason: "needs-one-word", selected: 2 });
  });

  it("refuses merging or joining across lines before across tracks", () => {
    const selection = [address("w1"), address("b1", { lineId: "l2", type: "bg" })];
    expect(selectionRefusal("mergeWords", selection)).toEqual({ reason: "needs-one-run", across: "lines" });
    expect(selectionRefusal("joinSyllables", selection)).toEqual({ reason: "needs-one-run", across: "lines" });
  });

  it("refuses merging main and background words together", () => {
    const selection = [address("w1"), address("b1", { type: "bg" })];
    expect(selectionRefusal("mergeWords", selection)).toEqual({ reason: "needs-one-run", across: "tracks" });
  });

  it("stays silent when the selection gives no reason to explain", () => {
    expect(selectionRefusal("editText", [])).toBeNull();
    expect(selectionRefusal("mergeWords", [address("w1"), address("w3")])).toBeNull();
    expect(selectionRefusal("joinSyllables", [address("w1"), address("b1", { type: "bg" })])).toBeNull();
  });
});
