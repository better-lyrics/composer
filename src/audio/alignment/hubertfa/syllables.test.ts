// @vitest-environment node
import {
  type TimedPhone,
  noticeableSplit,
  spellingSyllables,
  syllableIntervals,
} from "@/audio/alignment/hubertfa/syllables";
import { describe, expect, it } from "vitest";

function timed(spec: string): TimedPhone[] {
  return spec.split(" ").map((entry) => {
    const [phone, begin, end] = entry.split(":");
    return { phone, begin: Number(begin), end: Number(end) };
  });
}

// "hello" with a long held "o": the second syllable starts well before the word's midpoint.
const HELLO = timed("hh:0:0.1 eh:0.1:0.3 l:0.3:0.4 ow:0.4:1");

describe("syllableIntervals", () => {
  it("times each spelled syllable from the phones it covers", () => {
    expect(syllableIntervals(["hel", "lo"], HELLO)).toEqual([
      { begin: 0, end: 0.4 },
      { begin: 0.4, end: 1 },
    ]);
  });

  it("gives up when the syllables don't match the sung vowels", () => {
    expect(syllableIntervals(["he", "l", "lo"], HELLO)).toBeNull();
  });
});

describe("spellingSyllables", () => {
  it("splits between vowel groups, keeping sounds written with two letters together", () => {
    expect(spellingSyllables("hello", 2)).toEqual([3]);
    expect(spellingSyllables("baby", 2)).toEqual([2]);
    expect(spellingSyllables("singer", 2)).toEqual([4]);
  });

  it("doesn't split a word whose spelling and vowels disagree", () => {
    expect(spellingSyllables("make", 1)).toBeNull();
    expect(spellingSyllables("create", 2)).toBeNull();
  });
});

describe("noticeableSplit", () => {
  it("splits a word only when its syllables would visibly move", () => {
    expect(noticeableSplit("hello", HELLO)).toEqual({
      at: [3],
      intervals: [
        { begin: 0, end: 0.4 },
        { begin: 0.4, end: 1 },
      ],
    });
    expect(noticeableSplit("hello", timed("hh:0:0.15 eh:0.15:0.5 l:0.5:0.6 ow:0.6:1"))).toBeNull();
  });
});
