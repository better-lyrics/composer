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
      { id: "w1", text: "Hello", sep: " ", begin: 0, end: 0.5 },
      { id: "w2", text: "world", sep: "", begin: 0.5, end: 1 },
    ];
    const incoming: WordTiming[] = [
      { id: "w3", text: "foo", sep: " ", begin: 1.2, end: 1.6 },
      { id: "w4", text: "bar", sep: "", begin: 1.6, end: 2 },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["Hello ", "world ", "foo ", "bar"]);
    const groups = computeSyllableGroups(result);
    expect(groups.some((g) => g.startIndex <= 1 && g.endIndex >= 2)).toBe(false);
  });

  it("preserves a genuine multi-syllable existing last word while closing it off from incoming content", () => {
    const existing: WordTiming[] = [
      { id: "w5", text: "ti", sep: "", begin: 0, end: 0.4 },
      { id: "w6", text: "tle", sep: "", begin: 0.4, end: 0.8 },
    ];
    const incoming: WordTiming[] = [{ id: "w7", text: "foo", sep: "", begin: 1, end: 1.4 }];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["ti", "tle ", "foo"]);
    const groups = computeSyllableGroups(result);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ startIndex: 0, endIndex: 1, originalWord: "title" });
  });

  it("inserts a boundary when incoming words land before the existing words", () => {
    const existing: WordTiming[] = [{ id: "w8", text: "world", sep: "", begin: 2, end: 2.5 }];
    const incoming: WordTiming[] = [
      { id: "w9", text: "Hello", sep: " ", begin: 0, end: 0.5 },
      { id: "w10", text: "there", sep: "", begin: 0.5, end: 1 },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["Hello ", "there ", "world"]);
    const groups = computeSyllableGroups(result);
    expect(groups.some((g) => g.startIndex <= 1 && g.endIndex >= 2)).toBe(false);
  });

  it("does not double-add a space when the seam word already ends with one", () => {
    const existing: WordTiming[] = [
      { id: "w11", text: "a", sep: " ", begin: 0, end: 0.3 },
      { id: "w12", text: "b", sep: " ", begin: 0.3, end: 0.6 },
    ];
    const incoming: WordTiming[] = [{ id: "w13", text: "c", sep: "", begin: 1, end: 1.3 }];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["a ", "b ", "c"]);
  });

  it("regenerates incoming syllableGroupId values so they cannot merge into an existing group at the seam", () => {
    const existing: WordTiming[] = [
      { id: "w14", text: "ti", sep: "", begin: 0, end: 0.4, syllableGroupId: "shared" },
      { id: "w15", text: "tle", sep: "", begin: 0.4, end: 0.8, syllableGroupId: "shared" },
    ];
    const incoming: WordTiming[] = [
      { id: "w16", text: "po", sep: "", begin: 1, end: 1.4, syllableGroupId: "shared" },
      { id: "w17", text: "em", sep: "", begin: 1.4, end: 1.8, syllableGroupId: "shared" },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result[1].syllableGroupId).toBe("shared");
    expect(result[2].syllableGroupId).not.toBe("shared");
    expect(result[2].syllableGroupId).toBe(result[3].syllableGroupId);
    const groups = computeSyllableGroups(result);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ startIndex: 0, endIndex: 1 });
    expect(groups[1]).toMatchObject({ startIndex: 2, endIndex: 3 });
  });

  it("adds the seam space in syllableGroupId mode so reconstructed text keeps the word boundary", () => {
    const existing: WordTiming[] = [
      { id: "w18", text: "ti", sep: "", begin: 0, end: 0.4, syllableGroupId: "a" },
      { id: "w19", text: "tle", sep: "", begin: 0.4, end: 0.8, syllableGroupId: "a" },
    ];
    const incoming: WordTiming[] = [
      { id: "w20", text: "po", sep: "", begin: 1, end: 1.4, syllableGroupId: "b" },
      { id: "w21", text: "em", sep: "", begin: 1.4, end: 1.8, syllableGroupId: "b" },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["ti", "tle ", "po", "em"]);
    expect(reconstructLineText(result, "|")).toBe("ti|tle po|em");
  });

  it("inserts boundaries on both sides when incoming words land in a gap between existing words", () => {
    const existing: WordTiming[] = [
      { id: "w22", text: "Hello", sep: " ", begin: 0, end: 0.5 },
      { id: "w23", text: "world", sep: "", begin: 3, end: 3.5 },
    ];
    const incoming: WordTiming[] = [
      { id: "w24", text: "very", sep: " ", begin: 1, end: 1.4 },
      { id: "w25", text: "big", sep: "", begin: 1.5, end: 1.9 },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["Hello ", "very ", "big ", "world"]);
    expect(reconstructLineText(result, "|")).toBe("Hello very big world");
  });

  it("keeps the incoming batch's own syllable structure intact, spacing only the seam", () => {
    const existing: WordTiming[] = [
      { id: "w26", text: "Hello", sep: " ", begin: 0, end: 0.5 },
      { id: "w27", text: "world", sep: "", begin: 0.5, end: 1 },
    ];
    const incoming: WordTiming[] = [
      { id: "w28", text: "sun", sep: "", begin: 1.2, end: 1.5 },
      { id: "w29", text: "shine", sep: "", begin: 1.5, end: 1.9 },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["Hello ", "world ", "sun", "shine"]);
    expect(reconstructLineText(result, "|")).toBe("Hello world sun|shine");
    expect(computeSyllableGroups(result)).toEqual([{ startIndex: 2, endIndex: 3, originalWord: "sunshine" }]);
  });

  it("preserves word fields such as explicit through the merge and seam-spacing", () => {
    const existing: WordTiming[] = [{ id: "w30", text: "last", sep: "", begin: 0, end: 0.5, explicit: true }];
    const incoming: WordTiming[] = [{ id: "w31", text: "next", sep: "", begin: 1, end: 1.4, explicit: true }];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["last ", "next"]);
    expect(result[0].explicit).toBe(true);
    expect(result[1].explicit).toBe(true);
  });

  it("returns the existing array unchanged when there is nothing to merge", () => {
    const existing: WordTiming[] = [{ id: "w32", text: "word", sep: "", begin: 0, end: 1 }];
    expect(mergeWordsIntoTrack(existing, [])).toBe(existing);
  });

  it("returns incoming words with fresh group ids when the track has no existing words", () => {
    const incoming: WordTiming[] = [
      { id: "w33", text: "new", sep: "", begin: 0, end: 0.5, syllableGroupId: "g" },
      { id: "w34", text: "er", sep: "", begin: 0.5, end: 1, syllableGroupId: "g" },
    ];

    const result = mergeWordsIntoTrack([], incoming);

    expect(result.map((w) => w.text)).toEqual(["new", "er"]);
    expect(result[0].syllableGroupId).not.toBe("g");
    expect(result[0].syllableGroupId).toBe(result[1].syllableGroupId);
  });

  it("trims the trailing space off the final merged word", () => {
    const existing: WordTiming[] = [{ id: "w35", text: "a", sep: "", begin: 0, end: 0.5 }];
    const incoming: WordTiming[] = [
      { id: "w36", text: "b", sep: " ", begin: 1, end: 1.4 },
      { id: "w37", text: "c", sep: " ", begin: 1.4, end: 1.8 },
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
      [{ id: "w38", text: "a", sep: "", begin: 0, end: 1 }],
      [{ id: "w39", text: "b", sep: "", begin: 2, end: 3 }],
    );
    expect(result.map((w) => w.text + w.sep)).toEqual(["a ", "b"]);
  });

  it("does not mutate the existing or incoming arrays or their word objects", () => {
    const existing: WordTiming[] = [{ id: "w40", text: "world", sep: "", begin: 1, end: 1.5 }];
    const incoming: WordTiming[] = [{ id: "w41", text: "foo", sep: "", begin: 2, end: 2.5, syllableGroupId: "g" }];
    const existingBefore = existing.map((w) => ({ ...w }));
    const incomingBefore = incoming.map((w) => ({ ...w }));

    mergeWordsIntoTrack(existing, incoming);

    expect(existing).toEqual(existingBefore);
    expect(incoming).toEqual(incomingBefore);
  });

  it("returns words sorted by begin even when the incoming batch is unsorted", () => {
    const existing: WordTiming[] = [{ id: "w42", text: "mid", sep: " ", begin: 5, end: 5.5 }];
    const incoming: WordTiming[] = [
      { id: "w43", text: "late", sep: "", begin: 9, end: 9.5 },
      { id: "w44", text: "early", sep: " ", begin: 1, end: 1.5 },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["early ", "mid ", "late"]);
    const begins = result.map((w) => w.begin);
    expect(begins).toEqual([...begins].toSorted((a, b) => a - b));
  });

  it("spaces every seam when existing and incoming words fully interleave", () => {
    const existing: WordTiming[] = [
      { id: "w45", text: "one", sep: "", begin: 0, end: 0.5 },
      { id: "w46", text: "three", sep: "", begin: 2, end: 2.5 },
    ];
    const incoming: WordTiming[] = [
      { id: "w47", text: "two", sep: "", begin: 1, end: 1.5 },
      { id: "w48", text: "four", sep: "", begin: 3, end: 3.5 },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["one ", "two ", "three ", "four"]);
    expect(computeSyllableGroups(result)).toEqual([]);
  });

  it("maps each distinct incoming syllable group to its own fresh id", () => {
    const incoming: WordTiming[] = [
      { id: "w49", text: "ti", sep: "", begin: 0, end: 0.4, syllableGroupId: "g1" },
      { id: "w50", text: "tle", sep: " ", begin: 0.4, end: 0.8, syllableGroupId: "g1" },
      { id: "w51", text: "po", sep: "", begin: 0.8, end: 1.2, syllableGroupId: "g2" },
      { id: "w52", text: "em", sep: "", begin: 1.2, end: 1.6, syllableGroupId: "g2" },
    ];

    const result = mergeWordsIntoTrack([], incoming);

    expect(result[0].syllableGroupId).toBe(result[1].syllableGroupId);
    expect(result[2].syllableGroupId).toBe(result[3].syllableGroupId);
    expect(result[0].syllableGroupId).not.toBe(result[2].syllableGroupId);
    expect(result[0].syllableGroupId).not.toBe("g1");
    expect(result[2].syllableGroupId).not.toBe("g2");
    expect(computeSyllableGroups(result)).toHaveLength(2);
  });

  it("regenerates defined incoming ids and leaves undefined ones untouched", () => {
    const incoming: WordTiming[] = [
      { id: "w53", text: "grouped", sep: " ", begin: 0, end: 0.5, syllableGroupId: "g" },
      { id: "w54", text: "plain", sep: "", begin: 0.5, end: 1 },
    ];

    const result = mergeWordsIntoTrack([], incoming);

    expect(result[0].syllableGroupId).toBeDefined();
    expect(result[0].syllableGroupId).not.toBe("g");
    expect(result[1].syllableGroupId).toBeUndefined();
  });

  it("preserves explicit when an incoming word's group id is regenerated", () => {
    const incoming: WordTiming[] = [
      { id: "w55", text: "ex", sep: "", begin: 0, end: 0.4, syllableGroupId: "g", explicit: true },
      { id: "w56", text: "plicit", sep: "", begin: 0.4, end: 0.8, syllableGroupId: "g", explicit: true },
    ];

    const result = mergeWordsIntoTrack([], incoming);

    expect(result[0].explicit).toBe(true);
    expect(result[1].explicit).toBe(true);
    expect(result[0].syllableGroupId).not.toBe("g");
  });

  it("trims a trailing space off the final word even when it comes from the existing track", () => {
    const existing: WordTiming[] = [{ id: "w57", text: "tail", sep: " ", begin: 5, end: 5.5 }];
    const incoming: WordTiming[] = [{ id: "w58", text: "head", sep: " ", begin: 1, end: 1.5 }];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["head ", "tail"]);
  });

  it("preserves the internal syllable structure of both tracks while spacing the seam", () => {
    const existing: WordTiming[] = [
      { id: "w59", text: "ti", sep: "", begin: 0, end: 0.3 },
      { id: "w60", text: "tle", sep: "", begin: 0.3, end: 0.6 },
    ];
    const incoming: WordTiming[] = [
      { id: "w61", text: "po", sep: "", begin: 1, end: 1.3 },
      { id: "w62", text: "em", sep: "", begin: 1.3, end: 1.6 },
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
    const existing: WordTiming[] = [{ id: "w63", text: "before", sep: "", begin: 0, end: 1 }];
    const incoming: WordTiming[] = [{ id: "w64", text: "after", sep: "", begin: 1, end: 2 }];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["before ", "after"]);
  });

  it("trims the final incoming word and still spaces the seam before it", () => {
    const existing: WordTiming[] = [{ id: "w65", text: "head", sep: "", begin: 0, end: 0.5 }];
    const incoming: WordTiming[] = [{ id: "w66", text: "tail", sep: " ", begin: 1, end: 1.5 }];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["head ", "tail"]);
  });

  it("never spaces an existing internal syllable joint when incoming words bracket it", () => {
    const existing: WordTiming[] = [
      { id: "w67", text: "ti", sep: "", begin: 1, end: 1.4 },
      { id: "w68", text: "tle", sep: "", begin: 1.4, end: 1.8 },
    ];
    const incoming: WordTiming[] = [
      { id: "w69", text: "before", sep: " ", begin: 0, end: 0.5 },
      { id: "w70", text: "after", sep: "", begin: 3, end: 3.5 },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.map((w) => w.text + w.sep)).toEqual(["before ", "ti", "tle ", "after"]);
    expect(computeSyllableGroups(result)).toEqual([{ startIndex: 1, endIndex: 2, originalWord: "title" }]);
  });

  it("never injects syllableGroupId into a trailing-space track so the spaces fallback stays active", () => {
    const existing: WordTiming[] = [
      { id: "w71", text: "Hello", sep: " ", begin: 0, end: 0.5 },
      { id: "w72", text: "wor", sep: "", begin: 0.5, end: 0.75 },
      { id: "w73", text: "ld", sep: "", begin: 0.75, end: 1 },
    ];
    const incoming: WordTiming[] = [
      { id: "w74", text: "sun", sep: "", begin: 1.2, end: 1.5 },
      { id: "w75", text: "shine", sep: "", begin: 1.5, end: 1.9 },
    ];

    const result = mergeWordsIntoTrack(existing, incoming);

    expect(result.every((w) => w.syllableGroupId === undefined)).toBe(true);
    expect(computeSyllableGroups(result)).toEqual([
      { startIndex: 1, endIndex: 2, originalWord: "world" },
      { startIndex: 3, endIndex: 4, originalWord: "sunshine" },
    ]);
  });
});

describe("mergeWordsIntoTrack syllable groups", () => {
  const incoming: WordTiming[] = [
    { id: "w76", text: "Hel", sep: "", begin: 0.3, end: 0.55, syllableGroupId: "g1" },
    { id: "w77", text: "lo", sep: "", begin: 0.55, end: 0.8, syllableGroupId: "g1" },
  ];
  const existing: WordTiming[] = [{ id: "w78", text: "there", sep: "", begin: 0.5, end: 1.0 }];

  it("regression T9: sorts an overlapping syllable group by its first begin", () => {
    const result = mergeWordsIntoTrack(existing, incoming);
    expect(result.map((w) => w.text.trim())).toEqual(["Hel", "lo", "there"]);
  });

  it("invariant: a syllable group stays contiguous in the result", () => {
    const result = mergeWordsIntoTrack(existing, incoming);
    const groupId = result[0].syllableGroupId;
    const positions = result.flatMap((w, i) => (groupId !== undefined && w.syllableGroupId === groupId ? [i] : []));
    expect(positions).toEqual([0, 1]);
  });

  it("keeps a group's internal order even when a later syllable begins first", () => {
    const outOfOrder: WordTiming[] = [
      { id: "w79", text: "a", sep: "", begin: 2, end: 2.5, syllableGroupId: "g2" },
      { id: "w80", text: "b", sep: "", begin: 1.9, end: 2.2, syllableGroupId: "g2" },
    ];
    const result = mergeWordsIntoTrack([{ id: "w81", text: "x", sep: "", begin: 0, end: 1 }], outOfOrder);
    expect(result.map((w) => w.text.trim())).toEqual(["x", "a", "b"]);
  });

  it("an id-less trailing-space group is not atomic, so an incoming word in its gap splits it", () => {
    const existing: WordTiming[] = [
      { id: "w82", text: "ti", sep: "", begin: 1, end: 1.4 },
      { id: "w83", text: "tle", sep: "", begin: 2, end: 2.4 },
    ];
    const result = mergeWordsIntoTrack(existing, [{ id: "w84", text: "x", sep: "", begin: 1.5, end: 1.8 }]);
    expect(result.map((w) => w.text + w.sep)).toEqual(["ti ", "x ", "tle"]);
  });
});
