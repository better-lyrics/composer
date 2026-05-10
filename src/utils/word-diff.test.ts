/**
 * @vitest-environment node
 */
import type { WordTiming } from "@/stores/project";
import { describe, expect, it } from "vitest";
import {
  applySiblingWords,
  lcsPairs,
  proportionalRemap,
  wordKey,
  wordsDeepEqual,
  wouldDivergenceCauseRetiming,
} from "./word-diff";

describe("wordKey", () => {
  it("strips trailing whitespace", () => {
    expect(wordKey("love ")).toBe("love");
  });
  it("returns the bare word when no surrounding chars", () => {
    expect(wordKey("you")).toBe("you");
  });
  it("treats split-character variants as the same key", () => {
    // stripSplitCharacter removes the syllable split marker
    expect(wordKey("li ght")).toBe(wordKey("li ght "));
  });
});

describe("lcsPairs", () => {
  it("returns matching index pairs in order", () => {
    expect(lcsPairs(["a", "b", "c"], ["a", "b", "c"])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
  });
  it("handles inserts", () => {
    expect(lcsPairs(["a", "c"], ["a", "b", "c"])).toEqual([
      [0, 0],
      [1, 2],
    ]);
  });
  it("handles deletions", () => {
    expect(lcsPairs(["a", "b", "c"], ["a", "c"])).toEqual([
      [0, 0],
      [2, 1],
    ]);
  });
  it("handles substitutions (no match)", () => {
    expect(lcsPairs(["a", "b"], ["x", "y"])).toEqual([]);
  });
  it("handles empty inputs", () => {
    expect(lcsPairs([], ["a"])).toEqual([]);
    expect(lcsPairs(["a"], [])).toEqual([]);
    expect(lcsPairs([], [])).toEqual([]);
  });
});

describe("applySiblingWords · split preserves unchanged-word timing", () => {
  it("split: 'love' → 'lo'+'ve' preserves sibling 'I' and 'you' timings exactly", () => {
    // The headline scenario: source split 'love' 50/50; sibling has different
    // per-word rhythm than source. Smart sync MUST keep sibling 'I' at 30..30.4
    // and 'you' at 30.7..31.2 — not retime them via proportional remap.
    const sourceBefore: WordTiming[] = [
      { text: "I ", begin: 0, end: 0.3 },
      { text: "love ", begin: 0.3, end: 0.6 },
      { text: "you", begin: 0.6, end: 1 },
    ];
    const sourceAfter: WordTiming[] = [
      { text: "I ", begin: 0, end: 0.3 },
      { text: "lo", begin: 0.3, end: 0.45 },
      { text: "ve ", begin: 0.45, end: 0.6 },
      { text: "you", begin: 0.6, end: 1 },
    ];
    const sibling: WordTiming[] = [
      { text: "I ", begin: 30, end: 30.4 },
      { text: "love ", begin: 30.4, end: 30.7 },
      { text: "you", begin: 30.7, end: 31.2 },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(4);
    expect(result![0]).toEqual({ text: "I ", begin: 30, end: 30.4 });
    expect(result![1].text).toBe("lo");
    expect(result![1].begin).toBeCloseTo(30.4);
    expect(result![1].end).toBeCloseTo(30.55);
    expect(result![2].text).toBe("ve ");
    expect(result![2].begin).toBeCloseTo(30.55);
    expect(result![2].end).toBeCloseTo(30.7);
    expect(result![3]).toEqual({ text: "you", begin: 30.7, end: 31.2 });
  });

  it("split: respects an asymmetric source split ratio (30/70 instead of 50/50)", () => {
    const sourceBefore: WordTiming[] = [
      { text: "I ", begin: 0, end: 0.3 },
      { text: "love ", begin: 0.3, end: 0.6 },
      { text: "you", begin: 0.6, end: 1 },
    ];
    const sourceAfter: WordTiming[] = [
      { text: "I ", begin: 0, end: 0.3 },
      { text: "lo", begin: 0.3, end: 0.39 }, // 30% of love-slot
      { text: "ve ", begin: 0.39, end: 0.6 }, // 70%
      { text: "you", begin: 0.6, end: 1 },
    ];
    const sibling: WordTiming[] = [
      { text: "I ", begin: 30, end: 30.4 },
      { text: "love ", begin: 30.4, end: 30.7 }, // 0.3s slot
      { text: "you", begin: 30.7, end: 31.2 },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result![1].end).toBeCloseTo(30.49); // 30.4 + 30% * 0.3
    expect(result![2].begin).toBeCloseTo(30.49);
  });
});

describe("applySiblingWords · merge preserves unchanged-word timing", () => {
  it("merge: 'love'+'you' → 'loveyou' combines sibling slots and preserves 'I'", () => {
    const sourceBefore: WordTiming[] = [
      { text: "I ", begin: 0, end: 0.3 },
      { text: "love ", begin: 0.3, end: 0.6 },
      { text: "you", begin: 0.6, end: 1 },
    ];
    const sourceAfter: WordTiming[] = [
      { text: "I ", begin: 0, end: 0.3 },
      { text: "loveyou", begin: 0.3, end: 1 },
    ];
    const sibling: WordTiming[] = [
      { text: "I ", begin: 30, end: 30.4 },
      { text: "love ", begin: 30.4, end: 30.7 },
      { text: "you", begin: 30.7, end: 31.2 },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result).toHaveLength(2);
    expect(result![0]).toEqual({ text: "I ", begin: 30, end: 30.4 });
    expect(result![1]).toEqual({ text: "loveyou", begin: 30.4, end: 31.2 });
  });

  it("merge of all words: collapses to a single span covering sibling's entire range", () => {
    const sourceBefore: WordTiming[] = [
      { text: "a ", begin: 0, end: 0.5 },
      { text: "b", begin: 0.5, end: 1 },
    ];
    const sourceAfter: WordTiming[] = [{ text: "ab", begin: 0, end: 1 }];
    const sibling: WordTiming[] = [
      { text: "a ", begin: 10, end: 10.4 },
      { text: "b", begin: 10.4, end: 11.2 },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result).toHaveLength(1);
    expect(result![0]).toEqual({ text: "ab", begin: 10, end: 11.2 });
  });
});

describe("applySiblingWords · insert", () => {
  it("inserts a new word between matched siblings without disturbing the matched timings", () => {
    const sourceBefore: WordTiming[] = [
      { text: "I ", begin: 0, end: 0.3 },
      { text: "you", begin: 0.3, end: 1 },
    ];
    const sourceAfter: WordTiming[] = [
      { text: "I ", begin: 0, end: 0.3 },
      { text: "love ", begin: 0.3, end: 0.6 },
      { text: "you", begin: 0.6, end: 1 },
    ];
    const sibling: WordTiming[] = [
      { text: "I ", begin: 30, end: 30.4 },
      { text: "you", begin: 30.4, end: 31.2 },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    // 'I' and 'you' must keep their sibling timing exactly
    expect(result![0]).toEqual({ text: "I ", begin: 30, end: 30.4 });
    expect(result![2]).toEqual({ text: "you", begin: 30.4, end: 31.2 });
    // 'love' takes the boundary moment (zero or near-zero width is acceptable)
    expect(result![1].text).toBe("love ");
  });
});

describe("applySiblingWords · delete", () => {
  it("dropping a source word leaves remaining sibling timings intact", () => {
    const sourceBefore: WordTiming[] = [
      { text: "I ", begin: 0, end: 0.3 },
      { text: "love ", begin: 0.3, end: 0.6 },
      { text: "you", begin: 0.6, end: 1 },
    ];
    const sourceAfter: WordTiming[] = [
      { text: "I ", begin: 0, end: 0.3 },
      { text: "you", begin: 0.6, end: 1 },
    ];
    const sibling: WordTiming[] = [
      { text: "I ", begin: 30, end: 30.4 },
      { text: "love ", begin: 30.4, end: 30.7 },
      { text: "you", begin: 30.7, end: 31.2 },
    ];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result).toHaveLength(2);
    expect(result![0]).toEqual({ text: "I ", begin: 30, end: 30.4 });
    expect(result![1]).toEqual({ text: "you", begin: 30.7, end: 31.2 });
  });
});

describe("applySiblingWords · fallback paths", () => {
  it("falls back to proportional remap when sibling word count differs from sourceBefore (sibling already diverged)", () => {
    const sourceBefore: WordTiming[] = [
      { text: "I ", begin: 0, end: 0.5 },
      { text: "you", begin: 0.5, end: 1 },
    ];
    const sourceAfter: WordTiming[] = [
      { text: "I ", begin: 0, end: 0.3 },
      { text: "love ", begin: 0.3, end: 0.6 },
      { text: "you", begin: 0.6, end: 1 },
    ];
    // Sibling already diverged (single merged word)
    const sibling: WordTiming[] = [{ text: "Iyou", begin: 30, end: 31 }];
    const result = applySiblingWords(sourceAfter, sourceBefore, sibling);
    expect(result).toHaveLength(3);
    expect(result![0].begin).toBeCloseTo(30);
    expect(result![2].end).toBeCloseTo(31);
  });

  it("returns empty array when sourceAfter is empty", () => {
    const result = applySiblingWords([], [{ text: "x", begin: 0, end: 1 }], [{ text: "x", begin: 5, end: 6 }]);
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
      { text: "a", begin: 0, end: 0.5 },
      { text: "b", begin: 0.5, end: 1 },
    ];
    const sibling: WordTiming[] = [
      { text: "a", begin: 10, end: 10.6 },
      { text: "b", begin: 10.6, end: 11 },
    ];
    const result = proportionalRemap(sourceAfter, sibling);
    expect(result).toHaveLength(2);
    expect(result![0].begin).toBeCloseTo(10);
    expect(result![0].end).toBeCloseTo(10.5);
    expect(result![1].begin).toBeCloseTo(10.5);
    expect(result![1].end).toBeCloseTo(11);
  });

  it("returns null on degenerate spans", () => {
    expect(proportionalRemap([], [{ text: "x", begin: 0, end: 1 }])).toBeNull();
    expect(proportionalRemap([{ text: "x", begin: 0, end: 1 }], [])).toBeNull();
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
    expect(wordsDeepEqual([], [{ text: "x", begin: 0, end: 1 }])).toBe(false);
  });
  it("compares text and timing within tolerance", () => {
    expect(
      wordsDeepEqual([{ text: "x", begin: 0, end: 1 }], [{ text: "x", begin: 0.0000000001, end: 1.0000000001 }]),
    ).toBe(true);
  });
  it("rejects when text differs", () => {
    expect(wordsDeepEqual([{ text: "x", begin: 0, end: 1 }], [{ text: "y", begin: 0, end: 1 }])).toBe(false);
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
          { text: "I ", begin: 0, end: 0.3 },
          { text: "love ", begin: 0.3, end: 0.6 },
          { text: "you", begin: 0.6, end: 1 },
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
    { text: "I ", begin: 0, end: 0.3 },
    { text: "lo", begin: 0.3, end: 0.45 },
    { text: "ve ", begin: 0.45, end: 0.6 },
    { text: "you", begin: 0.6, end: 1 },
  ];

  it("returns false when sibling has identical per-word offsets to source", () => {
    const lines = makeLinkedLines([
      { text: "I ", begin: 30, end: 30.3 },
      { text: "love ", begin: 30.3, end: 30.6 },
      { text: "you", begin: 30.6, end: 31 },
    ]);
    expect(wouldDivergenceCauseRetiming(lines, "A", newWords)).toBe(false);
  });

  it("returns true when sibling has different per-word rhythm than source", () => {
    const lines = makeLinkedLines([
      { text: "I ", begin: 30, end: 30.4 },
      { text: "love ", begin: 30.4, end: 30.7 },
      { text: "you", begin: 30.7, end: 31.2 },
    ]);
    expect(wouldDivergenceCauseRetiming(lines, "A", newWords)).toBe(true);
  });

  it("returns false when source has no group", () => {
    const lines = [{ id: "A", words: [{ text: "x", begin: 0, end: 1 }] }];
    expect(wouldDivergenceCauseRetiming(lines, "A", [{ text: "x", begin: 0, end: 0.5 }])).toBe(false);
  });

  it("returns false when source has no other linked siblings", () => {
    const lines = [{ id: "A", groupId: "g1", templateLineIdx: 0, words: [{ text: "x", begin: 0, end: 1 }] }];
    expect(wouldDivergenceCauseRetiming(lines, "A", [{ text: "x", begin: 0, end: 0.5 }])).toBe(false);
  });

  it("ignores detached siblings", () => {
    const lines = [
      {
        id: "A",
        groupId: "g1",
        templateLineIdx: 0,
        words: [
          { text: "I ", begin: 0, end: 0.3 },
          { text: "love ", begin: 0.3, end: 0.6 },
        ],
      },
      {
        id: "B",
        groupId: "g1",
        templateLineIdx: 0,
        detached: true,
        words: [
          { text: "I ", begin: 30, end: 30.5 },
          { text: "love ", begin: 30.5, end: 31 },
        ],
      },
    ];
    expect(
      wouldDivergenceCauseRetiming(lines, "A", [
        { text: "I ", begin: 0, end: 0.3 },
        { text: "lo", begin: 0.3, end: 0.45 },
        { text: "ve ", begin: 0.45, end: 0.6 },
      ]),
    ).toBe(false);
  });

  it("returns false when word count is unchanged (handled by caller's count-unchanged path)", () => {
    const lines = makeLinkedLines([
      { text: "I ", begin: 30, end: 30.4 },
      { text: "love ", begin: 30.4, end: 30.7 },
      { text: "you", begin: 30.7, end: 31.2 },
    ]);
    // Same word count, just text rename
    const sameCount: WordTiming[] = [
      { text: "I ", begin: 0, end: 0.3 },
      { text: "luv ", begin: 0.3, end: 0.6 },
      { text: "you", begin: 0.6, end: 1 },
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
          { text: "ah ", begin: 0, end: 0.5 },
          { text: "ah", begin: 0.5, end: 1 },
        ],
      },
      {
        id: "B",
        groupId: "g1",
        templateLineIdx: 0,
        backgroundWords: [
          { text: "ah ", begin: 30, end: 30.6 },
          { text: "ah", begin: 30.6, end: 31 },
        ],
      },
    ];
    const newBg: WordTiming[] = [
      { text: "ah ", begin: 0, end: 0.3 },
      { text: "ah ", begin: 0.3, end: 0.7 },
      { text: "ah", begin: 0.7, end: 1 },
    ];
    expect(wouldDivergenceCauseRetiming(lines, "A", newBg, "backgroundWords")).toBe(true);
  });
});
