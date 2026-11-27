import {
  closeShortGaps,
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

  it("regression: keeps every part inside a window too short for the minimum length", () => {
    const window = { begin: 0, end: 0.25 };
    const out = sanitizeIntervals(
      Array.from({ length: 40 }, () => ({ begin: 0, end: 0 })),
      window,
    );
    expect(
      out.every((iv, i) => iv.begin >= 0 && iv.end <= 0.25 && iv.begin <= iv.end && iv.begin >= (out[i - 1]?.end ?? 0)),
    ).toBe(true);
  });

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
  it("gives each part its own interval, keeps the space after each word, and groups a word's syllables", () => {
    const words = groupAlignmentWords(["hel", "lo", "you"], [false, true, false]);
    const timings = timingsFromParts(words, [
      { begin: 1, end: 1.3 },
      { begin: 1.3, end: 1.5 },
      { begin: 2, end: 2.4 },
    ]);
    const group = timings[0].syllableGroupId;
    expect(group).toBeDefined();
    expect(timings).toEqual([
      { text: "hel", begin: 1, end: 1.3, syllableGroupId: group },
      { text: "lo ", begin: 1.3, end: 1.5, syllableGroupId: group },
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

// -- closeShortGaps -----------------------------------------------------------

describe("closeShortGaps", () => {
  // Two lines of a real song as the model timed them, and their ends as hubertfa-posttrain's benchmark of this rule
  // (results/trainv3/smoothing, scripts/smooth_gaps.py) left them. The gaps are 10, 200, 20, 0 and 40 ms, then 60,
  // 10, 130, 10, 10, 0 and 20 ms.
  const LINES = [
    {
      model: [
        [0.407481, 1.057681],
        [1.067409, 1.727408],
        [1.927578, 2.137389],
        [2.157524, 2.287586],
        [2.287586, 2.707463],
        [2.74751, 3.7877],
      ],
      ends: [1.067409, 1.727408, 2.157524, 2.287586, 2.74751, 3.7877],
    },
    {
      model: [
        [0.592626, 0.632501],
        [0.692311, 0.792526],
        [0.802567, 0.832611],
        [0.962518, 1.24245],
        [1.252503, 1.892637],
        [1.902336, 2.072443],
        [2.072443, 2.112513],
        [2.132692, 2.572221],
      ],
      ends: [0.692311, 0.802567, 0.832611, 1.252503, 1.902336, 2.072443, 2.132692, 2.572221],
    },
  ];

  it("ends a word where the next begins when the gap is short, keeps a pause, and never moves a begin", () => {
    for (const { model, ends } of LINES) {
      const words = model.map(([begin, end]) => ({ text: "la ", begin, end }));
      const out = closeShortGaps(words);
      expect(out.map((word) => word.end)).toEqual(ends);
      expect(out.map((word) => word.begin)).toEqual(words.map((word) => word.begin));
      expect(out.map((word) => word.text)).toEqual(words.map((word) => word.text));
    }
  });
});
