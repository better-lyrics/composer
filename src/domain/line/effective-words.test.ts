import { reconcileLine, type LooseLine, type LyricLine, type RawLine } from "@/domain/line/model";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  effectiveMainWordEdit,
  effectiveTimingWrite,
  effectiveWordTextEdit,
  effectiveWords,
  getEffectiveLines,
} from "@/domain/line/effective-words";
import { createLine } from "@/test/factories";

// -- Helpers ------------------------------------------------------------------

function line(extras: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({ id: "l1", text: "Hello", agentId: "v1", ...extras });
}

// -- effectiveWords -----------------------------------------------------------

describe("effectiveWords", () => {
  it("returns the words array when word-synced", () => {
    const words = [
      { text: "Hello ", begin: 0, end: 1 },
      { text: "world", begin: 1, end: 2 },
    ];
    expect(effectiveWords(line({ words }))).toEqual(words);
  });

  it("returns a single synthetic word covering line-synced begin/end", () => {
    expect(effectiveWords(line({ text: "Hello world", begin: 3, end: 7 }))).toEqual([
      { text: "Hello world", begin: 3, end: 7 },
    ]);
  });

  it("strips split characters from synthetic word text", () => {
    expect(effectiveWords(line({ text: "Hel|lo wo|rld", begin: 3, end: 7 }))).toEqual([
      { text: "Hello world", begin: 3, end: 7 },
    ]);
  });

  it("returns empty array when no timing at all", () => {
    expect(effectiveWords(line())).toEqual([]);
  });

  it("returns empty array for a word-synced line with an empty words array", () => {
    expect(effectiveWords(line({ words: [] }))).toEqual([]);
  });
});

// -- getEffectiveLines --------------------------------------------------------

describe("getEffectiveLines", () => {
  it("injects synthetic single-word array for line-synced lines", () => {
    const lines: LyricLine[] = [line({ id: "a", text: "Hi", begin: 1, end: 2 })];
    expect(getEffectiveLines(lines)[0].words).toEqual([{ text: "Hi", begin: 1, end: 2 }]);
  });

  it("leaves word-synced lines untouched", () => {
    const words = [{ text: "Hi ", begin: 0, end: 1 }];
    const lines: LyricLine[] = [line({ words })];
    expect(getEffectiveLines(lines)[0].words).toBe(words);
  });

  it("leaves untimed lines untouched (no synthetic words)", () => {
    const lines: LyricLine[] = [line({ id: "a", text: "Hi" })];
    expect(getEffectiveLines(lines)[0].words).toBeUndefined();
  });

  it("preserves other line properties", () => {
    const lines: LyricLine[] = [line({ id: "a", agentId: "v9", begin: 1, end: 2, groupId: "g1", instanceIdx: 3 })];
    const out = getEffectiveLines(lines)[0];
    expect(out.id).toBe("a");
    expect(out.agentId).toBe("v9");
    expect(out.groupId).toBe("g1");
    expect(out.instanceIdx).toBe(3);
  });
});

describe("getEffectiveLines timing source", () => {
  it("records where each effective line's words came from", () => {
    const [w, l, u] = getEffectiveLines([
      createLine({ id: "w", text: "a", words: [{ text: "a", begin: 1, end: 2 }] }),
      createLine({ id: "l", text: "Line synced", begin: 3, end: 5 }),
      createLine({ id: "u", text: "untimed" }),
    ]);
    expect([w.timingSource, l.timingSource, u.timingSource]).toEqual(["words", "line", "none"]);
    expect(l.words).toEqual([{ text: "Line synced", begin: 3, end: 5 }]);
  });

  it("invariant: an EffectiveLine is not assignable to RawLine", () => {
    const [line] = getEffectiveLines([createLine({ text: "a" })]);
    expectTypeOf(line).not.toMatchTypeOf<RawLine>();
    expectTypeOf(createLine({ text: "a" })).toMatchTypeOf<RawLine>();
  });
});

describe("effectiveTimingWrite", () => {
  it("regression D7/[: a timing edit of a line-synced row writes begin/end, not words", () => {
    const [line] = getEffectiveLines([createLine({ text: "Line synced", begin: 3, end: 5 })]);
    expect(effectiveTimingWrite(line, [{ text: "Line synced", begin: 4, end: 6 }])).toEqual({ begin: 4, end: 6 });
  });

  it("writes words for a word-synced line and never writes text", () => {
    const [line] = getEffectiveLines([createLine({ text: "a b", words: [{ text: "a ", begin: 1, end: 2 }] })]);
    const words = [{ text: "a ", begin: 1.5, end: 2 }];
    expect(effectiveTimingWrite(line, words)).toEqual({ words });
  });

  it("accepts a raw line too", () => {
    expect(
      effectiveTimingWrite(createLine({ text: "x", begin: 1, end: 2 }), [{ text: "x", begin: 2, end: 3 }]),
    ).toEqual({
      begin: 2,
      end: 3,
    });
  });
});

describe("effectiveMainWordEdit", () => {
  it("keeps a line-synced row line-synced when a structural edit leaves one word", () => {
    const [line] = getEffectiveLines([createLine({ text: "Line synced", begin: 3, end: 5 })]);
    expect(effectiveMainWordEdit(line, [{ text: "Line synced", begin: 6, end: 8 }])).toEqual({ begin: 6, end: 8 });
  });

  it("regression Alt-duplicate: rejects a structural edit that would give a line-synced row two words", () => {
    const [line] = getEffectiveLines([createLine({ text: "L", begin: 3, end: 5 })]);
    expect(
      effectiveMainWordEdit(line, [
        { text: "L ", begin: 3, end: 5 },
        { text: "L", begin: 6, end: 8 },
      ]),
    ).toBeNull();
  });

  it("regression #213: converts a line-synced row to words when the caller opts in", () => {
    const [line] = getEffectiveLines([createLine({ text: "It hurts", begin: 3, end: 5 })]);
    const words = [
      { text: "It hurts ", begin: 3, end: 5 },
      { text: "never", begin: 6, end: 7 },
    ];
    expect(effectiveMainWordEdit(line, words, { convertLineSynced: true })).toEqual({
      words,
      text: "It hurts never",
    });
  });

  it("converting leaves a word-synced line on the normal word edit", () => {
    const [line] = getEffectiveLines([createLine({ text: "a", words: [{ text: "a", begin: 1, end: 2 }] })]);
    const words = [
      { text: "a ", begin: 1, end: 2 },
      { text: "b", begin: 2, end: 3 },
    ];
    expect(effectiveMainWordEdit(line, words, { convertLineSynced: true })).toEqual({ words, text: "a b" });
  });

  it("re-derives text for a word-synced line", () => {
    const [line] = getEffectiveLines([
      createLine({
        text: "a b",
        words: [
          { text: "a ", begin: 1, end: 2 },
          { text: "b", begin: 2, end: 3 },
        ],
      }),
    ]);
    const reordered = [
      { text: "b ", begin: 0, end: 1 },
      { text: "a", begin: 1, end: 2 },
    ];
    expect(effectiveMainWordEdit(line, reordered)).toEqual({ words: reordered, text: "b a" });
  });
});

describe("effectiveWordTextEdit", () => {
  it("regression: renaming the word of a line-synced row updates text and keeps it line-synced", () => {
    const [line] = getEffectiveLines([createLine({ text: "Old", begin: 3, end: 5 })]);
    expect(effectiveWordTextEdit(line, [{ text: "New words", begin: 3, end: 5 }])).toEqual({ text: "New words" });
  });

  it("writes words for a word-synced line", () => {
    const [line] = getEffectiveLines([createLine({ text: "a b", words: [{ text: "a ", begin: 1, end: 2 }] })]);
    const words = [{ text: "z ", begin: 1, end: 2 }];
    expect(effectiveWordTextEdit(line, words)).toEqual({ words });
  });

  it("writes words for a raw line with no timing", () => {
    const words = [{ text: "z", begin: 1, end: 2 }];
    expect(effectiveWordTextEdit(createLine({ text: "a" }), words)).toEqual({ words });
  });

  it("accepts a raw line-synced line", () => {
    const raw = createLine({ text: "Old", begin: 3, end: 5 });
    expect(effectiveWordTextEdit(raw, [{ text: "New", begin: 3, end: 5 }])).toEqual({ text: "New" });
  });
});
