import { type LineFields, lineFromFields } from "@/domain/line/line-from-fields";
import { instanceBounds } from "@/domain/instance/bounds";
import type { LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function line(extras: Partial<LineFields> = {}): LyricLine {
  return lineFromFields({ id: "l1", text: "Hello", agentId: "v1", ...extras });
}

// -- instanceBounds -----------------------------------------------------------

describe("instanceBounds", () => {
  it("returns word-level min and max across word-synced lines", () => {
    const lines: LyricLine[] = [
      line({
        id: "a",
        words: [
          { id: "w1", text: "hi", sep: "", begin: 2, end: 3, joinsNext: true },
          { id: "w2", text: "yo", sep: "", begin: 3, end: 4, joinsNext: false },
        ],
      }),
      line({
        id: "b",
        words: [
          { id: "w3", text: "low", sep: "", begin: 5, end: 6, joinsNext: true },
          { id: "w4", text: "high", sep: "", begin: 6, end: 9, joinsNext: false },
        ],
      }),
    ];
    expect(instanceBounds(lines)).toEqual({ begin: 2, end: 9 });
  });

  it("returns line-synced begin/end for lines with no words", () => {
    const lines: LyricLine[] = [line({ id: "a", begin: 3, end: 7 }), line({ id: "b", begin: 10, end: 15 })];
    expect(instanceBounds(lines)).toEqual({ begin: 3, end: 15 });
  });

  it("combines word-synced + line-synced lines correctly", () => {
    const lines: LyricLine[] = [
      line({ id: "a", begin: 1, end: 2 }),
      line({ id: "b", words: [{ id: "w5", text: "yo", sep: "", begin: 5, end: 8, joinsNext: false }] }),
    ];
    expect(instanceBounds(lines)).toEqual({ begin: 1, end: 8 });
  });

  it("includes background words in the bounds", () => {
    const lines: LyricLine[] = [
      line({
        id: "a",
        words: [{ id: "w6", text: "main", sep: "", begin: 5, end: 6, joinsNext: false }],
        backgroundWords: [{ id: "w7", text: "bg", sep: "", begin: 7, end: 10, joinsNext: false }],
      }),
    ];
    expect(instanceBounds(lines)).toEqual({ begin: 5, end: 10 });
  });

  it("includes lines whose only timed content is background words", () => {
    const lines: LyricLine[] = [
      line({ id: "a", backgroundWords: [{ id: "w8", text: "ah", sep: "", begin: 4, end: 5, joinsNext: false }] }),
      line({ id: "b", words: [{ id: "w9", text: "main", sep: "", begin: 10, end: 11, joinsNext: false }] }),
    ];
    expect(instanceBounds(lines)).toEqual({ begin: 4, end: 11 });
  });

  it("returns null when no line in the slice has timing", () => {
    const lines: LyricLine[] = [line({ id: "a", text: "untimed" }), line({ id: "b", text: "still untimed" })];
    expect(instanceBounds(lines)).toBeNull();
  });

  it("returns null for an empty slice", () => {
    expect(instanceBounds([])).toBeNull();
  });

  it("ignores stale line.begin/end when words present (regression: TTML import populates both)", () => {
    const lines: LyricLine[] = [
      line({
        id: "a",
        begin: 0,
        end: 999,
        words: [
          { id: "w10", text: "a", sep: "", begin: 2, end: 3, joinsNext: true },
          { id: "w11", text: "b", sep: "", begin: 3, end: 5, joinsNext: false },
        ],
      }),
    ];
    expect(instanceBounds(lines)).toEqual({ begin: 2, end: 5 });
  });

  it("ignores stale line.begin/end when bg words present (no main timing)", () => {
    const lines: LyricLine[] = [
      line({
        id: "a",
        begin: 0,
        end: 999,
        backgroundWords: [{ id: "w12", text: "b", sep: "", begin: 4, end: 5, joinsNext: false }],
      }),
    ];
    expect(instanceBounds(lines)).toEqual({ begin: 4, end: 5 });
  });

  it("skips untimed lines when others are timed", () => {
    const lines: LyricLine[] = [
      line({ id: "a", text: "untimed" }),
      line({ id: "b", words: [{ id: "w13", text: "yo", sep: "", begin: 5, end: 8, joinsNext: false }] }),
      line({ id: "c", text: "also untimed" }),
    ];
    expect(instanceBounds(lines)).toEqual({ begin: 5, end: 8 });
  });
});
