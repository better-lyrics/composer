import { draftRoles, draftSegments, isDraftTiming, placeDraftLine, reviewDraft } from "@/domain/alignment/draft-timing";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";

// -- draftSegments ------------------------------------------------------------

describe("draftSegments", () => {
  it("places only the lines between pins, each gap inside the pins either side", () => {
    const lines = [
      { pin: null, phones: 4 },
      { pin: { begin: 10, end: 12 }, phones: 5 },
      { pin: null, phones: 3 },
      { pin: null, phones: 6 },
      { pin: { begin: 30, end: 33 }, phones: 2 },
      { pin: null, phones: 2 },
    ];
    expect(draftSegments(lines, 60)).toEqual([
      { begin: 0, end: 10, lines: [0] },
      { begin: 12, end: 30, lines: [2, 3] },
      { begin: 33, end: 60, lines: [5] },
    ]);
  });

  it("leaves lines without phones, and a gap closed by out-of-order pins, unplaced", () => {
    const lines = [
      { pin: { begin: 20, end: 25 }, phones: 4 },
      { pin: null, phones: 0 },
      { pin: null, phones: 3 },
      { pin: { begin: 18, end: 19 }, phones: 4 },
      { pin: null, phones: 3 },
    ];
    // The second pin starts before the first ends, so nothing fits between them, and the
    // line after it is placed after the later of the two.
    expect(draftSegments(lines, 60)).toEqual([{ begin: 25, end: 60, lines: [4] }]);
  });
});

// -- placeDraftLine / reviewDraft ---------------------------------------------

describe("reviewDraft", () => {
  it("spans a line from its first phone to the end of its last, scored per frame", () => {
    const placed = placeDraftLine(
      [
        { first: 100, last: 100, logProbSum: -1 },
        { first: 150, last: 152, logProbSum: -3 },
      ],
      0.01,
    );
    expect(placed.begin).toBeCloseTo(1);
    expect(placed.end).toBeCloseTo(1.53);
    expect(placed.confidence).toBeCloseTo(-1);
  });

  it("drops lines spanning more than 20 s, flags the least confident and warns on a weak song", () => {
    const review = reviewDraft([
      { begin: 0, end: 25, confidence: -0.5 },
      { begin: 30, end: 33, confidence: -3 },
      { begin: 34, end: 36, confidence: -0.8 },
      null,
    ]);
    expect(review.lines.map((l) => l && { flagged: l.flagged })).toEqual([
      null,
      { flagged: true },
      { flagged: false },
      null,
    ]);
    expect(review.lowConfidence).toBe(false);
    expect(reviewDraft([{ begin: 1, end: 3, confidence: -3.2 }]).lowConfidence).toBe(true);
  });
});

// -- isDraftTiming ------------------------------------------------------------

describe("isDraftTiming", () => {
  const drafted: WordTiming[] = [
    { text: "hold ", begin: 1, end: 1.4 },
    { text: "on", begin: 1.4, end: 2 },
  ];

  it("holds while the line keeps the drafted timing, and ends with any edit to a word", () => {
    expect(
      isDraftTiming(
        drafted.map((w) => ({ ...w })),
        drafted,
      ),
    ).toBe(true);
    expect(isDraftTiming([drafted[0], { ...drafted[1], begin: 1.5 }], drafted)).toBe(false);
    expect(isDraftTiming([drafted[0]], drafted)).toBe(false);
    expect(isDraftTiming(undefined, drafted)).toBe(false);
  });
});

// -- draftRoles ---------------------------------------------------------------

describe("draftRoles", () => {
  it("pins what the user timed or edited and re-places only lines still holding the last draft", () => {
    const drafted: WordTiming[] = [{ text: "again", begin: 20, end: 21 }];
    const edited: WordTiming[] = [{ text: "moved", begin: 30.5, end: 31 }];
    const lines: LyricLine[] = [
      { id: "tapped", text: "tapped", agentId: "v1", begin: 1, end: 2 },
      { id: "untimed", text: "not yet", agentId: "v1" },
      { id: "drafted", text: "again", agentId: "v1", words: drafted.map((w) => ({ ...w })) },
      { id: "edited", text: "moved", agentId: "v1", words: edited },
      { id: "empty", text: "", agentId: "v1" },
    ];
    const marks = {
      drafted: { words: drafted, confidence: -1, flagged: false },
      edited: { words: [{ text: "moved", begin: 30, end: 31 }], confidence: -1, flagged: true },
    };
    expect(draftRoles(lines, marks)).toEqual([
      { kind: "pin", bounds: { begin: 1, end: 2 } },
      { kind: "place" },
      { kind: "place" },
      { kind: "pin", bounds: { begin: 30.5, end: 31 } },
      { kind: "skip" },
    ]);
  });
});
