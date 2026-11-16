import { describe, expect, it } from "vitest";
import { editRows, remapBackgroundRanges } from "@/domain/edit-text/background-ranges";
import { shownEditText } from "insync/edit-text-shown-row";
import { createLine } from "@/test/factories";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

// -- Fixtures -----------------------------------------------------------------

const lines = [
  createLine({
    id: "middle",
    text: "Run to the sea",
    words: [
      { text: "Run", sep: " ", begin: 1, end: 2 },
      { text: "to", sep: " ", begin: 4, end: 5 },
      { text: "the", sep: " ", begin: 5, end: 6 },
      { text: "sea", begin: 6, end: 7 },
    ],
    backgroundText: "go",
    backgroundWords: [{ text: "go", begin: 2.5, end: 3.5 }],
  }),
  createLine({ id: "literal", text: "Say (it) again", backgroundText: "(again)", backgroundTextSource: "extraction" }),
  createLine({ id: "plain", text: "Quiet now" }),
];

// -- Tests --------------------------------------------------------------------

describe("inline backgrounds in the Edit text", () => {
  it("reads every shown row back into the tracks it came from", () => {
    const shown = shownEditText(lines, DEFAULT_SPLIT_CHARACTER);
    expect(shown.text).toBe("Run (go) to the sea\nSay (it) again (again)\nQuiet now");
    expect(editRows(shown.text, shown.ranges)).toEqual([
      { text: "Run to the sea", background: "go" },
      { text: "Say (it) again", background: "(again)" },
      { text: "Quiet now", background: null },
    ]);
  });

  it("edits the background inside its brackets and turns it into text when a bracket is touched", () => {
    const shown = shownEditText(lines, DEFAULT_SPLIT_CHARACTER);
    const typedInside = shown.text.replace("(go)", "(go go)");
    const inside = remapBackgroundRanges(shown.text, typedInside, shown.ranges, typedInside.indexOf(" go)") + 3);
    expect(editRows(typedInside, inside)[0]).toEqual({ text: "Run to the sea", background: "go go" });

    const bracketGone = shown.text.replace("(go)", "(go");
    const touched = remapBackgroundRanges(shown.text, bracketGone, shown.ranges, bracketGone.indexOf("(go") + 3);
    expect(editRows(bracketGone, touched)[0]).toEqual({ text: "Run (go to the sea", background: null });
    expect(editRows(bracketGone, touched)[1]).toEqual({ text: "Say (it) again", background: "(again)" });
  });

  it("regression: moves each token by the runs before it when one input changes several runs", () => {
    const tokens = [
      { start: 2, end: 6, bracketed: false },
      { start: 9, end: 13, bracketed: false },
    ];
    const typed = "AA (go) BB (ah)";
    const ranges = remapBackgroundRanges("A (go) B (ah)", typed, tokens, typed.length);
    expect(editRows(typed, ranges)).toEqual([{ text: "AA BB", background: "go ah" }]);
  });

  it("reads a row that is only a token as main text, for extraction to decide", () => {
    expect(editRows("(ooh)", [{ start: 0, end: 5, bracketed: false }])).toEqual([{ text: "(ooh)", background: null }]);
  });

  it("keeps a token one input left alone while it edits text far apart on both sides", () => {
    const shown = shownEditText(lines, DEFAULT_SPLIT_CHARACTER);
    const corrected = shown.text.replace("Run", "Ran").replace("Quiet", "Quite");
    const ranges = remapBackgroundRanges(shown.text, corrected, shown.ranges, corrected.indexOf("Quite") + 5);
    expect(editRows(corrected, ranges)).toEqual([
      { text: "Ran to the sea", background: "go" },
      { text: "Say (it) again", background: "(again)" },
      { text: "Quite now", background: null },
    ]);
  });

  it("regression: text typed between two bracket groups of one background is main text", () => {
    const twoGroups = [
      createLine({
        id: "two",
        text: "Meadow cinder",
        backgroundText: "(echo back) (low tide)",
        backgroundTextSource: "extraction",
      }),
    ];
    const shown = shownEditText(twoGroups, DEFAULT_SPLIT_CHARACTER);
    const typed = shown.text.replace(") (", ") drift (");
    const ranges = remapBackgroundRanges(shown.text, typed, shown.ranges, typed.indexOf("drift") + 6);
    expect(editRows(typed, ranges)).toEqual([{ text: "Meadow cinder drift", background: "(echo back) (low tide)" }]);
  });

  it("regression: a bracket typed inside a token turns the token into text, never an unbalanced background", () => {
    const shown = shownEditText(lines, DEFAULT_SPLIT_CHARACTER);
    const typed = shown.text.replace("(go)", "(g(o)");
    const ranges = remapBackgroundRanges(shown.text, typed, shown.ranges, typed.indexOf("(o)") + 1);
    expect(editRows(typed, ranges)[0]).toEqual({ text: "Run (g(o) to the sea", background: null });
  });
});
