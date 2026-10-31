import { readAlignedTimings, timingChanged, timingFingerprint } from "@/domain/alignment/fingerprint";
import { alignmentReview } from "@/domain/alignment/review-state";
import type { LyricLine } from "@/domain/line/model";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function alignedLine(id: string, offset: number): LyricLine {
  return createLine({
    id,
    text: "Is this the real life?",
    words: [
      { text: "Is ", begin: 12.41 + offset, end: 12.77 + offset },
      { text: "this ", begin: 12.77 + offset, end: 13.02 + offset },
      { text: "the ", begin: 13.02 + offset, end: 13.39 + offset },
      { text: "real ", begin: 13.39 + offset, end: 14.11 + offset },
      { text: "life?", begin: 14.11 + offset, end: 15.88 + offset },
    ],
  });
}

function fingerprintsOf(lines: LyricLine[]): Record<string, string> {
  return Object.fromEntries(lines.map((line) => [line.id, timingFingerprint(line)]));
}

function nudged(line: LyricLine, by: number): LyricLine {
  const [first, ...rest] = line.words ?? [];
  return createLine({ id: line.id, text: line.text, words: [{ ...first, begin: first.begin + by }, ...rest] });
}

const SONG = Array.from({ length: 8 }, (_, i) => alignedLine(`L${i + 1}`, i * 4));

// -- alignmentReview ----------------------------------------------------------

describe("alignmentReview", () => {
  it("is untouched when every timed line still has its aligned timing", () => {
    const review = alignmentReview(SONG, fingerprintsOf(SONG));
    expect(review).toEqual({ tier: "untouched", untouchedCount: 8, timedCount: 8, firstUntouchedLineId: "L1" });
  });

  it("is mostly untouched while 75% or more of timed lines are unchanged", () => {
    const edited = SONG.map((line, i) => (i < 2 ? nudged(line, 0.05) : line));
    const review = alignmentReview(edited, fingerprintsOf(SONG));
    expect(review.tier).toBe("mostly-untouched");
    expect(review.untouchedCount).toBe(6);
    expect(review.firstUntouchedLineId).toBe("L3");
  });

  it("is reviewed once fewer than 75% of timed lines are unchanged", () => {
    const edited = SONG.map((line, i) => (i < 3 ? nudged(line, 0.05) : line));
    expect(alignmentReview(edited, fingerprintsOf(SONG)).tier).toBe("reviewed");
  });

  it("counts lines Auto-align never touched as reviewed lines", () => {
    const tapped = createLine({ id: "T1", text: "Caught in a landslide", begin: 50, end: 52 });
    const review = alignmentReview([...SONG, tapped], fingerprintsOf(SONG));
    expect(review).toMatchObject({ tier: "mostly-untouched", untouchedCount: 8, timedCount: 9 });
  });

  it("ignores text and metadata changes", () => {
    const retexted = SONG.map((line) => ({ ...line, agentId: "v2", backgroundText: "ooh" }));
    expect(alignmentReview(retexted, fingerprintsOf(SONG)).tier).toBe("untouched");
  });

  it("counts a background vocal timing edit as review", () => {
    const withBackground = SONG.map((line) =>
      createLine({
        ...line,
        words: line.words,
        backgroundText: "ooh",
        backgroundWords: [{ text: "ooh", begin: 15, end: 15.5 }],
      }),
    );
    const edited = withBackground.map((line, i) =>
      i < 3 ? { ...line, backgroundWords: [{ text: "ooh", begin: 15.1, end: 15.5 }] } : line,
    );
    expect(alignmentReview(edited, fingerprintsOf(withBackground)).tier).toBe("reviewed");
  });

  it("is reviewed after the alignment is undone", () => {
    const beforeAlign = SONG.map((line) => nudged(line, -0.2));
    expect(alignmentReview(beforeAlign, fingerprintsOf(SONG)).tier).toBe("reviewed");
  });

  describe("edge cases", () => {
    it("is reviewed when no line is timed", () => {
      const untimed = [createLine({ id: "U1", text: "Open your eyes" })];
      expect(alignmentReview(untimed, {})).toEqual({
        tier: "reviewed",
        untouchedCount: 0,
        timedCount: 0,
        firstUntouchedLineId: null,
      });
    });

    it("ignores fingerprints of deleted lines", () => {
      const fingerprints = { ...fingerprintsOf(SONG), gone: "0.000-1.000" };
      expect(alignmentReview(SONG, fingerprints).tier).toBe("untouched");
    });
  });
});

// -- timingChanged ------------------------------------------------------------

describe("timingChanged", () => {
  it("is true only when the timing differs", () => {
    const line = SONG[0];
    expect(timingChanged(line, nudged(line, 0.1))).toBe(true);
    expect(timingChanged(undefined, line)).toBe(false);
  });

  it("regression: a linked sibling replaced with the same timing is not recorded as aligned", () => {
    const line = SONG[0];
    expect(timingChanged(line, { ...line, text: "Is this the real life?" })).toBe(false);
  });
});

// -- readAlignedTimings -------------------------------------------------------

describe("readAlignedTimings", () => {
  it("keeps string entries and drops everything else", () => {
    expect(readAlignedTimings({ L1: "1.000-2.000", L2: 4, L3: null })).toEqual({ L1: "1.000-2.000" });
  });

  it("reads a missing or malformed record as empty", () => {
    expect(readAlignedTimings(undefined)).toEqual({});
    expect(readAlignedTimings("nope")).toEqual({});
    expect(readAlignedTimings([1, 2])).toEqual({});
  });
});
