import { decideEditTextAction } from "@/domain/edit-text/decide-edit-text-action";
import { syncAddressAt, syncAddressPosition } from "@/domain/sync/address";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

const SLOW = { id: "y1", text: "Slow ", begin: 1, end: 2 };
const TIDE = { id: "y2", text: "tide ", begin: 2, end: 3 };
const PULLS = { id: "y3", text: "pulls ", begin: 3, end: 4 };

const tideLine = (
  words: { id: string; text: string; sep?: string; begin: number; end: number }[],
  text = "Slow tide pulls the harbour lights",
) => createLine({ id: "tide", text, words });

describe("syncAddressPosition", () => {
  it("stays on the next untimed word when a timed word before it is split", () => {
    const stored = syncAddressAt([tideLine([SLOW, TIDE, PULLS])], { lineIndex: 0, wordIndex: 3 });
    const split = tideLine(
      [SLOW, TIDE, { ...PULLS, text: "pu", sep: "", end: 3.5 }, { ...PULLS, id: "y9", begin: 3.5, text: "lls " }],
      "Slow tide pu|lls the harbour lights",
    );
    expect(syncAddressPosition([split], stored)).toEqual({ lineIndex: 0, wordIndex: 4 });
  });

  it("follows a timed word the cursor sits on when a line is added above", () => {
    const line = tideLine([SLOW, TIDE, PULLS]);
    const stored = syncAddressAt([line], { lineIndex: 0, wordIndex: 1 });
    expect(syncAddressPosition([createLine({ text: "Morning bells" }), line], stored)).toEqual({
      lineIndex: 1,
      wordIndex: 1,
    });
  });

  it("falls back to where the cursor stood when its word is gone", () => {
    const stored = syncAddressAt([tideLine([SLOW, TIDE, PULLS])], { lineIndex: 0, wordIndex: 2 });
    expect(syncAddressPosition([tideLine([SLOW, TIDE])], stored)).toEqual({ lineIndex: 0, wordIndex: 2 });
  });

  it("stays on its untimed syllable when Edit inserts a word before it", () => {
    const line = tideLine([SLOW, TIDE, PULLS]);
    const stored = syncAddressAt([line], { lineIndex: 0, wordIndex: 4 });
    const action = decideEditTextAction({
      text: "Slow tide pulls the old harbour lights",
      defaultAgentId: "v1",
      lines: [line],
      groups: [],
      modalPending: false,
    });
    if (action.kind !== "apply") throw new Error(`expected an applied edit, got ${action.kind}`);
    expect(syncAddressPosition(action.finalLines, stored)).toEqual({ lineIndex: 0, wordIndex: 5 });
  });
});
