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

  it("regression: leaves a word whole when its first or last syllable would last a few frames", () => {
    // "a|gain" with 40 ms for the "a", and "bet|ter" with 40 ms for the "ter": against tapped syllables, the phones
    // place such a boundary right far less often than an even split does (hubertfa-posttrain results/trainv3/syl_split).
    expect(noticeableSplit("again", timed("ax:0:0.04 g:0.04:0.1 eh:0.1:0.6 n:0.6:0.77"))).toBeNull();
    expect(noticeableSplit("better", timed("b:0:0.1 eh:0.1:0.5 t:0.5:0.56 er:0.56:0.6"))).toBeNull();
  });
});
