/**
 * @vitest-environment node
 */
import { syllablesText } from "@/domain/line/text";
import { computeSyllableGroups, expandSelectionToGroupmates } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";
import { reorderWordTrack } from "./reorder-track";

describe("reorderWordTrack", () => {
  it("keeps three separate words separate when the last word is dragged before the middle word", () => {
    const track: WordTiming[] = [
      { id: "w1", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w2", text: "two", sep: " ", begin: 2, end: 3, joinsNext: false },
      { id: "w3", text: "three", sep: "", begin: 4, end: 5, joinsNext: false },
    ];

    const result = reorderWordTrack(track, new Set([2]), -2.5, { min: 0, max: 10 });

    expect(result).toHaveLength(3);
    expect(computeSyllableGroups(result)).toEqual([]);
    expect(syllablesText(result, "|")).not.toContain("|");
    const three = result.find((w) => w.text.trimEnd() === "three");
    expect(three).toMatchObject({ text: "three", sep: " " });
    expect(result[result.length - 1].sep.endsWith(" ")).toBe(false);
  });

  it("keeps words separate when the first word is dragged to the end", () => {
    const track: WordTiming[] = [
      { id: "w4", text: "alpha", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w5", text: "beta", sep: " ", begin: 2, end: 3, joinsNext: false },
      { id: "w6", text: "gamma", sep: "", begin: 4, end: 5, joinsNext: false },
    ];

    const result = reorderWordTrack(track, new Set([0]), 6, { min: 0, max: 12 });

    expect(result).toHaveLength(3);
    expect(computeSyllableGroups(result)).toEqual([]);
    expect(syllablesText(result, "|")).not.toContain("|");
    expect(result.map((w) => w.text.trimEnd())).toEqual(["beta", "gamma", "alpha"]);
    expect(result[result.length - 1].sep.endsWith(" ")).toBe(false);
  });

  it("keeps spacing correct when a middle word is nudged without changing order", () => {
    const track: WordTiming[] = [
      { id: "w7", text: "first", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w8", text: "second", sep: " ", begin: 2, end: 3, joinsNext: false },
      { id: "w9", text: "third", sep: "", begin: 4, end: 5, joinsNext: false },
    ];

    const result = reorderWordTrack(track, new Set([1]), 0.2, { min: 0, max: 10 });

    expect(result.map((w) => w.text.trimEnd())).toEqual(["first", "second", "third"]);
    expect(computeSyllableGroups(result)).toEqual([]);
    expect(syllablesText(result, "|")).toBe("first second third");
  });

  it("reinserts boundaries for a multi-word dragged set with non-adjacent indices", () => {
    const track: WordTiming[] = [
      { id: "w10", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w11", text: "two", sep: " ", begin: 2, end: 3, joinsNext: false },
      { id: "w12", text: "three", sep: " ", begin: 4, end: 5, joinsNext: false },
      { id: "w13", text: "four", sep: "", begin: 6, end: 7, joinsNext: false },
    ];

    const result = reorderWordTrack(track, new Set([0, 2]), 4, { min: 0, max: 20 });

    expect(result).toHaveLength(4);
    expect(computeSyllableGroups(result)).toEqual([]);
    expect(syllablesText(result, "|")).not.toContain("|");
    expect(result[result.length - 1].sep.endsWith(" ")).toBe(false);
  });

  it("gives the original spaceless last word a trailing space when it lands mid-track", () => {
    const track: WordTiming[] = [
      { id: "w14", text: "head", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w15", text: "body", sep: " ", begin: 5, end: 6, joinsNext: false },
      { id: "w16", text: "tail", sep: "", begin: 8, end: 9, joinsNext: false },
    ];

    const result = reorderWordTrack(track, new Set([2]), -6, { min: 0, max: 12 });

    expect(result).toHaveLength(3);
    expect(syllablesText(result, "|")).not.toContain("|");
    expect(result.map((w) => w.text.trimEnd())).toEqual(["head", "tail", "body"]);
    const tail = result.find((w) => w.text.trimEnd() === "tail");
    expect(tail).toMatchObject({ text: "tail", sep: " " });
    expect(result[result.length - 1].text.trimEnd()).toBe("body");
    expect(result[result.length - 1].sep.endsWith(" ")).toBe(false);
  });

  it("shifts the whole track uniformly when every index is dragged", () => {
    const track: WordTiming[] = [
      { id: "w17", text: "one", sep: " ", begin: 1, end: 2, joinsNext: false },
      { id: "w18", text: "two", sep: " ", begin: 3, end: 4, joinsNext: false },
      { id: "w19", text: "three", sep: "", begin: 5, end: 6, joinsNext: false },
    ];

    const result = reorderWordTrack(track, new Set([0, 1, 2]), 2, { min: 0, max: 20 });

    expect(result.map((w) => w.text + w.sep)).toEqual(["one ", "two ", "three"]);
    expect(result.map((w) => w.begin)).toEqual([3, 5, 7]);
    expect(result.map((w) => w.end)).toEqual([4, 6, 8]);
    expect(computeSyllableGroups(result)).toEqual([]);
  });

  it("preserves the internal syllable structure of a multi-syllable word dragged past another word", () => {
    const track: WordTiming[] = [
      { id: "w20", text: "sun", sep: "", begin: 0, end: 0.5, joinsNext: true },
      { id: "w21", text: "shine", sep: " ", begin: 0.5, end: 1, joinsNext: false },
      { id: "w22", text: "bright", sep: "", begin: 2, end: 3, joinsNext: false },
    ];

    const result = reorderWordTrack(track, new Set([0, 1]), 4, { min: 0, max: 12 });

    const sunIdx = result.findIndex((w) => w.text.trimEnd() === "sun");
    const shineIdx = result.findIndex((w) => w.text.trimEnd() === "shine");
    expect(result[sunIdx].text.endsWith(" ")).toBe(false);
    expect(result[sunIdx].joinsNext).toBe(true);
    const groups = computeSyllableGroups(result);
    expect(groups).toEqual([{ startIndex: sunIdx, endIndex: shineIdx, originalWord: "sunshine" }]);
  });

  it("pushes a later overlapping word forward so the result has no overlap", () => {
    const track: WordTiming[] = [
      { id: "w23", text: "early", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w24", text: "late", sep: "", begin: 8, end: 9, joinsNext: false },
    ];

    const result = reorderWordTrack(track, new Set([1]), -7.5, { min: 0, max: 20 });

    for (let i = 1; i < result.length; i++) {
      expect(result[i].begin).toBeGreaterThanOrEqual(result[i - 1].end);
    }
  });

  it("clamps a word's end to duration when the timeDelta would push it past the end", () => {
    const track: WordTiming[] = [
      { id: "w25", text: "stay", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w26", text: "move", sep: "", begin: 2, end: 3, joinsNext: false },
    ];

    const result = reorderWordTrack(track, new Set([1]), 100, { min: 0, max: 10 });

    const move = result.find((w) => w.text.trimEnd() === "move");
    expect(move?.end).toBeLessThanOrEqual(10);
  });

  it("clamps a word's begin to zero when a negative timeDelta would push it before zero", () => {
    const track: WordTiming[] = [
      { id: "w27", text: "early", sep: " ", begin: 3, end: 4, joinsNext: false },
      { id: "w28", text: "later", sep: "", begin: 6, end: 7, joinsNext: false },
    ];

    const result = reorderWordTrack(track, new Set([0]), -100, { min: 0, max: 10 });

    for (const word of result) {
      expect(word.begin).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps begin non-negative when a single word is longer than the duration", () => {
    const track: WordTiming[] = [{ id: "w29", text: "long", sep: "", begin: 0, end: 100, joinsNext: false }];

    const result = reorderWordTrack(track, new Set([0]), 5, { min: 0, max: 30 });

    expect(result).toHaveLength(1);
    expect(result[0].begin).toBeGreaterThanOrEqual(0);
  });

  it("preserves the explicit flag through the reorder", () => {
    const track: WordTiming[] = [
      { id: "w30", text: "one", sep: " ", begin: 0, end: 1, explicit: true, joinsNext: false },
      { id: "w31", text: "two", sep: "", begin: 2, end: 3, explicit: true, joinsNext: false },
    ];

    const result = reorderWordTrack(track, new Set([1]), -2, { min: 0, max: 10 });

    expect(result.every((w) => w.explicit === true)).toBe(true);
  });
});

describe("reorderWordTrack edge cases and invariants", () => {
  it("returns an empty array for an empty track", () => {
    expect(reorderWordTrack([], new Set([0]), 1, { min: 0, max: 10 })).toEqual([]);
  });

  it("returns a single word for a single-word track that is dragged", () => {
    const track: WordTiming[] = [{ id: "w32", text: "solo", sep: "", begin: 1, end: 2, joinsNext: false }];

    const result = reorderWordTrack(track, new Set([0]), 2, { min: 0, max: 20 });

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("solo");
  });

  it("does not mutate the input track or its word objects", () => {
    const track: WordTiming[] = [
      { id: "w33", text: "one", sep: " ", begin: 0, end: 1, joinsNext: true },
      { id: "w34", text: "two", sep: " ", begin: 2, end: 3, joinsNext: false },
      { id: "w35", text: "three", sep: "", begin: 4, end: 5, joinsNext: false },
    ];
    const trackBefore = track.map((w) => ({ ...w }));

    reorderWordTrack(track, new Set([2]), -3, { min: 0, max: 10 });

    expect(track).toEqual(trackBefore);
  });

  it("returns the track unchanged in shape when no indices are dragged", () => {
    const track: WordTiming[] = [
      { id: "w36", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w37", text: "two", sep: "", begin: 2, end: 3, joinsNext: false },
    ];

    const result = reorderWordTrack(track, new Set(), 5, { min: 0, max: 10 });

    expect(result.map((w) => w.text + w.sep)).toEqual(["one ", "two"]);
    expect(result.map((w) => w.begin)).toEqual([0, 2]);
  });

  it("returns words sorted by begin after a reorder", () => {
    const track: WordTiming[] = [
      { id: "w38", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w39", text: "two", sep: " ", begin: 2, end: 3, joinsNext: false },
      { id: "w40", text: "three", sep: "", begin: 4, end: 5, joinsNext: false },
    ];

    const result = reorderWordTrack(track, new Set([0]), 5, { min: 0, max: 12 });

    const begins = result.map((w) => w.begin);
    expect(begins).toEqual([...begins].toSorted((a, b) => a - b));
  });

  it("keeps groupmates joined after the move", () => {
    const track: WordTiming[] = [
      { id: "w41", text: "ti", sep: "", begin: 0, end: 0.4, joinsNext: true },
      { id: "w42", text: "tle", sep: " ", begin: 0.4, end: 0.8, joinsNext: false },
      { id: "w43", text: "next", sep: "", begin: 2, end: 3, joinsNext: false },
    ];

    const result = reorderWordTrack(track, new Set([0, 1]), 4, { min: 0, max: 12 });

    const tiIdx = result.findIndex((w) => w.text.trimEnd() === "ti");
    const tleIdx = result.findIndex((w) => w.text.trimEnd() === "tle");
    expect(computeSyllableGroups(result)).toMatchObject([{ startIndex: tiIdx, endIndex: tleIdx }]);
  });

  it("ignores dragged indices that fall outside the track", () => {
    const track: WordTiming[] = [
      { id: "w44", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w45", text: "two", sep: "", begin: 2, end: 3, joinsNext: false },
    ];

    const result = reorderWordTrack(track, new Set([5, 9]), 4, { min: 0, max: 10 });

    expect(result.map((w) => w.text + w.sep)).toEqual(["one ", "two"]);
    expect(result.map((w) => w.begin)).toEqual([0, 2]);
  });

  it("spaces every seam when a dragged block interleaves with the rest on a timing collision", () => {
    const track: WordTiming[] = [
      { id: "w46", text: "hel", sep: " ", begin: 0, end: 0.5, joinsNext: false },
      { id: "w47", text: "lo", sep: " ", begin: 0.5, end: 1, joinsNext: false },
      { id: "w48", text: "sun", sep: " ", begin: 2, end: 2.5, joinsNext: false },
      { id: "w49", text: "shine", sep: "", begin: 2.5, end: 3, joinsNext: false },
    ];

    const result = reorderWordTrack(track, new Set([2, 3]), -2, { min: 0, max: 12 });

    expect(result).toHaveLength(4);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].sep.endsWith(" ")).toBe(true);
    }
    expect(result[result.length - 1].sep.endsWith(" ")).toBe(false);
    expect(computeSyllableGroups(result)).toEqual([]);
    expect(syllablesText(result, "|")).not.toContain("|");
  });
});

describe("regressions: T9 syllable drag past a neighbor", () => {
  const track: WordTiming[] = [
    { id: "w50", text: "Hel", sep: "", begin: 0, end: 0.25, joinsNext: true },
    { id: "w51", text: "lo", sep: " ", begin: 0.25, end: 0.5, joinsNext: false },
    { id: "w52", text: "there", sep: "", begin: 0.5, end: 1.0, joinsNext: false },
  ];

  it("a drag of 'lo' moves its groupmate 'Hel' too (expandSelectionToGroupmates)", () => {
    expect([...expandSelectionToGroupmates(track, [1])].toSorted()).toEqual([0, 1]);
  });

  it("the dragged syllable group stays contiguous when it partially overlaps 'there'", () => {
    const result = reorderWordTrack(track, new Set([0, 1]), 0.3, { min: 0, max: 10 });
    const order = result.map((w) => w.text.trim());
    expect(order).toEqual(["Hel", "lo", "there"]);
  });

  it("the whole group jumps as one block once it is past 'there'", () => {
    const result = reorderWordTrack(track, new Set([0, 1]), 0.9, { min: 0, max: 10 });
    expect(syllablesText(result, "|")).toBe("there Hel|lo");
  });
});
