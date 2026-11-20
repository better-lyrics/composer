import { describe, expect, it } from "vitest";
import { mainBounds } from "@/domain/line/bounds";
import { lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
import { mainTrack, roleWords, timedSyllables } from "@/domain/line/track";
import type { WordTiming } from "@/domain/word/timing";
import { shiftAllTimings } from "@/lib/priming-migration";

// -- Helpers ------------------------------------------------------------------

function lineSynced(id: string, begin: number, end: number): LyricLine {
  return lineFromFields({ id, text: "x", agentId: "a", begin, end });
}

function wordSynced(id: string, words: WordTiming[]): LyricLine {
  return lineFromFields({ id, text: words.map((w) => w.text).join(" "), agentId: "a", words });
}

// -- Tests --------------------------------------------------------------------

describe("shiftAllTimings", () => {
  it("moves line begin and end earlier for a negative shift", () => {
    const out = shiftAllTimings([lineSynced("L", 1.0, 2.0)], -0.5);
    const line = mainBounds(out[0])!;
    expect(line.begin).toBeCloseTo(0.5);
    expect(line.end).toBeCloseTo(1.5);
  });

  it("moves every word begin and end earlier for a negative shift", () => {
    const out = shiftAllTimings(
      [
        wordSynced("L", [
          { id: "w1", text: "hi", sep: "", begin: 1.0, end: 1.5, joinsNext: true },
          { id: "w2", text: "you", sep: "", begin: 1.5, end: 2.0, joinsNext: false },
        ]),
      ],
      -0.5,
    );
    const words = roleWords(out[0], "main")!;
    expect(words[0].begin).toBeCloseTo(0.5);
    expect(words[0].end).toBeCloseTo(1.0);
    expect(words[1].begin).toBeCloseTo(1.0);
    expect(words[1].end).toBeCloseTo(1.5);
  });

  it("moves background words earlier for a negative shift", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "L",
        text: "main",
        agentId: "a",
        words: [{ id: "w3", text: "main", sep: "", begin: 1.0, end: 2.0, joinsNext: false }],
        backgroundText: "bg",
        backgroundWords: [{ id: "w4", text: "bg", sep: "", begin: 1.2, end: 1.8, joinsNext: false }],
      }),
    ];
    const out = shiftAllTimings(lines, -0.5);
    const bg = roleWords(out[0], "bg")!;
    expect(bg[0].begin).toBeCloseTo(0.7);
    expect(bg[0].end).toBeCloseTo(1.3);
  });

  it("leaves untimed lines untouched", () => {
    const lines: LyricLine[] = [lineFromFields({ id: "L", text: "no timing", agentId: "a" })];
    const out = shiftAllTimings(lines, -0.5);
    expect(out[0]).toEqual(lines[0]);
  });

  it("is a no-op for shift = 0", () => {
    const lines = [lineSynced("L", 1.0, 2.0)];
    const out = shiftAllTimings(lines, 0);
    expect(out).toEqual(lines);
  });

  it("preserves WordTiming extras like explicit and joinsNext", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "L",
        text: "x",
        agentId: "a",
        words: [{ id: "w5", text: "x", sep: "", begin: 1.0, end: 1.5, explicit: true, joinsNext: true }],
      }),
    ];
    const shifted = shiftAllTimings(lines, -0.5);
    const w = roleWords(shifted[0], "main")![0];
    expect(w.explicit).toBe(true);
    expect(w.joinsNext).toBe(true);
    expect(w.begin).toBeCloseTo(0.5);
    expect(w.end).toBeCloseTo(1.0);
  });

  it("preserves background word extras", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "L",
        text: "main",
        agentId: "a",
        backgroundText: "bg",
        backgroundWords: [{ id: "w6", text: "bg", sep: "", begin: 1.0, end: 1.5, explicit: true, joinsNext: true }],
      }),
    ];
    const out = shiftAllTimings(lines, -0.5);
    const bg = roleWords(out[0], "bg")![0];
    expect(bg.explicit).toBe(true);
    expect(bg.joinsNext).toBe(true);
    expect(bg.begin).toBeCloseTo(0.5);
  });

  it("preserves LineFields like agentId, text, groupId, instanceIdx across all variants", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "wsl",
        text: "hi",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 2,
        templateLineIdx: 0,
        words: [{ id: "w7", text: "hi", sep: "", begin: 1.0, end: 1.5, joinsNext: false }],
      }),
      lineFromFields({
        id: "lsl",
        text: "world",
        agentId: "v2",
        groupId: "g2",
        instanceIdx: 1,
        begin: 2.0,
        end: 3.0,
      }),
    ];
    const out = shiftAllTimings(lines, -0.5);
    expect(mainTrack(out[0]).agentId).toBe("v1");
    expect(out[0].groupId).toBe("g1");
    expect(out[0].instanceIdx).toBe(2);
    expect(out[0].templateLineIdx).toBe(0);
    expect(lineText(out[0])).toBe("hi");
    expect(mainTrack(out[1]).agentId).toBe("v2");
    expect(out[1].groupId).toBe("g2");
    expect(out[1].instanceIdx).toBe(1);
  });
});

describe("shiftAllTimings: edge cases", () => {
  it("clamps negative line timings to 0", () => {
    const out = shiftAllTimings([lineSynced("L", 0.1, 0.4)], -0.5);
    const line = mainBounds(out[0])!;
    expect(line.begin).toBe(0);
    expect(line.end).toBe(0);
  });

  it("clamps negative word timings to 0", () => {
    const out = shiftAllTimings(
      [
        wordSynced("L", [
          { id: "w8", text: "early", sep: "", begin: 0.1, end: 0.2, joinsNext: true },
          { id: "w9", text: "later", sep: "", begin: 0.6, end: 1.0, joinsNext: false },
        ]),
      ],
      -0.5,
    );
    const words = roleWords(out[0], "main")!;
    expect(words[0].begin).toBe(0);
    expect(words[0].end).toBe(0);
    expect(words[1].begin).toBeCloseTo(0.1);
    expect(words[1].end).toBeCloseTo(0.5);
  });

  it("clamps negative background word timings to 0", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "L",
        text: "main",
        agentId: "a",
        backgroundText: "bg",
        backgroundWords: [{ id: "w10", text: "bg", sep: "", begin: 0.1, end: 0.3, joinsNext: false }],
      }),
    ];
    const out = shiftAllTimings(lines, -0.5);
    const bg = roleWords(out[0], "bg")![0];
    expect(bg.begin).toBe(0);
    expect(bg.end).toBe(0);
  });

  it("handles an empty lines array", () => {
    const out = shiftAllTimings([], -0.5);
    expect(out).toEqual([]);
  });

  it("handles a word-synced line with no words", () => {
    const lines: LyricLine[] = [lineFromFields({ id: "L", text: "", agentId: "a", words: [] })];
    const out = shiftAllTimings(lines, -0.5);
    expect(timedSyllables(mainTrack(out[0]))).toEqual([]);
  });
});

describe("shiftAllTimings: invariants", () => {
  it("does not mutate the input array or its elements", () => {
    const lines: LyricLine[] = [
      lineSynced("L1", 1.0, 2.0),
      wordSynced("L2", [{ id: "w11", text: "x", sep: "", begin: 1.0, end: 1.5, joinsNext: false }]),
      lineFromFields({
        id: "L3",
        text: "main",
        agentId: "a",
        backgroundText: "bg",
        backgroundWords: [{ id: "w12", text: "bg", sep: "", begin: 1.0, end: 1.5, joinsNext: false }],
      }),
    ];
    const snapshot = JSON.parse(JSON.stringify(lines));
    shiftAllTimings(lines, -0.5);
    expect(JSON.parse(JSON.stringify(lines))).toEqual(snapshot);
  });

  it("returns the same length output", () => {
    const lines: LyricLine[] = [
      lineSynced("L1", 1.0, 2.0),
      lineFromFields({ id: "L2", text: "untimed", agentId: "a" }),
      wordSynced("L3", [{ id: "w13", text: "x", sep: "", begin: 1.0, end: 1.5, joinsNext: false }]),
    ];
    const out = shiftAllTimings(lines, -0.5);
    expect(out.length).toBe(lines.length);
  });

  it("preserves line ids and order", () => {
    const lines: LyricLine[] = [lineSynced("L1", 1.0, 2.0), lineSynced("L2", 3.0, 4.0), lineSynced("L3", 5.0, 6.0)];
    const out = shiftAllTimings(lines, -0.5);
    expect(out.map((l) => l.id)).toEqual(["L1", "L2", "L3"]);
  });

  it("returns the same reference when shift is 0 (no-op fast path)", () => {
    const lines = [lineSynced("L", 1.0, 2.0)];
    const out = shiftAllTimings(lines, 0);
    expect(out).toBe(lines);
  });
});

describe("shiftAllTimings: positive shifts", () => {
  it("moves line, word and background timings later with no upper clamp", () => {
    const lines: LyricLine[] = [
      lineSynced("L1", 1, 2),
      lineFromFields({
        id: "L2",
        text: "a",
        agentId: "a",
        words: [{ id: "w14", text: "a", sep: "", begin: 3, end: 4, joinsNext: false }],
        backgroundText: "b",
        backgroundWords: [{ id: "w15", text: "b", sep: "", begin: 3.5, end: 3.9, joinsNext: false }],
      }),
    ];
    const out = shiftAllTimings(lines, 0.025);
    const line = mainBounds(out[0])!;
    expect(line.begin).toBeCloseTo(1.025, 9);
    expect(line.end).toBeCloseTo(2.025, 9);
    expect(roleWords(out[1], "main")![0].begin).toBeCloseTo(3.025, 9);
    expect(roleWords(out[1], "bg")![0].end).toBeCloseTo(3.925, 9);
  });
});
