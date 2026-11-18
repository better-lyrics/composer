import { decideEditTextAction } from "@/domain/edit-text/decide-edit-text-action";
import { mainTrack, timedSyllables } from "insync/line-track";
import { convertLineToWord } from "insync/line-span-to-words";
import type { LyricLine } from "insync/line";
import { withRoleWords } from "insync/line-track-writes";
import { syncAddressAt, syncAddressPosition } from "insync/sync-address";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

const SLOW = { id: "y1", text: "Slow ", begin: 1, end: 2 };
const TIDE = { id: "y2", text: "tide ", begin: 2, end: 3 };
const PULLS = { id: "y3", text: "pulls ", begin: 3, end: 4 };

const tideLine = (
  words: { id: string; text: string; sep?: string; begin: number; end: number }[],
  text = "Slow tide pulls the harbour lights",
) => createLine({ id: "tide", text, words });

const editTo = (line: LyricLine, text: string): LyricLine[] => {
  const action = decideEditTextAction({
    text,
    defaultAgentId: "v1",
    lines: [line],
    groups: [],
    splitCharacter: DEFAULT_SPLIT_CHARACTER,
  });
  if (action.kind !== "apply") throw new Error(`expected an applied edit, got ${action.kind}`);
  return action.finalLines;
};

describe("syncAddressPosition", () => {
  it("stays on the next untimed word when a timed word before it is split", () => {
    const line = tideLine([SLOW, TIDE, PULLS]);
    const stored = syncAddressAt([line], { lineIndex: 0, wordIndex: 3 });
    const [slow, tide, pulls] = timedSyllables(mainTrack(line));
    const split = withRoleWords(line, "main", [
      slow,
      tide,
      { ...pulls, text: "pu", sep: "", joinsNext: true, end: 3.5 },
      { ...pulls, id: "y9", begin: 3.5, text: "lls" },
    ]);
    expect(syncAddressPosition([split], stored)).toEqual({ lineIndex: 0, wordIndex: 4 });
  });

  it("regression: stays on the selected untimed word when another action times the line", () => {
    const untimed = createLine({ id: "dawn", text: "Dawn breaks over quiet hills", begin: 4, end: 8 });
    const stored = syncAddressAt([untimed], { lineIndex: 0, wordIndex: 0 });
    expect(syncAddressPosition([convertLineToWord(untimed)], stored)).toEqual({ lineIndex: 0, wordIndex: 0 });
  });

  it("regression: stays on its untimed word when text after it is deleted", () => {
    const stored = syncAddressAt([tideLine([SLOW, TIDE])], { lineIndex: 0, wordIndex: 2 });
    const trimmed = tideLine([SLOW, TIDE], "Slow tide pulls the harbour");
    expect(syncAddressPosition([trimmed], stored)).toEqual({ lineIndex: 0, wordIndex: 2 });
  });

  it("regression: stays on its untimed word when a word is inserted before it", () => {
    const line = tideLine([SLOW, TIDE]);
    const stored = syncAddressAt([line], { lineIndex: 0, wordIndex: 2 });
    const prepended = editTo(line, "Still slow tide pulls the harbour lights");
    expect(syncAddressPosition(prepended, stored)).toEqual({ lineIndex: 0, wordIndex: 3 });
  });

  it("regression: stays on its untimed word when the timed word before it is replaced", () => {
    const line = tideLine([SLOW, TIDE]);
    const stored = syncAddressAt([line], { lineIndex: 0, wordIndex: 2 });
    const [slow] = timedSyllables(mainTrack(line));
    const replaced = withRoleWords(line, "main", [
      slow,
      { id: "y7", text: "ti", sep: "", joinsNext: true, begin: 2, end: 2.5 },
      { id: "y8", text: "de", sep: " ", joinsNext: false, begin: 2.5, end: 3 },
    ]);
    expect(syncAddressPosition([replaced], stored)).toEqual({ lineIndex: 0, wordIndex: 3 });
  });

  it("stays on an untimed syllable inside its word when an earlier word is split", () => {
    const line = tideLine([SLOW, TIDE], "Slow tide pulls the har|bour lights");
    const stored = syncAddressAt([line], { lineIndex: 0, wordIndex: 5 });
    const [slow, tide] = timedSyllables(mainTrack(line));
    const split = withRoleWords(line, "main", [
      slow,
      { ...tide, text: "ti", sep: "", joinsNext: true, end: 2.5 },
      { ...tide, id: "y8", begin: 2.5, text: "de" },
    ]);
    expect(syncAddressPosition([split], stored)).toEqual({ lineIndex: 0, wordIndex: 6 });
  });

  it("stays on its untimed syllable when a later syllable of its word is split", () => {
    const stored = syncAddressAt([tideLine([SLOW, TIDE], "Slow tide pulls the har|bour lights")], {
      lineIndex: 0,
      wordIndex: 5,
    });
    const split = tideLine([SLOW, TIDE], "Slow tide pulls the har|bo|ur lights");
    expect(syncAddressPosition([split], stored)).toEqual({ lineIndex: 0, wordIndex: 5 });
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
    const edited = editTo(line, "Slow tide pulls the old harbour lights");
    expect(syncAddressPosition(edited, stored)).toEqual({ lineIndex: 0, wordIndex: 5 });
  });
});
