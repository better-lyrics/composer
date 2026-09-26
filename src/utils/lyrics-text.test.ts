/**
 * @vitest-environment node
 */
import type { LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";
import { extractBackgroundVocals } from "@/utils/background-vocal-extraction";
import { textToLyricLines } from "./lyrics-text";

describe("textToLyricLines · group attrs preservation", () => {
  it("keeps groupId/instanceIdx/templateLineIdx on exact-text match", () => {
    const existing: LyricLine[] = [
      {
        id: "L1",
        text: "I love you",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [
          { text: "I ", begin: 0, end: 0.3 },
          { text: "love ", begin: 0.3, end: 0.6 },
          { text: "you", begin: 0.6, end: 1 },
        ],
      },
    ];
    const result = textToLyricLines("I love you", "v1", existing);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("L1");
    expect(result[0].groupId).toBe("g1");
    expect(result[0].instanceIdx).toBe(0);
    expect(result[0].templateLineIdx).toBe(0);
  });

  it("keeps the same id and group attrs on a position-based typo fix", () => {
    const existing: LyricLine[] = [
      {
        id: "L1",
        text: "I love you",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [
          { text: "I ", begin: 0, end: 0.3 },
          { text: "love ", begin: 0.3, end: 0.6 },
          { text: "you", begin: 0.6, end: 1 },
        ],
      },
    ];
    const result = textToLyricLines("I luv you", "v1", existing);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("L1");
    expect(result[0].text).toBe("I luv you");
    expect(result[0].groupId).toBe("g1");
    expect(result[0].instanceIdx).toBe(0);
    expect(result[0].templateLineIdx).toBe(0);
  });

  it("preserves the detached flag on a position-based typo fix", () => {
    const existing: LyricLine[] = [
      {
        id: "L1",
        text: "I love you",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        detached: true,
      },
    ];
    const result = textToLyricLines("I luv you", "v1", existing);
    expect(result[0].detached).toBe(true);
  });

  it("spreads a position-based typo fix across the edited word's slot", () => {
    const existing: LyricLine[] = [
      {
        id: "L1",
        text: "I love",
        agentId: "v1",
        words: [{ text: "I love", begin: 0, end: 1 }],
      },
    ];
    const result = textToLyricLines("I luv", "v1", existing);
    expect(result[0].words).toEqual([
      { text: "I ", begin: 0, end: 0.5 },
      { text: "luv", begin: 0.5, end: 1 },
    ]);
    expect(result[0].begin).toBeUndefined();
    expect(result[0].end).toBeUndefined();
  });

  it("keeps backgroundText on a position-based typo fix", () => {
    const existing: LyricLine[] = [{ id: "L1", text: "main", agentId: "v1", backgroundText: "ah ah" }];
    const result = textToLyricLines("main edit", "v1", existing);
    expect(result[0].backgroundText).toBe("ah ah");
  });

  it("returns brand-new lines (new ids, no group attrs) for genuinely new text", () => {
    const existing: LyricLine[] = [
      { id: "L1", text: "first", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
    ];
    const result = textToLyricLines("first\nsecond", "v1", existing);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("L1");
    expect(result[1].id).not.toBe("L1");
    expect(result[1].groupId).toBeUndefined();
  });

  it("does not steal an exact-match line that's already used by an earlier position", () => {
    const existing: LyricLine[] = [
      { id: "L1", text: "chorus", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
      { id: "L2", text: "chorus", agentId: "v1", groupId: "g1", instanceIdx: 1, templateLineIdx: 0 },
    ];
    const result = textToLyricLines("chorus\nchorus", "v1", existing);
    expect(result[0].id).toBe("L1");
    expect(result[1].id).toBe("L2");
  });

  it("preserves words on every instance of repeated text (not just the first)", () => {
    const existing: LyricLine[] = [
      {
        id: "L1",
        text: "chorus",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [{ text: "chorus", begin: 10, end: 11 }],
      },
      {
        id: "L2",
        text: "chorus",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [{ text: "chorus", begin: 30, end: 31 }],
      },
    ];
    const result = textToLyricLines("chorus\nchorus", "v1", existing);
    expect(result[0].words).toEqual(existing[0].words);
    expect(result[0].words?.[0].begin).toBe(10);
    expect(result[1].words).toEqual(existing[1].words);
    expect(result[1].words?.[0].begin).toBe(30);
  });

  it("preserves word timings on the edited line when word count matches (single-word swap)", () => {
    const existing: LyricLine[] = [
      {
        id: "L1",
        text: "I love you",
        agentId: "v1",
        words: [
          { text: "I ", begin: 0, end: 0.4 },
          { text: "love ", begin: 0.4, end: 0.8 },
          { text: "you", begin: 0.8, end: 1.2 },
        ],
      },
    ];
    const result = textToLyricLines("I luv you", "v1", existing);
    expect(result[0].text).toBe("I luv you");
    expect(result[0].words).toBeDefined();
    expect(result[0].words?.length).toBe(3);
    expect(result[0].words?.[1].text).toBe("luv ");
    expect(result[0].words?.[1].begin).toBe(0.4);
    expect(result[0].words?.[1].end).toBe(0.8);
    expect(result[0].words?.[0].begin).toBe(0);
    expect(result[0].words?.[2].end).toBe(1.2);
  });

  it("keeps untouched word timing when the edited word count differs", () => {
    const existing: LyricLine[] = [
      {
        id: "L1",
        text: "I love you",
        agentId: "v1",
        words: [
          { text: "I ", begin: 0, end: 0.4 },
          { text: "love ", begin: 0.4, end: 0.8 },
          { text: "you", begin: 0.8, end: 1.2 },
        ],
      },
    ];
    const result = textToLyricLines("I really love you", "v1", existing);
    expect(result[0].text).toBe("I really love you");
    expect(result[0].words?.map((w) => w.text)).toEqual(["I ", "really ", "love ", "you"]);
    expect(result[0].words?.slice(2)).toEqual([
      { text: "love ", begin: 0.4, end: 0.8 },
      { text: "you", begin: 0.8, end: 1.2 },
    ]);
  });

  it("does NOT position-match across an insertion (typed line count > existing)", () => {
    const existing: LyricLine[] = [
      { id: "L0", text: "A", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
      { id: "L1", text: "B", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 1 },
      { id: "L2", text: "verse", agentId: "v1" },
    ];
    // User adds a new line "x" between A and B
    const result = textToLyricLines("A\nx\nB\nverse", "v1", existing);
    expect(result).toHaveLength(4);
    expect(result[0].id).toBe("L0");
    expect(result[1].id).not.toBe("L1");
    expect(result[1].text).toBe("x");
    expect(result[1].groupId).toBeUndefined();
    expect(result[2].id).toBe("L1");
    expect(result[3].id).toBe("L2");
  });

  it("does NOT position-match across a deletion (typed line count < existing)", () => {
    const existing: LyricLine[] = [
      { id: "L0", text: "A", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
      { id: "L1", text: "B", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 1 },
      { id: "L2", text: "verse", agentId: "v1" },
    ];
    // User deletes B
    const result = textToLyricLines("A\nverse", "v1", existing);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("L0");
    expect(result[1].id).toBe("L2");
  });

  it("preserves an empty draft line when the user edits a sibling line", () => {
    const existing: LyricLine[] = [
      { id: "A", text: "verse one", agentId: "v1" },
      { id: "EMPTY", text: "", agentId: "v1" },
      { id: "C", text: "verse three", agentId: "v1" },
    ];
    const result = textToLyricLines("verse one edited\n\nverse three", "v1", existing);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("A");
    expect(result[0].text).toBe("verse one edited");
    expect(result[1].id).toBe("EMPTY");
    expect(result[1].text).toBe("");
    expect(result[2].id).toBe("C");
    expect(result[2].text).toBe("verse three");
  });

  it("fills an empty draft line when user types into its position", () => {
    const existing: LyricLine[] = [
      { id: "A", text: "first", agentId: "v1" },
      { id: "DRAFT", text: "", agentId: "v1" },
    ];
    const result = textToLyricLines("first\nfilled in", "v1", existing);
    expect(result).toHaveLength(2);
    expect(result[1].id).toBe("DRAFT");
    expect(result[1].text).toBe("filled in");
  });

  it("explicit blank line in textarea round-trips as text: ''", () => {
    const result = textToLyricLines("a\n\nb", "v1", []);
    expect(result.map((l) => l.text)).toEqual(["a", "", "b"]);
  });

  it("drops carried backgroundText when re-pasted text reintroduces parentheses (position match)", () => {
    const existing: LyricLine[] = [{ id: "L1", text: "Hello world", agentId: "v1", backgroundText: "ooh" }];
    const result = textToLyricLines("Hello (ooh) world", "v1", existing);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Hello (ooh) world");
    expect(result[0].backgroundText).toBeUndefined();
    expect(result[0].backgroundWords).toBeUndefined();
  });

  it("keeps carried backgroundText when re-pasted text has no parentheses", () => {
    const existing: LyricLine[] = [{ id: "L1", text: "Hello world", agentId: "v1", backgroundText: "ooh" }];
    const result = textToLyricLines("Hello there", "v1", existing);
    expect(result[0].backgroundText).toBe("ooh");
  });

  it("drops carried backgroundText on an exact-text match whose text contains parentheses", () => {
    const existing: LyricLine[] = [{ id: "L1", text: "Hello (ooh) world", agentId: "v1", backgroundText: "ooh" }];
    const result = textToLyricLines("Hello (ooh) world", "v1", existing);
    expect(result[0].id).toBe("L1");
    expect(result[0].text).toBe("Hello (ooh) world");
    expect(result[0].backgroundText).toBeUndefined();
    expect(result[0].backgroundWords).toBeUndefined();
  });

  it("drops carried backgroundWords when re-pasted text reintroduces parentheses", () => {
    const existing: LyricLine[] = [
      {
        id: "L1",
        text: "Hello world",
        agentId: "v1",
        backgroundText: "ooh",
        backgroundWords: [{ text: "ooh", begin: 0, end: 0.5 }],
      },
    ];
    const result = textToLyricLines("Hello (ooh) world", "v1", existing);
    expect(result[0].backgroundText).toBeUndefined();
    expect(result[0].backgroundWords).toBeUndefined();
  });

  it("clears the backgroundTextSource flag when a re-paste reintroduces parentheses", () => {
    const existing: LyricLine[] = [
      {
        id: "L1",
        text: "Hello world",
        agentId: "v1",
        backgroundText: "ooh",
        backgroundWords: [{ text: "ooh", begin: 0, end: 0.5 }],
        backgroundTextSource: "extraction",
      },
    ];
    const result = textToLyricLines("Hello (ooh) world", "v1", existing);
    expect(result[0].backgroundText).toBeUndefined();
    expect(result[0].backgroundWords).toBeUndefined();
    expect(result[0].backgroundTextSource).toBeUndefined();
  });

  it("clears a manual-sourced background flag too on re-paste with parentheses", () => {
    const existing: LyricLine[] = [
      {
        id: "L1",
        text: "Hello world",
        agentId: "v1",
        backgroundText: "ooh",
        backgroundTextSource: "manual",
      },
    ];
    const result = textToLyricLines("Hello (ooh) world", "v1", existing);
    expect(result[0].backgroundTextSource).toBeUndefined();
  });

  it("produces a fresh unmatched line with parentheses without crashing or inventing backgroundText", () => {
    const result = textToLyricLines("Hello (ooh) world\nSecond line", "v1", []);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Hello (ooh) world");
    expect(result[0].backgroundText).toBeUndefined();
    expect(result[0].backgroundWords).toBeUndefined();
  });

  it("re-pasting parenthesised lyrics over an already-extracted line does not double the background text", () => {
    const existing: LyricLine[] = [{ id: "L1", text: "Hello world", agentId: "v1", backgroundText: "ooh" }];
    const reparsed = textToLyricLines("Hello (ooh) world", "v1", existing);
    const extracted = extractBackgroundVocals(reparsed, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(extracted).toHaveLength(1);
    expect(extracted[0].text).toBe("Hello world");
    expect(extracted[0].backgroundText).toBe("ooh");
  });

  it("typo on first instance preserves the second instance's words", () => {
    const existing: LyricLine[] = [
      {
        id: "L1",
        text: "chorus",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [{ text: "chorus", begin: 10, end: 11 }],
      },
      {
        id: "L2",
        text: "chorus",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [{ text: "chorus", begin: 30, end: 31 }],
      },
    ];
    const result = textToLyricLines("choru\nchorus", "v1", existing);
    expect(result[0].id).toBe("L1");
    expect(result[0].text).toBe("choru");
    expect(result[0].words?.length).toBe(1);
    expect(result[0].words?.[0].text).toBe("choru");
    expect(result[0].words?.[0].begin).toBe(10);
    expect(result[1].id).toBe("L2");
    expect(result[1].text).toBe("chorus");
    expect(result[1].words).toEqual(existing[1].words);
  });
});

describe("textToLyricLines · split-character timing preservation", () => {
  it("preserves word timing on untouched split-character lines when a blank line is appended", () => {
    const existing: LyricLine[] = [
      {
        id: "L0",
        text: "Suara hujan",
        agentId: "v1",
        words: [
          { text: "Suara ", begin: 0, end: 0.5 },
          { text: "hujan", begin: 0.5, end: 1 },
        ],
      },
      {
        id: "L1",
        text: "Dengar|lah rindu yang menyik|sa i|ni",
        agentId: "v1",
        words: [
          { text: "Dengar", begin: 1, end: 1.2 },
          { text: "lah ", begin: 1.2, end: 1.4 },
          { text: "rindu ", begin: 1.4, end: 1.6 },
          { text: "yang ", begin: 1.6, end: 1.8 },
          { text: "menyik", begin: 1.8, end: 2 },
          { text: "sa ", begin: 2, end: 2.2 },
          { text: "i", begin: 2.2, end: 2.4 },
          { text: "ni", begin: 2.4, end: 2.6 },
        ],
      },
    ];
    const result = textToLyricLines("Suara hujan\nDengar|lah rindu yang menyik|sa i|ni\n", "v1", existing);
    expect(result).toHaveLength(3);
    expect(result[1].id).toBe("L1");
    expect(result[1].text).toBe("Dengar|lah rindu yang menyik|sa i|ni");
    expect(result[1].words).toEqual(existing[1].words);
  });
});

describe("textToLyricLines · whitespace-normalized matching", () => {
  const doubleSpaced: LyricLine = {
    id: "chorus-1",
    text: "Wish  I  could",
    agentId: "v1",
    words: [
      { text: "Wish  ", begin: 49, end: 50 },
      { text: "I  ", begin: 50, end: 51 },
      { text: "could", begin: 51, end: 52 },
    ],
  };
  const singleSpaced: LyricLine = { id: "chorus-2", text: "Wish I could", agentId: "v1", begin: 116, end: 118 };

  it("regression: a double-spaced line keeps its own id and timing instead of stealing a later duplicate's", () => {
    const result = textToLyricLines("Wish  I  could\nWish I could", "v1", [doubleSpaced, singleSpaced]);
    expect(result.map((l) => l.id)).toEqual(["chorus-1", "chorus-2"]);
    expect(result[0].words?.map((w) => w.begin)).toEqual([49, 50, 51]);
    expect(result[1].begin).toBe(116);
    expect(result[1].end).toBe(118);
  });

  it("regression: editing an unrelated line does not reshuffle duplicate lines", () => {
    const other: LyricLine = { id: "other", text: "Always", agentId: "v1", begin: 1, end: 2 };
    const result = textToLyricLines("Always yeah\nWish  I  could\nWish I could", "v1", [
      other,
      doubleSpaced,
      singleSpaced,
    ]);
    expect(result.map((l) => l.id)).toEqual(["other", "chorus-1", "chorus-2"]);
    expect(result[2].begin).toBe(116);
  });

  describe("edge cases", () => {
    it("matches a line whose stored text has leading or trailing whitespace", () => {
      const padded: LyricLine = { id: "p", text: " Hello  world ", agentId: "v1", begin: 3, end: 4 };
      const result = textToLyricLines("Hello world", "v1", [padded]);
      expect(result[0].id).toBe("p");
      expect(result[0].begin).toBe(3);
    });

    it("still matches duplicates in document order when all are single-spaced", () => {
      const a: LyricLine = { id: "a", text: "la la", agentId: "v1", begin: 1, end: 2 };
      const b: LyricLine = { id: "b", text: "la la", agentId: "v1", begin: 5, end: 6 };
      const result = textToLyricLines("la la\nla la", "v1", [a, b]);
      expect(result.map((l) => l.id)).toEqual(["a", "b"]);
    });
  });
});

describe("textToLyricLines · in-place edits keep row identity", () => {
  it("regression: correcting a line into a later duplicate's text does not steal that duplicate", () => {
    const typo: LyricLine = { id: "typo", text: "Wish I coud", agentId: "v1", begin: 49, end: 52 };
    const middle: LyricLine = { id: "mid", text: "Something else", agentId: "v1", begin: 60, end: 62 };
    const later: LyricLine = { id: "later", text: "Wish I could", agentId: "v1", begin: 116, end: 118 };
    const result = textToLyricLines("Wish I could\nSomething else\nWish I could", "v1", [typo, middle, later]);
    expect(result.map((l) => l.id)).toEqual(["typo", "mid", "later"]);
    expect(result[0].begin).toBe(49);
    expect(result[2].begin).toBe(116);
  });

  it("still follows lines by text when a same-count paste reorders them", () => {
    const a: LyricLine = { id: "a", text: "first", agentId: "v1", begin: 1, end: 2 };
    const b: LyricLine = { id: "b", text: "second", agentId: "v1", begin: 3, end: 4 };
    const result = textToLyricLines("second\nfirst", "v1", [a, b]);
    expect(result.map((l) => l.id)).toEqual(["b", "a"]);
  });

  it("does not claim by position when the line count changed", () => {
    const x1: LyricLine = { id: "x1", text: "X", agentId: "v1", begin: 1, end: 2 };
    const x2: LyricLine = { id: "x2", text: "X", agentId: "v1", begin: 5, end: 6 };
    const y: LyricLine = { id: "y", text: "Y", agentId: "v1", begin: 8, end: 9 };
    const result = textToLyricLines("New\nX\nX\nY", "v1", [x1, x2, y]);
    expect(result.slice(1).map((l) => l.id)).toEqual(["x1", "x2", "y"]);
  });
});
