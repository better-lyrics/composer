import { revisionChangeCounts, revisionDiffLines } from "@/domain/unison/revision-changes";
import type { RevisionDiffRow } from "@/lib/unison/revision-types";
import { describe, expect, it } from "vitest";

// -- Fixtures ------------------------------------------------------------------

const UPDATE_ROWS: RevisionDiffRow[] = [
  { kind: "same", lineNo: 1, startMs: 1200, text: "Paper lanterns over the bay" },
  {
    kind: "timing",
    lineNo: 2,
    startMs: 4100,
    deltaMs: 210,
    text: "Counting boats until the tide turns",
    syllables: { before: null, after: null, moved: 4 },
  },
  {
    kind: "word",
    lineNo: 3,
    startMs: 7800,
    parts: [
      ["=", "Ferry bells at "],
      ["-", "noon"],
      ["+", "night"],
    ],
  },
  { kind: "gap", count: 12 },
  { kind: "add", lineNo: 16, startMs: 52000, text: "Salt on the window, sand on the stair" },
  { kind: "del", lineNo: 17, startMs: null, text: "Gulls on the wire" },
  {
    kind: "syllable",
    lineNo: 18,
    startMs: 60000,
    text: "Hold the light till morning",
    before: null,
    after: null,
    moved: 2,
  },
  { kind: "field", field: "isrc", before: null, after: "GBUM71029604" },
];

// -- Tests ---------------------------------------------------------------------

describe("revisionChangeCounts", () => {
  it("counts changed lines, retimed words and song details", () => {
    expect(revisionChangeCounts(UPDATE_ROWS)).toEqual({ lines: 5, wordsRetimed: 6, details: 1 });
  });

  it("counts a line shift without moved words as a changed line only", () => {
    const rows: RevisionDiffRow[] = [{ kind: "timing", lineNo: 1, startMs: 0, deltaMs: -120, text: "Tide" }];
    expect(revisionChangeCounts(rows)).toEqual({ lines: 1, wordsRetimed: 0, details: 0 });
  });

  it("counts nothing for unchanged rows and gaps", () => {
    const rows: RevisionDiffRow[] = [
      { kind: "same", lineNo: 1, startMs: 0, text: "Tide" },
      { kind: "gap", count: 40 },
    ];
    expect(revisionChangeCounts(rows)).toEqual({ lines: 0, wordsRetimed: 0, details: 0 });
  });
});

describe("revisionDiffLines", () => {
  it("turns each diff row into the lines a reader sees", () => {
    expect(revisionDiffLines(UPDATE_ROWS)).toEqual([
      { kind: "same", text: "Paper lanterns over the bay" },
      { kind: "retimed", text: "Counting boats until the tide turns", detail: "0.21 s later, 4 words moved" },
      { kind: "removed", text: "Ferry bells at noon" },
      { kind: "added", text: "Ferry bells at night" },
      { kind: "gap", text: "12 lines unchanged" },
      { kind: "added", text: "Salt on the window, sand on the stair" },
      { kind: "removed", text: "Gulls on the wire" },
      { kind: "retimed", text: "Hold the light till morning", detail: "2 words moved" },
      { kind: "added", text: "ISRC: GBUM71029604" },
    ]);
  });

  it("names an earlier shift and a resplit with no moved words", () => {
    const rows: RevisionDiffRow[] = [
      { kind: "timing", lineNo: 1, startMs: 0, deltaMs: -50, text: "Tide" },
      { kind: "syllable", lineNo: 2, startMs: 900, text: "Rope and harbour", before: "Rope", after: "Ro|pe", moved: 0 },
    ];
    expect(revisionDiffLines(rows)).toEqual([
      { kind: "retimed", text: "Tide", detail: "0.05 s earlier" },
      { kind: "retimed", text: "Rope and harbour", detail: "Syllables split differently" },
    ]);
  });

  it("shows a changed song detail as removed then added", () => {
    const rows: RevisionDiffRow[] = [{ kind: "field", field: "language", before: "en", after: "en-GB" }];
    expect(revisionDiffLines(rows)).toEqual([
      { kind: "removed", text: "Language: en" },
      { kind: "added", text: "Language: en-GB" },
    ]);
  });

  it("returns no lines for an empty diff", () => {
    expect(revisionDiffLines([])).toEqual([]);
  });
});
