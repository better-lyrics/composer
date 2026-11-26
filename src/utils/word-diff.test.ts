/**
 * @vitest-environment node
 */
import { newWordId } from "@/domain/word/id";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";
import { applySiblingWords, proportionalRemap, wordsDeepEqual, wouldDivergenceCauseRetiming } from "./word-diff";

describe("applySiblingWords · split preserves unchanged-word timing", () => {
  it("split: 'love' → 'lo'+'ve' preserves sibling 'I' and 'you' timings exactly", () => {
    // The headline scenario: source split 'love' 50/50; sibling has different
    // per-word rhythm than source. Smart sync MUST keep sibling 'I' at 30..30.4
    // and 'you' at 30.7..31.2, not retime them via proportional remap.
    const sourceBefore: WordTiming[] = [
      { id: "w1", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w2", text: "love", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
      { id: "w3", text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
    ];
    const sourceAfter: WordTiming[] = [
      { id: "w4", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w5", text: "lo", sep: "", begin: 0.3, end: 0.45, joinsNext: true },
      { id: "w6", text: "ve", sep: " ", begin: 0.45, end: 0.6, joinsNext: false },
      { id: "w7", text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w8", text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false },
      { id: "w9", text: "love", sep: " ", begin: 30.4, end: 30.7, joinsNext: false },
      { id: "w10", text: "you", sep: "", begin: 30.7, end: 31.2, joinsNext: false },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(4);
    expect(result![0]).toEqual({ text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false });
    expect(result![1].text).toBe("lo");
    expect(result![1].begin).toBeCloseTo(30.4);
    expect(result![1].end).toBeCloseTo(30.55);
    expect(result![2]).toMatchObject({ text: "ve", sep: " " });
    expect(result![2].begin).toBeCloseTo(30.55);
    expect(result![2].end).toBeCloseTo(30.7);
    expect(result![3]).toEqual({ text: "you", sep: "", begin: 30.7, end: 31.2, joinsNext: false });
  });

  it("split: respects an asymmetric source split ratio (30/70 instead of 50/50)", () => {
    const sourceBefore: WordTiming[] = [
      { id: "w11", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w12", text: "love", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
      { id: "w13", text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
    ];
    const sourceAfter: WordTiming[] = [
      { id: "w14", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w15", text: "lo", sep: "", begin: 0.3, end: 0.39, joinsNext: true }, // 30% of love-slot
      { id: "w16", text: "ve", sep: " ", begin: 0.39, end: 0.6, joinsNext: false }, // 70%
      { id: "w17", text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w18", text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false },
      { id: "w19", text: "love", sep: " ", begin: 30.4, end: 30.7, joinsNext: false }, // 0.3s slot
      { id: "w20", text: "you", sep: "", begin: 30.7, end: 31.2, joinsNext: false },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result![1].end).toBeCloseTo(30.49); // 30.4 + 30% * 0.3
    expect(result![2].begin).toBeCloseTo(30.49);
  });
});

describe("applySiblingWords · merge preserves unchanged-word timing", () => {
  it("merge: 'love'+'you' → 'loveyou' combines sibling slots and preserves 'I'", () => {
    const sourceBefore: WordTiming[] = [
      { id: "w21", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w22", text: "love", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
      { id: "w23", text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
    ];
    const sourceAfter: WordTiming[] = [
      { id: "w24", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w25", text: "loveyou", sep: "", begin: 0.3, end: 1, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w26", text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false },
      { id: "w27", text: "love", sep: " ", begin: 30.4, end: 30.7, joinsNext: false },
      { id: "w28", text: "you", sep: "", begin: 30.7, end: 31.2, joinsNext: false },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result).toHaveLength(2);
    expect(result![0]).toEqual({ text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false });
    expect(result![1]).toEqual({ text: "loveyou", sep: "", begin: 30.4, end: 31.2, joinsNext: false });
  });

  it("merge of all words: collapses to a single span covering sibling's entire range", () => {
    const sourceBefore: WordTiming[] = [
      { id: "w29", text: "a", sep: " ", begin: 0, end: 0.5, joinsNext: false },
      { id: "w30", text: "b", sep: "", begin: 0.5, end: 1, joinsNext: false },
    ];
    const sourceAfter: WordTiming[] = [{ id: "w31", text: "ab", sep: "", begin: 0, end: 1, joinsNext: false }];
    const sibling: WordTiming[] = [
      { id: "w32", text: "a", sep: " ", begin: 10, end: 10.4, joinsNext: false },
      { id: "w33", text: "b", sep: "", begin: 10.4, end: 11.2, joinsNext: false },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result).toHaveLength(1);
    expect(result![0]).toEqual({ text: "ab", sep: "", begin: 10, end: 11.2, joinsNext: false });
  });
});

describe("applySiblingWords · insert", () => {
  it("inserts a new word between matched siblings without disturbing the matched timings", () => {
    const sourceBefore: WordTiming[] = [
      { id: "w34", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w35", text: "you", sep: "", begin: 0.3, end: 1, joinsNext: false },
    ];
    const sourceAfter: WordTiming[] = [
      { id: "w36", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w37", text: "love", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
      { id: "w38", text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w39", text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false },
      { id: "w40", text: "you", sep: "", begin: 30.4, end: 31.2, joinsNext: false },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    // 'I' and 'you' must keep their sibling timing exactly
    expect(result![0]).toEqual({ text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false });
    expect(result![2]).toEqual({ text: "you", sep: "", begin: 30.4, end: 31.2, joinsNext: false });
    // 'love' takes the boundary moment (zero or near-zero width is acceptable)
    expect(result![1]).toMatchObject({ text: "love", sep: " " });
  });
});

describe("applySiblingWords · delete", () => {
  it("dropping a source word leaves remaining sibling timings intact", () => {
    const sourceBefore: WordTiming[] = [
      { id: "w41", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w42", text: "love", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
      { id: "w43", text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
    ];
    const sourceAfter: WordTiming[] = [
      { id: "w44", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w45", text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w46", text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false },
      { id: "w47", text: "love", sep: " ", begin: 30.4, end: 30.7, joinsNext: false },
      { id: "w48", text: "you", sep: "", begin: 30.7, end: 31.2, joinsNext: false },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result).toHaveLength(2);
    expect(result![0]).toEqual({ text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false });
    expect(result![1]).toEqual({ text: "you", sep: "", begin: 30.7, end: 31.2, joinsNext: false });
  });
});

describe("applySiblingWords · explicit flag propagation", () => {
  it("matched word: source explicit=true overrides sibling's absent flag", () => {
    const sourceBefore: WordTiming[] = [
      { id: "w49", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w50", text: "love", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
    ];
    const sourceAfter: WordTiming[] = [
      { id: "w51", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w52", text: "love", sep: " ", begin: 0.3, end: 0.6, explicit: true, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w53", text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false },
      { id: "w54", text: "love", sep: " ", begin: 30.4, end: 30.7, joinsNext: false },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result![0].explicit).toBeUndefined();
    expect(result![1].explicit).toBe(true);
    expect(result![1].begin).toBeCloseTo(30.4);
    expect(result![1].end).toBeCloseTo(30.7);
  });

  it("matched word: source unmarked clears sibling's previous flag", () => {
    const sourceBefore: WordTiming[] = [
      { id: "w55", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w56", text: "love", sep: " ", begin: 0.3, end: 0.6, explicit: true, joinsNext: false },
    ];
    const sourceAfter: WordTiming[] = [
      { id: "w57", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w58", text: "love", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w59", text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false },
      { id: "w60", text: "love", sep: " ", begin: 30.4, end: 30.7, explicit: true, joinsNext: false },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result![1].explicit).toBeUndefined();
  });

  it("interpolated word during split inherits source explicit flag", () => {
    const sourceBefore: WordTiming[] = [
      { id: "w61", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w62", text: "fuck", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
      { id: "w63", text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
    ];
    const sourceAfter: WordTiming[] = [
      { id: "w64", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w65", text: "fu", sep: "", begin: 0.3, end: 0.45, explicit: true, joinsNext: true },
      { id: "w66", text: "ck", sep: " ", begin: 0.45, end: 0.6, explicit: true, joinsNext: false },
      { id: "w67", text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w68", text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false },
      { id: "w69", text: "fuck", sep: " ", begin: 30.4, end: 30.7, joinsNext: false },
      { id: "w70", text: "you", sep: "", begin: 30.7, end: 31.2, joinsNext: false },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result![0].explicit).toBeUndefined();
    expect(result![1].explicit).toBe(true);
    expect(result![2].explicit).toBe(true);
    expect(result![3].explicit).toBeUndefined();
  });

  it("proportionalRemap carries source explicit onto each output word", () => {
    const sourceAfter: WordTiming[] = [
      { id: "w71", text: "fuck", sep: "", begin: 0, end: 0.5, explicit: true, joinsNext: true },
      { id: "w72", text: "off", sep: "", begin: 0.5, end: 1, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w73", text: "fuck", sep: "", begin: 10, end: 10.6, joinsNext: true },
      { id: "w74", text: "off", sep: "", begin: 10.6, end: 11, joinsNext: false },
    ];
    const result = proportionalRemap(sourceAfter, sibling);
    expect(result![0].explicit).toBe(true);
    expect(result![1].explicit).toBeUndefined();
  });
});

describe("applySiblingWords · syllable joins", () => {
  it("new-word run takes its joins from the source words", () => {
    const sourceBefore: WordTiming[] = [
      { id: "w75", text: "ev", sep: "", begin: 0, end: 0.3, joinsNext: true },
      { id: "w76", text: "er", sep: "", begin: 0.3, end: 0.6, joinsNext: true },
      { id: "w77", text: "y", sep: "", begin: 0.6, end: 0.9, joinsNext: false },
    ];
    const sourceAfter: WordTiming[] = [
      { id: "w78", text: "e", sep: "", begin: 0, end: 0.15, joinsNext: true },
      { id: "w79", text: "v", sep: "", begin: 0.15, end: 0.3, joinsNext: true },
      { id: "w80", text: "er", sep: "", begin: 0.3, end: 0.6, joinsNext: true },
      { id: "w81", text: "y", sep: "", begin: 0.6, end: 0.9, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w82", text: "ev", sep: "", begin: 30, end: 30.3, joinsNext: true },
      { id: "w83", text: "er", sep: "", begin: 30.3, end: 30.6, joinsNext: true },
      { id: "w84", text: "y", sep: "", begin: 30.6, end: 30.9, joinsNext: false },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result!.map((w) => w.joinsNext)).toEqual([true, true, true, false]);
  });

  it("new-word run between spaced words joins nothing", () => {
    const sourceBefore: WordTiming[] = [
      { id: "w85", text: "hello", sep: " ", begin: 0, end: 0.5, joinsNext: false },
      { id: "w86", text: "world", sep: "", begin: 0.5, end: 1, joinsNext: false },
    ];
    const sourceAfter: WordTiming[] = [
      { id: "w87", text: "hello", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w88", text: "there", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
      { id: "w89", text: "world", sep: "", begin: 0.6, end: 1, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w90", text: "hello", sep: " ", begin: 30, end: 30.4, joinsNext: false },
      { id: "w91", text: "world", sep: "", begin: 30.4, end: 31, joinsNext: false },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result![1].joinsNext).toBe(false);
  });

  it("new-word run at array start joins the matched word after it", () => {
    const sourceBefore: WordTiming[] = [
      { id: "w92", text: "er", sep: "", begin: 0.3, end: 0.6, joinsNext: true },
      { id: "w93", text: "y", sep: "", begin: 0.6, end: 0.9, joinsNext: false },
    ];
    const sourceAfter: WordTiming[] = [
      { id: "w94", text: "ev", sep: "", begin: 0, end: 0.3, joinsNext: true },
      { id: "w95", text: "er", sep: "", begin: 0.3, end: 0.6, joinsNext: true },
      { id: "w96", text: "y", sep: "", begin: 0.6, end: 0.9, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w97", text: "er", sep: "", begin: 30.3, end: 30.6, joinsNext: true },
      { id: "w98", text: "y", sep: "", begin: 30.6, end: 30.9, joinsNext: false },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result![0].joinsNext).toBe(true);
  });

  it("matched words keep the source's joins", () => {
    const sourceBefore: WordTiming[] = [
      { id: "w99", text: "ev", sep: "", begin: 0, end: 0.3, joinsNext: true },
      { id: "w100", text: "er", sep: "", begin: 0.3, end: 0.6, joinsNext: false },
    ];
    const sourceAfter: WordTiming[] = [
      { id: "w101", text: "ev", sep: "", begin: 0, end: 0.3, joinsNext: true },
      { id: "w102", text: "er", sep: "", begin: 0.3, end: 0.6, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w103", text: "ev", sep: "", begin: 30, end: 30.3, joinsNext: false },
      { id: "w104", text: "er", sep: "", begin: 30.3, end: 30.6, joinsNext: false },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result!.map((w) => w.joinsNext)).toEqual([true, false]);
  });
});

describe("applySiblingWords · fallback paths", () => {
  it("falls back to proportional remap when sibling word count differs from sourceBefore (sibling already diverged)", () => {
    const sourceBefore: WordTiming[] = [
      { id: "w105", text: "I", sep: " ", begin: 0, end: 0.5, joinsNext: false },
      { id: "w106", text: "you", sep: "", begin: 0.5, end: 1, joinsNext: false },
    ];
    const sourceAfter: WordTiming[] = [
      { id: "w107", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w108", text: "love", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
      { id: "w109", text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
    ];
    // Sibling already diverged (single merged word)
    const sibling: WordTiming[] = [{ id: "w110", text: "Iyou", sep: "", begin: 30, end: 31, joinsNext: false }];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result).toHaveLength(3);
    expect(result![0].begin).toBeCloseTo(30);
    expect(result![2].end).toBeCloseTo(31);
  });

  it("returns empty array when sourceAfter is empty", () => {
    const result = applySiblingWords(
      [],
      [{ id: "w111", text: "x", sep: "", begin: 0, end: 1, joinsNext: false }],
      [{ id: "w112", text: "x", sep: "", begin: 5, end: 6, joinsNext: false }],
    );
    expect(result).toEqual([]);
  });

  it("returns null when any input is undefined", () => {
    expect(applySiblingWords(undefined, [], [])).toBeNull();
    expect(applySiblingWords([], undefined, [])).toBeNull();
    expect(applySiblingWords([], [], undefined)).toBeNull();
  });
});

describe("proportionalRemap (current behavior baseline)", () => {
  it("rewrites every output word's timing onto sibling span proportionally", () => {
    const sourceAfter: WordTiming[] = [
      { id: "w113", text: "a", sep: "", begin: 0, end: 0.5, joinsNext: true },
      { id: "w114", text: "b", sep: "", begin: 0.5, end: 1, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w115", text: "a", sep: "", begin: 10, end: 10.6, joinsNext: true },
      { id: "w116", text: "b", sep: "", begin: 10.6, end: 11, joinsNext: false },
    ];
    const result = proportionalRemap(sourceAfter, sibling);
    expect(result).toHaveLength(2);
    expect(result![0].begin).toBeCloseTo(10);
    expect(result![0].end).toBeCloseTo(10.5);
    expect(result![1].begin).toBeCloseTo(10.5);
    expect(result![1].end).toBeCloseTo(11);
  });

  it("returns null on degenerate spans", () => {
    expect(proportionalRemap([], [{ id: "w117", text: "x", sep: "", begin: 0, end: 1, joinsNext: false }])).toBeNull();
    expect(proportionalRemap([{ id: "w118", text: "x", sep: "", begin: 0, end: 1, joinsNext: false }], [])).toBeNull();
  });
});

describe("wordsDeepEqual", () => {
  it("treats null === null as equal", () => {
    expect(wordsDeepEqual(null, null)).toBe(true);
  });
  it("treats null vs non-null as not equal", () => {
    expect(wordsDeepEqual(null, [])).toBe(false);
  });
  it("compares lengths first", () => {
    expect(wordsDeepEqual([], [{ id: "w119", text: "x", sep: "", begin: 0, end: 1, joinsNext: false }])).toBe(false);
  });
  it("compares text and timing within tolerance", () => {
    expect(
      wordsDeepEqual(
        [{ id: "w120", text: "x", sep: "", begin: 0, end: 1, joinsNext: false }],
        [{ id: "w121", text: "x", sep: "", begin: 0.0000000001, end: 1.0000000001, joinsNext: false }],
      ),
    ).toBe(true);
  });
  it("rejects when text differs", () => {
    expect(
      wordsDeepEqual(
        [{ id: "w122", text: "x", sep: "", begin: 0, end: 1, joinsNext: false }],
        [{ id: "w123", text: "y", sep: "", begin: 0, end: 1, joinsNext: false }],
      ),
    ).toBe(false);
  });
});

describe("wouldDivergenceCauseRetiming", () => {
  function makeLinkedLines(siblingWordTimings: WordTiming[]) {
    return [
      {
        id: "A",
        groupId: "g1",
        templateLineIdx: 0,
        words: [
          { id: newWordId(), text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
          { id: newWordId(), text: "love", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
          { id: newWordId(), text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
        ],
      },
      {
        id: "B",
        groupId: "g1",
        templateLineIdx: 0,
        words: siblingWordTimings,
      },
    ];
  }

  const newWords: WordTiming[] = [
    { id: "w124", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
    { id: "w125", text: "lo", sep: "", begin: 0.3, end: 0.45, joinsNext: true },
    { id: "w126", text: "ve", sep: " ", begin: 0.45, end: 0.6, joinsNext: false },
    { id: "w127", text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
  ];

  it("returns false when sibling has identical per-word offsets to source", () => {
    const lines = makeLinkedLines([
      { id: "w128", text: "I", sep: " ", begin: 30, end: 30.3, joinsNext: false },
      { id: "w129", text: "love", sep: " ", begin: 30.3, end: 30.6, joinsNext: false },
      { id: "w130", text: "you", sep: "", begin: 30.6, end: 31, joinsNext: false },
    ]);
    expect(wouldDivergenceCauseRetiming(lines, "A", newWords)).toBe(false);
  });

  it("returns true when sibling has different per-word rhythm than source", () => {
    const lines = makeLinkedLines([
      { id: "w131", text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false },
      { id: "w132", text: "love", sep: " ", begin: 30.4, end: 30.7, joinsNext: false },
      { id: "w133", text: "you", sep: "", begin: 30.7, end: 31.2, joinsNext: false },
    ]);
    expect(wouldDivergenceCauseRetiming(lines, "A", newWords)).toBe(true);
  });

  it("returns false when source has no group", () => {
    const lines = [{ id: "A", words: [{ id: "w134", text: "x", sep: "", begin: 0, end: 1, joinsNext: false }] }];
    expect(
      wouldDivergenceCauseRetiming(lines, "A", [
        { id: "w135", text: "x", sep: "", begin: 0, end: 0.5, joinsNext: false },
      ]),
    ).toBe(false);
  });

  it("returns false when source has no other linked siblings", () => {
    const lines = [
      {
        id: "A",
        groupId: "g1",
        templateLineIdx: 0,
        words: [{ id: "w136", text: "x", sep: "", begin: 0, end: 1, joinsNext: false }],
      },
    ];
    expect(
      wouldDivergenceCauseRetiming(lines, "A", [
        { id: "w137", text: "x", sep: "", begin: 0, end: 0.5, joinsNext: false },
      ]),
    ).toBe(false);
  });

  it("ignores detached siblings", () => {
    const lines = [
      {
        id: "A",
        groupId: "g1",
        templateLineIdx: 0,
        words: [
          { id: "w138", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
          { id: "w139", text: "love", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
        ],
      },
      {
        id: "B",
        groupId: "g1",
        templateLineIdx: 0,
        detached: true,
        words: [
          { id: "w140", text: "I", sep: " ", begin: 30, end: 30.5, joinsNext: false },
          { id: "w141", text: "love", sep: " ", begin: 30.5, end: 31, joinsNext: false },
        ],
      },
    ];
    expect(
      wouldDivergenceCauseRetiming(lines, "A", [
        { id: "w142", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
        { id: "w143", text: "lo", sep: "", begin: 0.3, end: 0.45, joinsNext: true },
        { id: "w144", text: "ve", sep: " ", begin: 0.45, end: 0.6, joinsNext: false },
      ]),
    ).toBe(false);
  });

  it("returns false when word count is unchanged (handled by caller's count-unchanged path)", () => {
    const lines = makeLinkedLines([
      { id: "w145", text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false },
      { id: "w146", text: "love", sep: " ", begin: 30.4, end: 30.7, joinsNext: false },
      { id: "w147", text: "you", sep: "", begin: 30.7, end: 31.2, joinsNext: false },
    ]);
    // Same word count, just text rename
    const sameCount: WordTiming[] = [
      { id: "w148", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w149", text: "luv", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
      { id: "w150", text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
    ];
    expect(wouldDivergenceCauseRetiming(lines, "A", sameCount)).toBe(false);
  });

  it("checks backgroundWords field when called with field='backgroundWords'", () => {
    const lines = [
      {
        id: "A",
        groupId: "g1",
        templateLineIdx: 0,
        backgroundWords: [
          { id: "w151", text: "ah", sep: " ", begin: 0, end: 0.5, joinsNext: false },
          { id: "w152", text: "ah", sep: "", begin: 0.5, end: 1, joinsNext: false },
        ],
      },
      {
        id: "B",
        groupId: "g1",
        templateLineIdx: 0,
        backgroundWords: [
          { id: "w153", text: "ah", sep: " ", begin: 30, end: 30.6, joinsNext: false },
          { id: "w154", text: "ah", sep: "", begin: 30.6, end: 31, joinsNext: false },
        ],
      },
    ];
    const newBg: WordTiming[] = [
      { id: "w155", text: "ah", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w156", text: "ah", sep: " ", begin: 0.3, end: 0.7, joinsNext: false },
      { id: "w157", text: "ah", sep: "", begin: 0.7, end: 1, joinsNext: false },
    ];
    expect(wouldDivergenceCauseRetiming(lines, "A", newBg, "backgroundWords")).toBe(true);
  });
});
