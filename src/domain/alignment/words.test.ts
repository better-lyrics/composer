import {
  groupAlignmentWords,
  groupTimedWords,
  retimeWords,
  sanitizeIntervals,
  timingsFromParts,
} from "@/domain/alignment/words";
import { describe, expect, it } from "vitest";

// -- groupAlignmentWords ------------------------------------------------------

describe("groupAlignmentWords", () => {
  it("joins syllable parts back into the words they belong to", () => {
    const words = groupAlignmentWords(["hel", "lo", "there"], [false, true, false]);
    expect(words).toEqual([
      { text: "hello", parts: ["hel", "lo"], trailingSpace: true },
      { text: "there", parts: ["there"], trailingSpace: false },
    ]);
  });

  it("returns nothing for an empty line", () => {
    expect(groupAlignmentWords([], [])).toEqual([]);
  });
});

// -- sanitizeIntervals --------------------------------------------------------

describe("sanitizeIntervals", () => {
  const bounds = { begin: 10, end: 12 };

  it("keeps clean intervals as they are", () => {
    const clean = [
      { begin: 10.2, end: 10.6 },
      { begin: 10.7, end: 11.5 },
    ];
    expect(sanitizeIntervals(clean, bounds)).toEqual(clean);
  });

  it("removes overlaps by ending a word where the next begins", () => {
    const out = sanitizeIntervals(
      [
        { begin: 10, end: 11 },
        { begin: 10.5, end: 11.5 },
      ],
      bounds,
    );
    expect(out[0].end).toBe(10.5);
    expect(out[1].begin).toBe(10.5);
  });

  it("clamps into the window and gives zero-length words a usable duration", () => {
    const out = sanitizeIntervals(
      [
        { begin: 9, end: 9 },
        { begin: 11, end: 11 },
        { begin: 13, end: 14 },
      ],
      bounds,
    );
    for (let i = 0; i < out.length; i++) {
      expect(out[i].begin).toBeGreaterThanOrEqual(bounds.begin);
      expect(out[i].end).toBeLessThanOrEqual(bounds.end + 1e-9);
      expect(out[i].end).toBeGreaterThan(out[i].begin);
      if (i > 0) expect(out[i].begin).toBeGreaterThanOrEqual(out[i - 1].end);
    }
  });
});

// -- timingsFromParts / retimeWords --------------------------------------------

describe("timingsFromParts", () => {
  it("gives each part its own interval and keeps the space after each word", () => {
    const words = groupAlignmentWords(["hel", "lo", "you"], [false, true, false]);
    const timings = timingsFromParts(words, [
      { begin: 1, end: 1.3 },
      { begin: 1.3, end: 1.5 },
      { begin: 2, end: 2.4 },
    ]);
    expect(timings).toEqual([
      { text: "hel", begin: 1, end: 1.3 },
      { text: "lo ", begin: 1.3, end: 1.5 },
      { text: "you", begin: 2, end: 2.4 },
    ]);
  });

  it("splits unspaced Chinese and Japanese into one part per character", () => {
    const words = groupAlignmentWords(["我爱你", "君と"], [true, false]);
    expect(words.map((w) => w.parts)).toEqual([
      ["我", "爱", "你"],
      ["君", "と"],
    ]);
  });
});

describe("retimeWords", () => {
  it("keeps every part's metadata and only changes its times", () => {
    const existing = [
      { text: "hel", begin: 0, end: 1, transliteration: "x" },
      { text: "lo ", begin: 1, end: 2 },
      { text: "you", begin: 2, end: 3 },
    ];
    expect(groupTimedWords(existing).map((w) => w.text)).toEqual(["hello", "you"]);
    const retimed = retimeWords(existing, [
      { begin: 5, end: 5.3 },
      { begin: 5.3, end: 5.5 },
      { begin: 6, end: 6.3 },
    ]);
    expect(retimed.map((w) => [w.text, w.begin, w.end])).toEqual([
      ["hel", 5, 5.3],
      ["lo ", 5.3, 5.5],
      ["you", 6, 6.3],
    ]);
    expect(retimed[0].transliteration).toBe("x");
  });
});
