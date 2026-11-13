import { bgBounds, effectiveBounds, mainBounds } from "@/domain/line/bounds";
import { type LooseLine, reconcileLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function line(extras: Partial<LooseLine> = {}) {
  return reconcileLine({ id: "l1", text: "Hello", agentId: "v1", ...extras });
}

// -- mainBounds ---------------------------------------------------------------

describe("mainBounds", () => {
  it("returns first.begin and last.end from words", () => {
    expect(
      mainBounds(
        line({
          words: [
            { id: "w1", text: "a", sep: "", begin: 2, end: 5, joinsNext: true },
            { id: "w2", text: "b", sep: "", begin: 5, end: 8, joinsNext: false },
          ],
        }),
      ),
    ).toEqual({ begin: 2, end: 8 });
  });

  it("returns line-synced begin/end when no words", () => {
    expect(mainBounds(line({ begin: 3, end: 7 }))).toEqual({ begin: 3, end: 7 });
  });

  it("returns null when no main timing", () => {
    expect(mainBounds(line())).toBeNull();
  });

  it("returns null for a word-synced line with an empty words array", () => {
    expect(mainBounds(line({ words: [] }))).toBeNull();
  });

  it("ignores stale line.begin/end when words present (regression: TTML import populates both)", () => {
    expect(
      mainBounds(
        line({
          begin: 0,
          end: 999,
          words: [{ id: "w3", text: "a", sep: "", begin: 2, end: 5, joinsNext: false }],
        }),
      ),
    ).toEqual({ begin: 2, end: 5 });
  });

  it("returns null when only begin is set (incomplete)", () => {
    expect(mainBounds(line({ begin: 3 }))).toBeNull();
  });
});

// -- bgBounds -----------------------------------------------------------------

describe("bgBounds", () => {
  it("returns first.begin and last.end from backgroundWords", () => {
    expect(
      bgBounds(
        line({
          backgroundWords: [
            { id: "w4", text: "a", sep: "", begin: 6, end: 9, joinsNext: true },
            { id: "w5", text: "b", sep: "", begin: 9, end: 12, joinsNext: false },
          ],
        }),
      ),
    ).toEqual({ begin: 6, end: 12 });
  });

  it("returns null when backgroundWords is undefined", () => {
    expect(bgBounds(line())).toBeNull();
  });

  it("returns null when backgroundWords is empty array", () => {
    expect(bgBounds(line({ backgroundWords: [] }))).toBeNull();
  });
});

// -- effectiveBounds ----------------------------------------------------------

describe("effectiveBounds", () => {
  it("returns main bounds when only main timing", () => {
    expect(
      effectiveBounds(
        line({
          words: [
            { id: "w6", text: "a", sep: "", begin: 2, end: 5, joinsNext: true },
            { id: "w7", text: "b", sep: "", begin: 5, end: 8, joinsNext: false },
          ],
        }),
      ),
    ).toEqual({ begin: 2, end: 8 });
  });

  it("returns line-synced bounds when no words", () => {
    expect(effectiveBounds(line({ begin: 3, end: 7 }))).toEqual({ begin: 3, end: 7 });
  });

  it("returns null when no timing at all", () => {
    expect(effectiveBounds(line())).toBeNull();
  });

  it("extends end past main words when bg words end later", () => {
    expect(
      effectiveBounds(
        line({
          words: [
            { id: "w8", text: "a", sep: "", begin: 2, end: 5, joinsNext: true },
            { id: "w9", text: "b", sep: "", begin: 5, end: 8, joinsNext: false },
          ],
          backgroundWords: [
            { id: "w10", text: "c", sep: "", begin: 6, end: 9, joinsNext: true },
            { id: "w11", text: "d", sep: "", begin: 9, end: 12, joinsNext: false },
          ],
        }),
      ),
    ).toEqual({ begin: 2, end: 12 });
  });

  it("pulls begin earlier when bg words begin before main words", () => {
    expect(
      effectiveBounds(
        line({
          words: [{ id: "w12", text: "a", sep: "", begin: 5, end: 8, joinsNext: false }],
          backgroundWords: [{ id: "w13", text: "b", sep: "", begin: 3, end: 6, joinsNext: false }],
        }),
      ),
    ).toEqual({ begin: 3, end: 8 });
  });

  it("extends line-synced end when bg words extend past it", () => {
    expect(
      effectiveBounds(
        line({
          begin: 3,
          end: 7,
          backgroundWords: [{ id: "w14", text: "b", sep: "", begin: 6, end: 10, joinsNext: false }],
        }),
      ),
    ).toEqual({ begin: 3, end: 10 });
  });

  it("leaves bounds unchanged when bg sits fully inside main range", () => {
    expect(
      effectiveBounds(
        line({
          words: [{ id: "w15", text: "a", sep: "", begin: 2, end: 10, joinsNext: false }],
          backgroundWords: [{ id: "w16", text: "b", sep: "", begin: 4, end: 7, joinsNext: false }],
        }),
      ),
    ).toEqual({ begin: 2, end: 10 });
  });

  it("ignores empty bg words array", () => {
    expect(
      effectiveBounds(
        line({
          words: [{ id: "w17", text: "a", sep: "", begin: 2, end: 5, joinsNext: false }],
          backgroundWords: [],
        }),
      ),
    ).toEqual({ begin: 2, end: 5 });
  });

  it("returns null when bg exists but no main timing (matches legacy getLineTiming contract)", () => {
    expect(
      effectiveBounds(
        line({
          backgroundWords: [{ id: "w1", text: "b", sep: "", begin: 3, end: 6, joinsNext: false }],
        }),
      ),
    ).toBeNull();
  });

  it("returns null when only empty timing arrays", () => {
    expect(effectiveBounds(line({ words: [], backgroundWords: [] }))).toBeNull();
  });

  it("ignores stale line.begin/end when words present (regression test for incident memory)", () => {
    expect(
      effectiveBounds(
        line({
          begin: 0,
          end: 999,
          words: [{ id: "w18", text: "a", sep: "", begin: 2, end: 5, joinsNext: false }],
        }),
      ),
    ).toEqual({ begin: 2, end: 5 });
  });
});
