/**
 * @vitest-environment node
 */
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import { computeSyllableGroups } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";
import { mergeWordsIntoTrack } from "./merge-track";

describe("mergeWordsIntoTrack", () => {
  it("inserts a word boundary so an incoming word after the last existing word is not grouped with it", () => {
    const existing: WordTiming[] = [
      { id: "w1", text: "Hello", sep: " ", begin: 0, end: 0.5, joinsNext: false },
      { id: "w2", text: "world", sep: "", begin: 0.5, end: 1, joinsNext: false },
    ];
    const incoming: WordTiming[] = [
      { id: "w3", text: "foo", sep: " ", begin: 1.2, end: 1.6, joinsNext: false },
      { id: "w4", text: "bar", sep: "", begin: 1.6, end: 2, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["Hello ", "world ", "foo ", "bar"]);
    const groups = computeSyllableGroups(result);
    expect(groups.some((g) => g.startIndex <= 1 && g.endIndex >= 2)).toBe(false);
  });

  it("preserves a genuine multi-syllable existing last word while closing it off from incoming content", () => {
    const existing: WordTiming[] = [
      { id: "w5", text: "ti", sep: "", begin: 0, end: 0.4, joinsNext: true },
      { id: "w6", text: "tle", sep: "", begin: 0.4, end: 0.8, joinsNext: false },
    ];
    const incoming: WordTiming[] = [{ id: "w7", text: "foo", sep: "", begin: 1, end: 1.4, joinsNext: false }];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["ti", "tle ", "foo"]);
    const groups = computeSyllableGroups(result);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ startIndex: 0, endIndex: 1, originalWord: "title" });
  });

  it("inserts a boundary when incoming words land before the existing words", () => {
    const existing: WordTiming[] = [{ id: "w8", text: "world", sep: "", begin: 2, end: 2.5, joinsNext: false }];
    const incoming: WordTiming[] = [
      { id: "w9", text: "Hello", sep: " ", begin: 0, end: 0.5, joinsNext: false },
      { id: "w10", text: "there", sep: "", begin: 0.5, end: 1, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["Hello ", "there ", "world"]);
    const groups = computeSyllableGroups(result);
    expect(groups.some((g) => g.startIndex <= 1 && g.endIndex >= 2)).toBe(false);
  });

  it("does not double-add a space when the seam word already ends with one", () => {
    const existing: WordTiming[] = [
      { id: "w11", text: "a", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w12", text: "b", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
    ];
    const incoming: WordTiming[] = [{ id: "w13", text: "c", sep: "", begin: 1, end: 1.3, joinsNext: false }];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["a ", "b ", "c"]);
  });

  it("keeps incoming syllables from joining an existing group at the seam", () => {
    const existing: WordTiming[] = [
      { id: "w14", text: "ti", sep: "", begin: 0, end: 0.4, joinsNext: true },
      { id: "w15", text: "tle", sep: "", begin: 0.4, end: 0.8, joinsNext: true },
    ];
    const incoming: WordTiming[] = [
      { id: "w16", text: "po", sep: "", begin: 1, end: 1.4, joinsNext: true },
      { id: "w17", text: "em", sep: "", begin: 1.4, end: 1.8, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result[1].joinsNext).toBe(false);
    const groups = computeSyllableGroups(result);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ startIndex: 0, endIndex: 1 });
    expect(groups[1]).toMatchObject({ startIndex: 2, endIndex: 3 });
  });

  it("adds the seam space between id-grouped tracks so reconstructed text keeps the word boundary", () => {
    const existing: WordTiming[] = [
      { id: "w18", text: "ti", sep: "", begin: 0, end: 0.4, joinsNext: true },
      { id: "w19", text: "tle", sep: "", begin: 0.4, end: 0.8, joinsNext: false },
    ];
    const incoming: WordTiming[] = [
      { id: "w20", text: "po", sep: "", begin: 1, end: 1.4, joinsNext: true },
      { id: "w21", text: "em", sep: "", begin: 1.4, end: 1.8, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["ti", "tle ", "po", "em"]);
    expect(reconstructLineText(result, "|")).toBe("ti|tle po|em");
  });

  it("inserts boundaries on both sides when incoming words land in a gap between existing words", () => {
    const existing: WordTiming[] = [
      { id: "w22", text: "Hello", sep: " ", begin: 0, end: 0.5, joinsNext: false },
      { id: "w23", text: "world", sep: "", begin: 3, end: 3.5, joinsNext: false },
    ];
    const incoming: WordTiming[] = [
      { id: "w24", text: "very", sep: " ", begin: 1, end: 1.4, joinsNext: false },
      { id: "w25", text: "big", sep: "", begin: 1.5, end: 1.9, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["Hello ", "very ", "big ", "world"]);
    expect(reconstructLineText(result, "|")).toBe("Hello very big world");
  });

  it("keeps the incoming batch's own syllable structure intact, spacing only the seam", () => {
    const existing: WordTiming[] = [
      { id: "w26", text: "Hello", sep: " ", begin: 0, end: 0.5, joinsNext: false },
      { id: "w27", text: "world", sep: "", begin: 0.5, end: 1, joinsNext: false },
    ];
    const incoming: WordTiming[] = [
      { id: "w28", text: "sun", sep: "", begin: 1.2, end: 1.5, joinsNext: true },
      { id: "w29", text: "shine", sep: "", begin: 1.5, end: 1.9, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["Hello ", "world ", "sun", "shine"]);
    expect(reconstructLineText(result, "|")).toBe("Hello world sun|shine");
    expect(computeSyllableGroups(result)).toEqual([{ startIndex: 2, endIndex: 3, originalWord: "sunshine" }]);
  });

  it("preserves word fields such as explicit through the merge and seam-spacing", () => {
    const existing: WordTiming[] = [
      { id: "w30", text: "last", sep: "", begin: 0, end: 0.5, explicit: true, joinsNext: false },
    ];
    const incoming: WordTiming[] = [
      { id: "w31", text: "next", sep: "", begin: 1, end: 1.4, explicit: true, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["last ", "next"]);
    expect(result[0].explicit).toBe(true);
    expect(result[1].explicit).toBe(true);
  });

  it("returns the existing array unchanged when there is nothing to merge", () => {
    const existing: WordTiming[] = [{ id: "w32", text: "word", sep: "", begin: 0, end: 1, joinsNext: false }];
    expect(mergeWordsIntoTrack(existing, [])).toBe(existing);
  });

  it("returns incoming words with their joins when the track has no existing words", () => {
    const incoming: WordTiming[] = [
      { id: "w33", text: "new", sep: "", begin: 0, end: 0.5, joinsNext: true },
      { id: "w34", text: "er", sep: "", begin: 0.5, end: 1, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack([], incoming);

    expect(result.map((w) => w.text)).toEqual(["new", "er"]);
    expect(result.map((w) => w.joinsNext)).toEqual([true, false]);
  });

  it("trims the trailing space off the final merged word", () => {
    const existing: WordTiming[] = [{ id: "w35", text: "a", sep: "", begin: 0, end: 0.5, joinsNext: false }];
    const incoming: WordTiming[] = [
      { id: "w36", text: "b", sep: " ", begin: 1, end: 1.4, joinsNext: false },
      { id: "w37", text: "c", sep: " ", begin: 1.4, end: 1.8, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["a ", "b ", "c"]);
  });
});

describe("mergeWordsIntoTrack edge cases and invariants", () => {
  it("returns an empty array when both tracks are empty", () => {
    expect(mergeWordsIntoTrack([], [])).toEqual([]);
  });

  it("spaces the seam for the minimal single-word case", () => {
    const result = mergeWordsIntoTrack(
      [{ id: "w38", text: "a", sep: "", begin: 0, end: 1, joinsNext: false }],
      [{ id: "w39", text: "b", sep: "", begin: 2, end: 3, joinsNext: false }],
    );
    expect(result.map((w) => w.text + w.sep)).toEqual(["a ", "b"]);
  });

  it("does not mutate the existing or incoming arrays or their word objects", () => {
    const existing: WordTiming[] = [{ id: "w40", text: "world", sep: "", begin: 1, end: 1.5, joinsNext: false }];
    const incoming: WordTiming[] = [{ id: "w41", text: "foo", sep: "", begin: 2, end: 2.5, joinsNext: false }];
    const existingBefore = existing.map((w) => ({ ...w }));
    const incomingBefore = incoming.map((w) => ({ ...w }));

    mergeWordsIntoTrack(existing, incoming);

    expect(existing).toEqual(existingBefore);
    expect(incoming).toEqual(incomingBefore);
  });

  it("returns words sorted by begin even when the incoming batch is unsorted", () => {
    const existing: WordTiming[] = [{ id: "w42", text: "mid", sep: " ", begin: 5, end: 5.5, joinsNext: false }];
    const incoming: WordTiming[] = [
      { id: "w43", text: "late", sep: "", begin: 9, end: 9.5, joinsNext: false },
      { id: "w44", text: "early", sep: " ", begin: 1, end: 1.5, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["early ", "mid ", "late"]);
    const begins = result.map((w) => w.begin);
    expect(begins).toEqual([...begins].toSorted((a, b) => a - b));
  });

  it("spaces every seam when existing and incoming words fully interleave", () => {
    const existing: WordTiming[] = [
      { id: "w45", text: "one", sep: "", begin: 0, end: 0.5, joinsNext: false },
      { id: "w46", text: "three", sep: "", begin: 2, end: 2.5, joinsNext: false },
    ];
    const incoming: WordTiming[] = [
      { id: "w47", text: "two", sep: "", begin: 1, end: 1.5, joinsNext: false },
      { id: "w48", text: "four", sep: "", begin: 3, end: 3.5, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["one ", "two ", "three ", "four"]);
    expect(computeSyllableGroups(result)).toEqual([]);
  });

  it("keeps each distinct incoming syllable group apart", () => {
    const incoming: WordTiming[] = [
      { id: "w49", text: "ti", sep: "", begin: 0, end: 0.4, joinsNext: true },
      { id: "w50", text: "tle", sep: " ", begin: 0.4, end: 0.8, joinsNext: false },
      { id: "w51", text: "po", sep: "", begin: 0.8, end: 1.2, joinsNext: true },
      { id: "w52", text: "em", sep: "", begin: 1.2, end: 1.6, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack([], incoming);

    expect(computeSyllableGroups(result)).toMatchObject([
      { startIndex: 0, endIndex: 1 },
      { startIndex: 2, endIndex: 3 },
    ]);
  });

  it("keeps a lone incoming word apart from the next one", () => {
    const incoming: WordTiming[] = [
      { id: "w53", text: "grouped", sep: " ", begin: 0, end: 0.5, joinsNext: false },
      { id: "w54", text: "plain", sep: "", begin: 0.5, end: 1, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack([], incoming);

    expect(result.map((w) => w.joinsNext)).toEqual([false, false]);
    expect(computeSyllableGroups(result)).toEqual([]);
  });

  it("preserves explicit on incoming syllables", () => {
    const incoming: WordTiming[] = [
      { id: "w55", text: "ex", sep: "", begin: 0, end: 0.4, explicit: true, joinsNext: true },
      { id: "w56", text: "plicit", sep: "", begin: 0.4, end: 0.8, explicit: true, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack([], incoming);

    expect(result[0].explicit).toBe(true);
    expect(result[1].explicit).toBe(true);
    expect(result.map((w) => w.joinsNext)).toEqual([true, false]);
  });

  it("trims a trailing space off the final word even when it comes from the existing track", () => {
    const existing: WordTiming[] = [{ id: "w57", text: "tail", sep: " ", begin: 5, end: 5.5, joinsNext: false }];
    const incoming: WordTiming[] = [{ id: "w58", text: "head", sep: " ", begin: 1, end: 1.5, joinsNext: false }];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["head ", "tail"]);
  });

  it("preserves the internal syllable structure of both tracks while spacing the seam", () => {
    const existing: WordTiming[] = [
      { id: "w59", text: "ti", sep: "", begin: 0, end: 0.3, joinsNext: true },
      { id: "w60", text: "tle", sep: "", begin: 0.3, end: 0.6, joinsNext: false },
    ];
    const incoming: WordTiming[] = [
      { id: "w61", text: "po", sep: "", begin: 1, end: 1.3, joinsNext: true },
      { id: "w62", text: "em", sep: "", begin: 1.3, end: 1.6, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["ti", "tle ", "po", "em"]);
    expect(reconstructLineText(result, "|")).toBe("ti|tle po|em");
    expect(computeSyllableGroups(result)).toEqual([
      { startIndex: 0, endIndex: 1, originalWord: "title" },
      { startIndex: 2, endIndex: 3, originalWord: "poem" },
    ]);
  });

  it("spaces the seam when an incoming word is exactly time-adjacent to an existing word", () => {
    const existing: WordTiming[] = [{ id: "w63", text: "before", sep: "", begin: 0, end: 1, joinsNext: false }];
    const incoming: WordTiming[] = [{ id: "w64", text: "after", sep: "", begin: 1, end: 2, joinsNext: false }];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["before ", "after"]);
  });

  it("trims the final incoming word and still spaces the seam before it", () => {
    const existing: WordTiming[] = [{ id: "w65", text: "head", sep: "", begin: 0, end: 0.5, joinsNext: false }];
    const incoming: WordTiming[] = [{ id: "w66", text: "tail", sep: " ", begin: 1, end: 1.5, joinsNext: false }];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["head ", "tail"]);
  });

  it("never spaces an existing internal syllable joint when incoming words bracket it", () => {
    const existing: WordTiming[] = [
      { id: "w67", text: "ti", sep: "", begin: 1, end: 1.4, joinsNext: true },
      { id: "w68", text: "tle", sep: "", begin: 1.4, end: 1.8, joinsNext: false },
    ];
    const incoming: WordTiming[] = [
      { id: "w69", text: "before", sep: " ", begin: 0, end: 0.5, joinsNext: false },
      { id: "w70", text: "after", sep: "", begin: 3, end: 3.5, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["before ", "ti", "tle ", "after"]);
    expect(computeSyllableGroups(result)).toEqual([{ startIndex: 1, endIndex: 2, originalWord: "title" }]);
  });

  it("keeps the word groups of a trailing-space track", () => {
    const existing: WordTiming[] = [
      { id: "w71", text: "Hello", sep: " ", begin: 0, end: 0.5, joinsNext: false },
      { id: "w72", text: "wor", sep: "", begin: 0.5, end: 0.75, joinsNext: true },
      { id: "w73", text: "ld", sep: "", begin: 0.75, end: 1, joinsNext: false },
    ];
    const incoming: WordTiming[] = [
      { id: "w74", text: "sun", sep: "", begin: 1.2, end: 1.5, joinsNext: true },
      { id: "w75", text: "shine", sep: "", begin: 1.5, end: 1.9, joinsNext: false },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(computeSyllableGroups(result)).toEqual([
      { startIndex: 1, endIndex: 2, originalWord: "world" },
      { startIndex: 3, endIndex: 4, originalWord: "sunshine" },
    ]);
  });
});

describe("mergeWordsIntoTrack syllable groups", () => {
  const incoming: WordTiming[] = [
    { id: "w76", text: "Hel", sep: "", begin: 0.3, end: 0.55, joinsNext: true },
    { id: "w77", text: "lo", sep: "", begin: 0.55, end: 0.8, joinsNext: false },
  ];
  const existing: WordTiming[] = [{ id: "w78", text: "there", sep: "", begin: 0.5, end: 1.0, joinsNext: false }];

  it("regression T9: sorts an overlapping syllable group by its first begin", () => {
    const result = mergeWordsIntoTrack(existing, incoming);
    expect(result.map((w) => w.text.trim())).toEqual(["Hel", "lo", "there"]);
  });

  it("invariant: a syllable group stays contiguous in the result", () => {
    const result = mergeWordsIntoTrack(existing, incoming);
    expect(computeSyllableGroups(result)).toMatchObject([{ startIndex: 0, endIndex: 1 }]);
  });

  it("keeps a group's internal order even when a later syllable begins first", () => {
    const outOfOrder: WordTiming[] = [
      { id: "w79", text: "a", sep: "", begin: 2, end: 2.5, joinsNext: true },
      { id: "w80", text: "b", sep: "", begin: 1.9, end: 2.2, joinsNext: false },
    ];
    const result = mergeWordsIntoTrack(
      [{ id: "w81", text: "x", sep: "", begin: 0, end: 1, joinsNext: false }],
      outOfOrder,
    );
    expect(result.map((w) => w.text.trim())).toEqual(["x", "a", "b"]);
  });

  it("keeps time order: an incoming word in a joined group's gap splits it and ends the word before", () => {
    const existing: WordTiming[] = [
      { id: "w82", text: "ti", sep: "", begin: 1, end: 1.4, joinsNext: true },
      { id: "w83", text: "tle", sep: "", begin: 2, end: 2.4, joinsNext: false },
    ];
    const result = mergeWordsIntoTrack(existing, [
      { id: "w84", text: "x", sep: "", begin: 1.5, end: 1.8, joinsNext: false },
    ]);
    expect(result.map((w) => w.text + w.sep)).toEqual(["ti ", "x ", "tle"]);
    expect(result.map((w) => w.joinsNext)).toEqual([false, false, false]);
  });

  it("keeps time order: an existing word in an incoming group's gap splits it and ends the word before", () => {
    const result = mergeWordsIntoTrack(
      [{ id: "w85", text: "m", sep: "", begin: 1.5, end: 1.8, joinsNext: false }],
      [
        { id: "w86", text: "ti", sep: "", begin: 1, end: 1.4, joinsNext: true },
        { id: "w87", text: "tle", sep: "", begin: 2, end: 2.4, joinsNext: false },
      ],
    );
    expect(result.map((w) => w.text + w.sep)).toEqual(["ti ", "m ", "tle"]);
    expect(result.map((w) => w.joinsNext)).toEqual([false, false, false]);
  });

  it("keeps time order: an incoming word that begins inside a joined syllable lands after that syllable", () => {
    const result = mergeWordsIntoTrack(
      [
        { id: "w88", text: "ti", sep: "", begin: 0, end: 1, joinsNext: true },
        { id: "w89", text: "tle", sep: "", begin: 2, end: 3, joinsNext: false },
      ],
      [{ id: "w90", text: "x", sep: "", begin: 0.5, end: 0.8, joinsNext: false }],
    );
    expect(result.map((w) => w.text + w.sep)).toEqual(["ti ", "x ", "tle"]);
    expect(result.map((w) => w.joinsNext)).toEqual([false, false, false]);
  });
});
