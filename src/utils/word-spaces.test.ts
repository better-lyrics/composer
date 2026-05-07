/**
 * @vitest-environment node
 */
import type { WordTiming } from "@/stores/project";
import { findInsertionSlot, normalizeTrailingSpaces, resolveOverlapsForward } from "@/utils/word-spaces";
import { describe, expect, it } from "vitest";

// -- normalizeTrailingSpaces ---------------------------------------------------

describe("normalizeTrailingSpaces", () => {
  it("returns empty array as-is", () => {
    expect(normalizeTrailingSpaces([])).toEqual([]);
  });

  it("trims trailing space from the last word", () => {
    const result = normalizeTrailingSpaces([{ text: "hello ", begin: 0, end: 1 }]);
    expect(result[0].text).toBe("hello");
  });

  it("leaves a single word without trailing space alone", () => {
    const result = normalizeTrailingSpaces([{ text: "hello", begin: 0, end: 1 }]);
    expect(result[0].text).toBe("hello");
  });

  it("adds trailing space to non-last words missing one", () => {
    const result = normalizeTrailingSpaces([
      { text: "he", begin: 0, end: 0.5 },
      { text: "llo", begin: 0.5, end: 1 },
    ]);
    expect(result[0].text).toBe("he ");
    expect(result[1].text).toBe("llo");
  });

  it("preserves intentional trailing spaces on non-last words", () => {
    const result = normalizeTrailingSpaces([
      { text: "hello ", begin: 0, end: 1 },
      { text: "world", begin: 1, end: 2 },
    ]);
    expect(result[0].text).toBe("hello ");
    expect(result[1].text).toBe("world");
  });

  it("trims a trailing space that drifted onto the last word", () => {
    const result = normalizeTrailingSpaces([
      { text: "hello ", begin: 0, end: 1 },
      { text: "world ", begin: 1, end: 2 },
    ]);
    expect(result[0].text).toBe("hello ");
    expect(result[1].text).toBe("world");
  });
});

// -- resolveOverlapsForward ----------------------------------------------------

describe("resolveOverlapsForward", () => {
  it("returns empty array as-is", () => {
    expect(resolveOverlapsForward([], 10)).toEqual([]);
  });

  it("leaves non-overlapping words alone", () => {
    const words: WordTiming[] = [
      { text: "a", begin: 0, end: 1 },
      { text: "b", begin: 2, end: 3 },
    ];
    expect(resolveOverlapsForward(words, 10)).toEqual(words);
  });

  it("pushes a single overlapping word forward", () => {
    const result = resolveOverlapsForward(
      [
        { text: "a", begin: 0, end: 2 },
        { text: "b", begin: 1, end: 3 },
      ],
      10,
    );
    expect(result[0]).toEqual({ text: "a", begin: 0, end: 2 });
    expect(result[1]).toEqual({ text: "b", begin: 2, end: 4 });
  });

  it("cascades pushes through multiple overlaps", () => {
    const result = resolveOverlapsForward(
      [
        { text: "a", begin: 0, end: 2 },
        { text: "b", begin: 1, end: 3 },
        { text: "c", begin: 2, end: 4 },
      ],
      20,
    );
    expect(result[1].begin).toBe(2);
    expect(result[1].end).toBe(4);
    expect(result[2].begin).toBe(4);
    expect(result[2].end).toBe(6);
  });

  it("clamps the last word to duration while preserving its duration", () => {
    const result = resolveOverlapsForward(
      [
        { text: "a", begin: 0, end: 1 },
        { text: "b", begin: 8, end: 11 },
      ],
      10,
    );
    expect(result[1].end).toBe(10);
    expect(result[1].begin).toBe(7);
  });
});

// -- findInsertionSlot ---------------------------------------------------------

describe("findInsertionSlot", () => {
  it("centers a word in an empty track", () => {
    const slot = findInsertionSlot([], 5, 1, 10);
    expect(slot).toEqual({ begin: 4.5, end: 5.5 });
  });

  it("centers in an open gap between words", () => {
    const words: WordTiming[] = [
      { text: "a", begin: 0, end: 1 },
      { text: "b", begin: 5, end: 6 },
    ];
    const slot = findInsertionSlot(words, 3, 1, 10);
    expect(slot).toEqual({ begin: 2.5, end: 3.5 });
  });

  it("snaps right against the previous word when the click is near it", () => {
    const words: WordTiming[] = [
      { text: "a", begin: 0, end: 2 },
      { text: "b", begin: 5, end: 6 },
    ];
    const slot = findInsertionSlot(words, 2.1, 1, 10);
    expect(slot?.begin).toBe(2);
    expect(slot?.end).toBe(3);
  });

  it("snaps left against the next word when the click is near it", () => {
    const words: WordTiming[] = [
      { text: "a", begin: 0, end: 1 },
      { text: "b", begin: 5, end: 6 },
    ];
    const slot = findInsertionSlot(words, 4.9, 1, 10);
    expect(slot?.end).toBe(5);
    expect(slot?.begin).toBe(4);
  });

  it("shrinks the new word to the gap when desired duration does not fit", () => {
    const words: WordTiming[] = [
      { text: "a", begin: 0, end: 2 },
      { text: "b", begin: 2.6, end: 5 },
    ];
    const slot = findInsertionSlot(words, 2.3, 1, 10);
    expect(slot).toEqual({ begin: 2, end: 2.6 });
  });

  it("returns null when the gap is smaller than minDuration", () => {
    const words: WordTiming[] = [
      { text: "a", begin: 0, end: 2 },
      { text: "b", begin: 2.02, end: 5 },
    ];
    expect(findInsertionSlot(words, 2.01, 1, 10, 0.05)).toBeNull();
  });

  it("snaps to the next gap when click lands inside an existing word", () => {
    const words: WordTiming[] = [
      { text: "a", begin: 0, end: 2 },
      { text: "b", begin: 5, end: 6 },
    ];
    const slot = findInsertionSlot(words, 1, 1, 10);
    expect(slot?.begin).toBe(2);
    expect(slot?.end).toBeLessThanOrEqual(5);
  });

  it("clamps to audioDuration when click is past the last word", () => {
    const words: WordTiming[] = [{ text: "a", begin: 0, end: 8 }];
    const slot = findInsertionSlot(words, 9.9, 1, 10);
    expect(slot?.end).toBe(10);
    expect(slot?.begin).toBe(9);
  });

  it("returns null when there is no room past the last word", () => {
    const words: WordTiming[] = [{ text: "a", begin: 0, end: 9.99 }];
    expect(findInsertionSlot(words, 9.995, 1, 10, 0.05)).toBeNull();
  });
});
