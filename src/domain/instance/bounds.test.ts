import { reconcileLine, type LooseLine, type LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";
import { instanceBounds } from "@/domain/instance/bounds";

// -- Helpers ------------------------------------------------------------------

function line(extras: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({ id: "l1", text: "Hello", agentId: "v1", ...extras });
}

// -- instanceBounds -----------------------------------------------------------

describe("instanceBounds", () => {
  it("returns word-level min and max across word-synced lines", () => {
    const lines: LyricLine[] = [
      line({
        id: "a",
        words: [
          { text: "hi", begin: 2, end: 3 },
          { text: "yo", begin: 3, end: 4 },
        ],
      }),
      line({
        id: "b",
        words: [
          { text: "low", begin: 5, end: 6 },
          { text: "high", begin: 6, end: 9 },
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
      line({ id: "b", words: [{ text: "yo", begin: 5, end: 8 }] }),
    ];
    expect(instanceBounds(lines)).toEqual({ begin: 1, end: 8 });
  });

  it("includes background words in the bounds", () => {
    const lines: LyricLine[] = [
      line({
        id: "a",
        words: [{ text: "main", begin: 5, end: 6 }],
        backgroundWords: [{ text: "bg", begin: 7, end: 10 }],
      }),
    ];
    expect(instanceBounds(lines)).toEqual({ begin: 5, end: 10 });
  });

  it("includes lines whose only timed content is background words", () => {
    const lines: LyricLine[] = [
      line({ id: "a", backgroundWords: [{ text: "ah", begin: 4, end: 5 }] }),
      line({ id: "b", words: [{ text: "main", begin: 10, end: 11 }] }),
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
          { text: "a", begin: 2, end: 3 },
          { text: "b", begin: 3, end: 5 },
        ],
      }),
    ];
    expect(instanceBounds(lines)).toEqual({ begin: 2, end: 5 });
  });

  // A line with begin/end and no main words is line-synced main, not stale
  // timing. Under the voice model a line-synced main is first-class, so its
  // bounds count alongside the background, exactly as a word-synced main does
  // (see "includes background words in the bounds" above). Previously the
  // line-synced main was dropped whenever a background was present.
  it("counts line-synced main bounds alongside background words", () => {
    const lines: LyricLine[] = [
      line({
        id: "a",
        begin: 0,
        end: 999,
        backgroundWords: [{ text: "b", begin: 4, end: 5 }],
      }),
    ];
    expect(instanceBounds(lines)).toEqual({ begin: 0, end: 999 });
  });

  it("takes the union of line-synced main and a background that extends past it", () => {
    const lines: LyricLine[] = [
      line({
        id: "a",
        begin: 2,
        end: 5,
        backgroundWords: [{ text: "b", begin: 1, end: 8 }],
      }),
    ];
    expect(instanceBounds(lines)).toEqual({ begin: 1, end: 8 });
  });

  it("skips untimed lines when others are timed", () => {
    const lines: LyricLine[] = [
      line({ id: "a", text: "untimed" }),
      line({ id: "b", words: [{ text: "yo", begin: 5, end: 8 }] }),
      line({ id: "c", text: "also untimed" }),
    ];
    expect(instanceBounds(lines)).toEqual({ begin: 5, end: 8 });
  });
});
