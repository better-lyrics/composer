/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import type { TimeRange } from "@/domain/group/shared-timing";
import { lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { backgroundTrack, mainTrack, roleWords, timedSyllables } from "@/domain/line/track";
import { stretchSelections } from "@/domain/selection/stretch";
import { newWordId } from "@/domain/word/id";
import { spacedText } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";
import { patchOf, updatedLine } from "@/test/field-updates";
import { planStretchDrag } from "./stretch-drag";

// -- Helpers --------------------------------------------------------------------

function makeLine(id: string, words: WordTiming[]): LyricLine {
  return lineFromFields({ id, text: spacedText(words), agentId: "v1", words });
}

const wholeSong = (duration: number) => (): TimeRange => ({ min: 0, max: duration });

const OPTS = { rangeOf: wholeSong(60), minWordDuration: 0.1 };

const word = (lineId: string, wordIndex: number) => ({ lineId, type: "word" as const, wordIndex });

// -- planStretchDrag ------------------------------------------------------------

describe("planStretchDrag", () => {
  const lines = [
    makeLine("L", [
      { id: "w1", text: "a", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w2", text: "b", sep: " ", begin: 1, end: 2, joinsNext: false },
      { id: "w3", text: "c", sep: "", begin: 2, end: 3, joinsNext: false },
    ]),
  ];

  it("plans a left-anchored stretch when dragging the right edge of the last selected word", () => {
    const plan = planStretchDrag(
      lines,
      [word("L", 1), word("L", 2)],
      { lineId: "L", type: "word", wordIndex: 2, edge: "right" },
      OPTS,
    );
    expect(plan?.anchor).toBe("start");
    expect(plan?.anchorTime).toBeCloseTo(1);
    expect(plan?.edgeTime).toBeCloseTo(3);
    expect(plan!.minFactor).toBeLessThanOrEqual(1);
    expect(plan!.maxFactor).toBeGreaterThanOrEqual(1);
  });

  it("plans a right-anchored stretch when dragging the left edge of the first selected word", () => {
    const plan = planStretchDrag(
      lines,
      [word("L", 1), word("L", 2)],
      { lineId: "L", type: "word", wordIndex: 1, edge: "left" },
      OPTS,
    );
    expect(plan?.anchor).toBe("end");
    expect(plan?.anchorTime).toBeCloseTo(3);
    expect(plan?.edgeTime).toBeCloseTo(1);
  });

  it("rejects single-word selections so plain resize keeps working (CJK fix)", () => {
    const plan = planStretchDrag(
      lines,
      [word("L", 0)],
      { lineId: "L", type: "word", wordIndex: 0, edge: "right" },
      OPTS,
    );
    expect(plan).toBeNull();
  });

  it("rejects internal edges — the grip must sit on the selection's own extreme", () => {
    const drag = (wordIndex: number, edge: "left" | "right") => ({
      lineId: "L",
      type: "word" as const,
      wordIndex,
      edge,
    });
    // Right edge of the first selected word: max end belongs to word 2.
    expect(planStretchDrag(lines, [word("L", 1), word("L", 2)], drag(1, "right"), OPTS)).toBeNull();
    // Left edge of the last selected word: min begin belongs to word 1.
    expect(planStretchDrag(lines, [word("L", 1), word("L", 2)], drag(2, "left"), OPTS)).toBeNull();
  });

  it("rejects a word that is not selected", () => {
    const plan = planStretchDrag(
      lines,
      [word("L", 1), word("L", 2)],
      { lineId: "L", type: "word", wordIndex: 0, edge: "right" },
      OPTS,
    );
    expect(plan).toBeNull();
  });

  it("counts word blocks only — line-synced rows never add a grip", () => {
    const mixed: LyricLine[] = [
      makeLine("A", [{ id: "w4", text: "a", sep: "", begin: 1, end: 2, joinsNext: false }]),
      lineFromFields({ id: "B", text: "y", agentId: "v1", begin: 2, end: 6 }),
    ];
    const plan = planStretchDrag(
      mixed,
      [word("A", 0), word("B", 0)],
      { lineId: "A", type: "word", wordIndex: 0, edge: "right" },
      OPTS,
    );
    expect(plan).toBeNull();
  });

  it("supports bg grips and mixed main+bg selections across extremes", () => {
    const mixed: LyricLine[] = [
      lineFromFields({
        id: "A",
        text: "main",
        agentId: "v1",
        words: [{ id: "w5", text: "main", sep: "", begin: 2, end: 4, joinsNext: false }],
        backgroundWords: [{ id: "w6", text: "ooh", sep: "", begin: 0, end: 1, joinsNext: false }],
      }),
    ];
    const plan = planStretchDrag(
      mixed,
      [word("A", 0), { lineId: "A", type: "bg", wordIndex: 0 }],
      { lineId: "A", type: "word", wordIndex: 0, edge: "right" },
      OPTS,
    );
    expect(plan?.anchor).toBe("start");
    // Word extremes cover both tracks: min begin 0 (bg), max end 4 (main).
    expect(plan?.anchorTime).toBeCloseTo(0);
    expect(plan?.edgeTime).toBeCloseTo(4);
  });

  it("caps maxFactor at the right neighbour", () => {
    const neighbour = [
      makeLine("L", [
        { id: "w7", text: "a", sep: " ", begin: 1, end: 2, joinsNext: false },
        { id: "w8", text: "b", sep: "", begin: 2, end: 3, joinsNext: true },
        { id: "w9", text: "c", sep: "", begin: 5, end: 6, joinsNext: false },
      ]),
    ];
    const plan = planStretchDrag(
      neighbour,
      [word("L", 0), word("L", 1)],
      { lineId: "L", type: "word", wordIndex: 1, edge: "right" },
      OPTS,
    );
    // kHi = (5 - 1) / (3 - 1) = 2.
    expect(plan?.maxFactor).toBeCloseTo(2);
  });

  it("raises minFactor when a word is shorter than minWordDuration", () => {
    const short = [
      makeLine("L", [
        { id: "w10", text: "tiny", sep: " ", begin: 0, end: 0.05, joinsNext: false },
        { id: "w11", text: "b", sep: "", begin: 0.05, end: 2, joinsNext: false },
      ]),
    ];
    const plan = planStretchDrag(
      short,
      [word("L", 0), word("L", 1)],
      { lineId: "L", type: "word", wordIndex: 1, edge: "right" },
      OPTS,
    );
    // Word 0 (dur 0.05) must reach 0.1 → kLo = 2.
    expect(plan?.minFactor).toBeCloseTo(2);
  });

  it("returns null for empty selection, ghost lineIds, zero-span and non-finite input", () => {
    expect(planStretchDrag(lines, [], { lineId: "L", type: "word", wordIndex: 2, edge: "right" }, OPTS)).toBeNull();
    expect(
      planStretchDrag(lines, [word("ghost", 0)], { lineId: "ghost", type: "word", wordIndex: 0, edge: "right" }, OPTS),
    ).toBeNull();
    // Zero span: two stacked words at the same instant.
    const stacked = [
      makeLine("L", [
        { id: "w12", text: "a", sep: "", begin: 1, end: 1, joinsNext: true },
        { id: "w13", text: "b", sep: "", begin: 1, end: 1, joinsNext: false },
      ]),
    ];
    expect(
      planStretchDrag(
        stacked,
        [word("L", 0), word("L", 1)],
        { lineId: "L", type: "word", wordIndex: 1, edge: "right" },
        OPTS,
      ),
    ).toBeNull();
    expect(
      planStretchDrag(
        lines,
        [word("L", 1), word("L", 2)],
        { lineId: "L", type: "word", wordIndex: 2, edge: "right" },
        { rangeOf: wholeSong(Number.NaN), minWordDuration: 0.1 },
      ),
    ).toBeNull();
  });

  it("returns null when the feasible interval is empty", () => {
    // tiny (0.05s < minWordDuration) sits flush against a right neighbour:
    // growing to the minimum would overlap it.
    const tight = [
      makeLine("L", [
        { id: "w14", text: "tiny", sep: " ", begin: 1, end: 1.05, joinsNext: false },
        { id: "w15", text: "mid", sep: "", begin: 1.05, end: 1.2, joinsNext: true },
        { id: "w16", text: "next", sep: "", begin: 1.2, end: 4, joinsNext: false },
      ]),
    ];
    const plan = planStretchDrag(
      tight,
      [word("L", 0), word("L", 1)],
      { lineId: "L", type: "word", wordIndex: 1, edge: "right" },
      OPTS,
    );
    expect(plan).toBeNull();
  });
});

// -- stretchSelections · normal scaling (anchor: start) --------------------------

describe("stretchSelections · normal scaling", () => {
  it("scales a word run 2x around the anchor, preserving order, text and untouched words", () => {
    const lines = [
      makeLine("L", [
        { id: "w17", text: "keep", sep: " ", begin: 0, end: 0.5, joinsNext: false },
        { id: "w18", text: "a", sep: " ", begin: 1, end: 2, joinsNext: false },
        { id: "w19", text: "b", sep: "", begin: 3, end: 4, joinsNext: false },
      ]),
    ];
    const result = stretchSelections(lines, [word("L", 1), word("L", 2)], 2, OPTS);
    expect(result.appliedFactor).toBeCloseTo(2);
    expect(result.updates).toHaveLength(1);
    const words = roleWords(updatedLine(result.updates[0].updates), "main")!;
    // Anchor = 1 (min begin of selection) stays fixed.
    expect(words[1].begin).toBeCloseTo(1);
    expect(words[1].end).toBeCloseTo(3);
    expect(words[2].begin).toBeCloseTo(5);
    expect(words[2].end).toBeCloseTo(7);
    expect(words[1]).toMatchObject({ text: "a", sep: " " });
    expect(words[2].text).toBe("b");
    // Unselected word untouched by reference.
    expect(words[0]).toBe(timedSyllables(mainTrack(lines[0]))[0]);
  });

  it("shrinks toward the anchor with k < 1", () => {
    const lines = [
      makeLine("L", [
        { id: "w20", text: "a", sep: " ", begin: 2, end: 4, joinsNext: false },
        { id: "w21", text: "b", sep: "", begin: 4, end: 6, joinsNext: false },
      ]),
    ];
    const result = stretchSelections(lines, [word("L", 0), word("L", 1)], 0.5, OPTS);
    const words = roleWords(updatedLine(result.updates[0].updates), "main")!;
    expect(words[0].begin).toBeCloseTo(2);
    expect(words[0].end).toBeCloseTo(3);
    expect(words[1].begin).toBeCloseTo(3);
    expect(words[1].end).toBeCloseTo(4);
  });

  it("scales a cross-line selection around the global anchor", () => {
    const lines: LyricLine[] = [
      makeLine("A", [{ id: "w22", text: "a", sep: "", begin: 1, end: 2, joinsNext: false }]),
      makeLine("B", [{ id: "w23", text: "b", sep: "", begin: 3, end: 5, joinsNext: false }]),
    ];
    const result = stretchSelections(lines, [word("A", 0), word("B", 0)], 2, OPTS);
    expect(result.updates).toHaveLength(2);
    const lineA = roleWords(updatedLine(result.updates.find((u) => u.id === "A")!.updates), "main")!;
    const lineB = roleWords(updatedLine(result.updates.find((u) => u.id === "B")!.updates), "main")!;
    expect(lineA[0].begin).toBeCloseTo(1);
    expect(lineA[0].end).toBeCloseTo(3);
    expect(lineB[0].begin).toBeCloseTo(5);
    expect(lineB[0].end).toBeCloseTo(9);
  });

  it("does NOT expand syllable groups — exactly the selected words stretch", () => {
    // "hel" + "lo " form a trailing-space syllable group. Only "hel" and "lo"
    // are explicitly selected (with "world" beyond them), so a 2x stretch maps
    // the pair flush onto "world" without touching anything else.
    const lines = [
      makeLine("L", [
        { id: "w24", text: "hel", sep: "", begin: 1, end: 2, joinsNext: true },
        { id: "w25", text: "lo", sep: " ", begin: 2, end: 3, joinsNext: false },
        { id: "w26", text: "world", sep: "", begin: 5, end: 7, joinsNext: false },
      ]),
    ];
    const result = stretchSelections(lines, [word("L", 0), word("L", 1)], 2, OPTS);
    const words = roleWords(updatedLine(result.updates[0].updates), "main")!;
    expect(result.appliedFactor).toBeCloseTo(2);
    expect(words[0].begin).toBeCloseTo(1);
    expect(words[0].end).toBeCloseTo(3);
    expect(words[1].begin).toBeCloseTo(3);
    expect(words[1].end).toBeCloseTo(5);
    expect(words[2].begin).toBeCloseTo(5);
    expect(words[2].end).toBeCloseTo(7);
  });

  it("clamps a partial-group grow at its groupmate instead of crossing it", () => {
    // Only "hel" selected: its right neighbour is groupmate "lo " at 2, so a
    // 2x request is clamped back to 1 (no-op).
    const lines = [
      makeLine("L", [
        { id: "w27", text: "hel", sep: "", begin: 1, end: 2, joinsNext: true },
        { id: "w28", text: "lo", sep: " ", begin: 2, end: 3, joinsNext: false },
      ]),
    ];
    const result = stretchSelections(lines, [word("L", 0)], 2, OPTS);
    expect(result.appliedFactor).toBe(1);
    expect(result.updates).toHaveLength(0);
  });
});

// -- stretchSelections · anchor: end ---------------------------------------------

describe("stretchSelections · anchor end", () => {
  // Words at 6..10 with a 1s gap to a left neighbour at 0..1: growing leftward
  // with anchor 10 has room up to kHi = (10 - 1) / (10 - 6) = 2.25.
  const lines = [
    makeLine("L", [
      { id: "w29", text: "block", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w30", text: "a", sep: " ", begin: 6, end: 8, joinsNext: false },
      { id: "w31", text: "b", sep: "", begin: 8, end: 10, joinsNext: false },
    ]),
  ];
  const sel = [word("L", 1), word("L", 2)];

  it("grows leftward 2x with the right edge pinned", () => {
    const result = stretchSelections(lines, sel, 2, { ...OPTS, anchor: "end" });
    expect(result.appliedFactor).toBeCloseTo(2);
    const words = roleWords(updatedLine(result.updates[0].updates), "main")!;
    // Anchor t1 = 10 stays fixed; distances from it double.
    expect(words[1].begin).toBeCloseTo(2);
    expect(words[1].end).toBeCloseTo(6);
    expect(words[2].begin).toBeCloseTo(6);
    expect(words[2].end).toBeCloseTo(10);
    expect(words[0]).toBe(timedSyllables(mainTrack(lines[0]))[0]);
  });

  it("shrinks toward the right anchor with k < 1", () => {
    const result = stretchSelections(lines, sel, 0.5, { ...OPTS, anchor: "end" });
    const words = roleWords(updatedLine(result.updates[0].updates), "main")!;
    expect(words[1].begin).toBeCloseTo(8);
    expect(words[1].end).toBeCloseTo(9);
    expect(words[2].begin).toBeCloseTo(9);
    expect(words[2].end).toBeCloseTo(10);
  });

  it("clamps leftward growth flush at the left neighbour", () => {
    const tight = [
      makeLine("L", [
        { id: "w32", text: "block", sep: " ", begin: 0, end: 4, joinsNext: false },
        { id: "w33", text: "a", sep: " ", begin: 6, end: 8, joinsNext: false },
        { id: "w34", text: "b", sep: "", begin: 8, end: 10, joinsNext: false },
      ]),
    ];
    // kHi = (10 - 4) / (10 - 6) = 1.5.
    const result = stretchSelections(tight, sel, 3, { ...OPTS, anchor: "end" });
    expect(result.appliedFactor).toBeCloseTo(1.5);
    const words = roleWords(updatedLine(result.updates[0].updates), "main")!;
    expect(words[1].begin).toBeCloseTo(4);
    expect(words[1].end).toBeCloseTo(7);
    expect(words[2].end).toBeCloseTo(10);
  });

  it("clamps leftward growth at time 0 when there is no left neighbour", () => {
    const open = [
      makeLine("L", [
        { id: "w35", text: "a", sep: " ", begin: 4, end: 6, joinsNext: false },
        { id: "w36", text: "b", sep: "", begin: 6, end: 10, joinsNext: false },
      ]),
    ];
    // kHi = 10 / (10 - 4) = 5/3.
    const result = stretchSelections(open, [word("L", 0), word("L", 1)], 10, { ...OPTS, anchor: "end" });
    expect(result.appliedFactor).toBeCloseTo(5 / 3);
    const words = roleWords(updatedLine(result.updates[0].updates), "main")!;
    expect(words[0].begin).toBeCloseTo(0);
    expect(words[0].end).toBeCloseTo(10 / 3);
    expect(words[1].end).toBeCloseTo(10);
  });

  it("clamps shrink at minWordDuration measured on the shortest word", () => {
    const result = stretchSelections(lines, sel, 0.01, { ...OPTS, anchor: "end" });
    expect(result.appliedFactor).toBeCloseTo(0.05);
    const words = roleWords(updatedLine(result.updates[0].updates), "main")!;
    expect(words[1].end - words[1].begin).toBeCloseTo(0.1);
  });

  it("maps a mixed line-synced row around the right anchor", () => {
    const mixed: LyricLine[] = [
      makeLine("A", [{ id: "w37", text: "a", sep: "", begin: 2, end: 4, joinsNext: false }]),
      lineFromFields({ id: "B", text: "y", agentId: "v1", begin: 0, end: 1 }),
    ];
    const result = stretchSelections(mixed, [word("A", 0), word("B", 0)], 0.5, { ...OPTS, anchor: "end" });
    // Word anchor t1 = 4 (line A); line B maps around it.
    const lineA = roleWords(updatedLine(result.updates.find((u) => u.id === "A")!.updates), "main")!;
    const lineB = result.updates.find((u) => u.id === "B")!.updates;
    expect(lineA[0].begin).toBeCloseTo(3);
    expect(lineA[0].end).toBeCloseTo(4);
    expect(updatedLine(lineB) && mainTrack(updatedLine(lineB)!).begin).toBeCloseTo(2);
    expect(updatedLine(lineB) && mainTrack(updatedLine(lineB)!).end).toBeCloseTo(2.5);
  });
});

// -- stretchSelections · clamping ------------------------------------------------

describe("stretchSelections · clamping", () => {
  it("clamps growth at a right-side unselected neighbour and lands flush", () => {
    const lines = [
      makeLine("L", [
        { id: "w38", text: "a", sep: " ", begin: 1, end: 2, joinsNext: false },
        { id: "w39", text: "block", sep: "", begin: 3, end: 4, joinsNext: false },
      ]),
    ];
    // Selection = word 0 only; grow beyond the neighbour start is impossible.
    // Right bound: k <= (3 - 1) / (2 - 1) = 2.
    const result = stretchSelections(lines, [word("L", 0)], 5, OPTS);
    expect(result.appliedFactor).toBeCloseTo(2);
    const words = roleWords(updatedLine(result.updates[0].updates), "main")!;
    expect(words[0].end).toBeCloseTo(3);
    expect(words[1].begin).toBeCloseTo(3);
  });

  it("clamps shrink at a left-side unselected neighbour on another row", () => {
    // Row A anchors T0 at 0; row B's selected word has a non-selected left
    // neighbour ending at 4.8 → shrink pulls its begin toward 4.8: k >= 4.8/5.
    const lines: LyricLine[] = [
      makeLine("A", [{ id: "w40", text: "anchor", sep: "", begin: 0, end: 1, joinsNext: false }]),
      makeLine("B", [
        { id: "w41", text: "block", sep: " ", begin: 4.2, end: 4.8, joinsNext: false },
        { id: "w42", text: "far", sep: "", begin: 5, end: 6, joinsNext: false },
      ]),
    ];
    const result = stretchSelections(lines, [word("A", 0), word("B", 1)], 0.5, OPTS);
    expect(result.appliedFactor).toBeCloseTo(0.96);
    const lineB = roleWords(updatedLine(result.updates.find((u) => u.id === "B")!.updates), "main")!;
    expect(lineB[1].begin).toBeCloseTo(4.8);
    expect(lineB[1].end).toBeCloseTo(5.76);
    expect(lineB[0]).toBe(roleWords(lines[1], "main")![0]);
  });

  it("clamps shrink at minWordDuration so the shortest word lands exactly on the minimum", () => {
    const lines = [
      makeLine("L", [
        { id: "w43", text: "short", sep: " ", begin: 1, end: 1.5, joinsNext: false },
        { id: "w44", text: "long", sep: "", begin: 1.5, end: 3.5, joinsNext: false },
      ]),
    ];
    // minFactor = 0.1 / 0.5 = 0.2.
    const result = stretchSelections(lines, [word("L", 0), word("L", 1)], 0.1, OPTS);
    expect(result.appliedFactor).toBeCloseTo(0.2);
    const words = roleWords(updatedLine(result.updates[0].updates), "main")!;
    expect(words[0].end - words[0].begin).toBeCloseTo(0.1);
    expect(words[1].end - words[1].begin).toBeCloseTo(0.4);
  });

  it("clamps growth at audio duration", () => {
    const lines = [makeLine("L", [{ id: "w45", text: "a", sep: "", begin: 50, end: 55, joinsNext: false }])];
    // Right bound from duration: k <= (60 - 50) / 5 = 2.
    const result = stretchSelections(lines, [word("L", 0)], 10, { rangeOf: wholeSong(60), minWordDuration: 0.1 });
    expect(result.appliedFactor).toBeCloseTo(2);
    expect(roleWords(updatedLine(result.updates[0].updates), "main")![0].end).toBeCloseTo(60);
  });

  it("grows to the minimum when a word already violates minWordDuration", () => {
    const lines = [
      makeLine("L", [
        { id: "w46", text: "tiny", sep: " ", begin: 1, end: 1.05, joinsNext: false },
        { id: "w47", text: "b", sep: "", begin: 1.05, end: 3, joinsNext: false },
      ]),
    ];
    // minFactor = 0.1 / 0.05 = 2 → even a shrink request grows to exactly 2.
    const result = stretchSelections(lines, [word("L", 0), word("L", 1)], 0.5, OPTS);
    expect(result.appliedFactor).toBeCloseTo(2);
    const words = roleWords(updatedLine(result.updates[0].updates), "main")!;
    expect(words[0].end - words[0].begin).toBeCloseTo(0.1);
  });
});

// -- stretchSelections · tracks and line types -----------------------------------

describe("stretchSelections · tracks and line types", () => {
  it("scales background selections and stamps manual provenance", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "A",
        text: "main",
        agentId: "v1",
        words: [{ id: "w48", text: "main", sep: "", begin: 0, end: 1, joinsNext: false }],
        backgroundText: "ooh ahh",
        backgroundWords: [
          { id: "w49", text: "ooh", sep: " ", begin: 2, end: 3, joinsNext: false },
          { id: "w50", text: "ahh", sep: "", begin: 3, end: 5, joinsNext: false },
        ],
        backgroundTextSource: "extraction",
      }),
    ];
    const result = stretchSelections(
      lines,
      [
        { lineId: "A", type: "bg", wordIndex: 0 },
        { lineId: "A", type: "bg", wordIndex: 1 },
      ],
      2,
      OPTS,
    );
    expect(result.updates).toHaveLength(1);
    const update = result.updates[0].updates;
    const bg = roleWords(updatedLine(update), "bg")!;
    expect(bg[0].begin).toBeCloseTo(2);
    expect(bg[0].end).toBeCloseTo(4);
    expect(bg[1].begin).toBeCloseTo(4);
    expect(bg[1].end).toBeCloseTo(8);
    expect(updatedLine(update) && backgroundTrack(updatedLine(update)!)?.source).toBe("manual");
    expect("words" in patchOf(update, lines[0])).toBe(false);
  });

  it("merges main and background selections into a single update entry per line", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "A",
        text: "main",
        agentId: "v1",
        words: [
          { id: "w51", text: "main", sep: " ", begin: 1, end: 2, joinsNext: false },
          { id: "w52", text: "x", sep: "", begin: 2, end: 4, joinsNext: false },
        ],
        backgroundWords: [{ id: "w53", text: "ooh", sep: "", begin: 1, end: 4, joinsNext: false }],
      }),
    ];
    const result = stretchSelections(lines, [word("A", 1), { lineId: "A", type: "bg", wordIndex: 0 }], 2, OPTS);
    expect(result.updates).toHaveLength(1);
    const update = result.updates[0].updates;
    expect(roleWords(updatedLine(update), "main")!.length).toBe(2);
    expect(roleWords(updatedLine(update), "bg")).toBeDefined();
  });

  it("scales line-synced begin/end with the same factor as word-synced rows", () => {
    const lines: LyricLine[] = [
      makeLine("A", [{ id: "w54", text: "a", sep: "", begin: 1, end: 2, joinsNext: false }]),
      lineFromFields({ id: "B", text: "y", agentId: "v1", begin: 2, end: 6 }),
    ];
    const result = stretchSelections(lines, [word("A", 0), word("B", 0)], 2, OPTS);
    expect(result.updates).toHaveLength(2);
    const lineB = result.updates.find((u) => u.id === "B")!.updates;
    // Global anchor t0 = 1 (from line A); line B maps around it.
    expect(updatedLine(lineB) && mainTrack(updatedLine(lineB)!).begin).toBeCloseTo(3);
    expect(updatedLine(lineB) && mainTrack(updatedLine(lineB)!).end).toBeCloseTo(11);
    const lineA = roleWords(updatedLine(result.updates.find((u) => u.id === "A")!.updates), "main")!;
    expect(lineA[0].end).toBeCloseTo(3);
  });

  it("clamps a line-synced-only selection at duration", () => {
    const lines: LyricLine[] = [lineFromFields({ id: "B", text: "y", agentId: "v1", begin: 50, end: 55 })];
    const result = stretchSelections(lines, [word("B", 0)], 10, { rangeOf: wholeSong(60), minWordDuration: 0.1 });
    // duration bound: k <= (60 - 50) / 5 = 2.
    expect(result.appliedFactor).toBeCloseTo(2);
    expect(
      updatedLine(result.updates[0].updates) && mainTrack(updatedLine(result.updates[0].updates)!).end,
    ).toBeCloseTo(60);
  });
});

// -- stretchSelections · degenerate cases ----------------------------------------

describe("stretchSelections · degenerate cases", () => {
  const lines = [
    makeLine("L", [
      { id: "w55", text: "a", sep: " ", begin: 1, end: 2, joinsNext: false },
      { id: "w56", text: "b", sep: "", begin: 2, end: 4, joinsNext: false },
    ]),
  ];
  const selections = [word("L", 0), word("L", 1)];

  it("is a no-op for factor 1", () => {
    const result = stretchSelections(lines, selections, 1, OPTS);
    expect(result.appliedFactor).toBe(1);
    expect(result.updates).toHaveLength(0);
  });

  it("is a no-op for empty selections and ghost lineIds", () => {
    expect(stretchSelections(lines, [], 2, OPTS).updates).toHaveLength(0);
    expect(stretchSelections(lines, [word("ghost", 0)], 2, OPTS).updates).toHaveLength(0);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("is a no-op for invalid factor %s", (factor) => {
    const result = stretchSelections(lines, selections, factor, OPTS);
    expect(result.appliedFactor).toBe(1);
    expect(result.updates).toHaveLength(0);
  });

  it("is a no-op when duration or word timings are non-finite (no NaN writes)", () => {
    const nanDuration = stretchSelections(lines, selections, 2, {
      rangeOf: wholeSong(Number.NaN),
      minWordDuration: 0.1,
    });
    expect(nanDuration.updates).toHaveLength(0);

    const nanWords: LyricLine[] = [
      lineFromFields({
        id: "L",
        text: "a b",
        agentId: "v1",
        words: [{ id: newWordId(), text: "a", sep: "", begin: Number.NaN, end: 2, joinsNext: false }],
      }),
    ];
    const nanTiming = stretchSelections(nanWords, [word("L", 0)], 2, OPTS);
    expect(nanTiming.updates).toHaveLength(0);
  });

  it("returns empty updates when the feasible interval is empty", () => {
    // A word shorter than minWordDuration sitting flush against a right
    // neighbour: growing to the minimum would overlap it.
    const tight = [
      makeLine("L", [
        { id: "w57", text: "tiny", sep: " ", begin: 1, end: 1.05, joinsNext: false },
        { id: "w58", text: "next", sep: "", begin: 1.05, end: 4, joinsNext: false },
      ]),
    ];
    const result = stretchSelections(tight, [word("L", 0)], 1.5, OPTS);
    expect(result.updates).toHaveLength(0);
    expect(result.appliedFactor).toBe(1);
  });
});
