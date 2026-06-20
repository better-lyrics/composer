import { describe, expect, it } from "vitest";
import { mainBounds } from "@/domain/line/bounds";
import { reconcileLine } from "@/domain/line/model";
import type { LyricLine } from "@/domain/line/model";
import { bgWords, lineText, mainWords } from "@/domain/line/voices";
import { shiftAllTimings } from "@/lib/priming-migration";
import type { WordTiming } from "@/domain/word/timing";

// -- Helpers ------------------------------------------------------------------

function lineSynced(id: string, begin: number, end: number): LyricLine {
  return reconcileLine({ id, text: "x", agentId: "a", begin, end });
}

function wordSynced(id: string, words: WordTiming[]): LyricLine {
  return reconcileLine({ id, text: words.map((w) => w.text).join(" "), agentId: "a", words });
}

// -- Tests --------------------------------------------------------------------

describe("shiftAllTimings", () => {
  it("subtracts the shift from line begin and end", () => {
    const out = shiftAllTimings([lineSynced("L", 1.0, 2.0)], 0.5);
    const bounds = mainBounds(out[0]);
    expect(bounds?.begin).toBeCloseTo(0.5);
    expect(bounds?.end).toBeCloseTo(1.5);
  });

  it("subtracts the shift from every word begin and end", () => {
    const out = shiftAllTimings(
      [
        wordSynced("L", [
          { text: "hi", begin: 1.0, end: 1.5 },
          { text: "you", begin: 1.5, end: 2.0 },
        ]),
      ],
      0.5,
    );
    const words = mainWords(out[0]) ?? [];
    expect(words[0].begin).toBeCloseTo(0.5);
    expect(words[0].end).toBeCloseTo(1.0);
    expect(words[1].begin).toBeCloseTo(1.0);
    expect(words[1].end).toBeCloseTo(1.5);
  });

  it("subtracts the shift from background words", () => {
    const lines: LyricLine[] = [
      reconcileLine({
        id: "L",
        text: "main",
        agentId: "a",
        words: [{ text: "main", begin: 1.0, end: 2.0 }],
        backgroundText: "bg",
        backgroundWords: [{ text: "bg", begin: 1.2, end: 1.8 }],
      }),
    ];
    const out = shiftAllTimings(lines, 0.5);
    const bg = bgWords(out[0]) ?? [];
    expect(bg[0].begin).toBeCloseTo(0.7);
    expect(bg[0].end).toBeCloseTo(1.3);
  });

  it("leaves untimed lines untouched", () => {
    const lines: LyricLine[] = [reconcileLine({ id: "L", text: "no timing", agentId: "a" })];
    const out = shiftAllTimings(lines, 0.5);
    expect(out[0]).toEqual(lines[0]);
  });

  it("is a no-op for shift = 0", () => {
    const lines = [lineSynced("L", 1.0, 2.0)];
    const out = shiftAllTimings(lines, 0);
    expect(out).toEqual(lines);
  });

  it("preserves WordTiming extras like explicit and syllableGroupId", () => {
    const lines: LyricLine[] = [
      reconcileLine({
        id: "L",
        text: "x",
        agentId: "a",
        words: [{ text: "x", begin: 1.0, end: 1.5, explicit: true, syllableGroupId: "g1" }],
      }),
    ];
    const shifted = shiftAllTimings(lines, 0.5);
    const w = (mainWords(shifted[0]) ?? [])[0];
    expect(w.explicit).toBe(true);
    expect(w.syllableGroupId).toBe("g1");
    expect(w.begin).toBeCloseTo(0.5);
    expect(w.end).toBeCloseTo(1.0);
  });

  it("preserves background word extras", () => {
    const lines: LyricLine[] = [
      reconcileLine({
        id: "L",
        text: "main",
        agentId: "a",
        backgroundText: "bg",
        backgroundWords: [{ text: "bg", begin: 1.0, end: 1.5, explicit: true, syllableGroupId: "g2" }],
      }),
    ];
    const out = shiftAllTimings(lines, 0.5);
    const bg = (bgWords(out[0]) ?? [])[0];
    expect(bg.explicit).toBe(true);
    expect(bg.syllableGroupId).toBe("g2");
    expect(bg.begin).toBeCloseTo(0.5);
  });

  it("preserves LineFields like agentId, text, groupId, instanceIdx across all variants", () => {
    const lines: LyricLine[] = [
      reconcileLine({
        id: "wsl",
        text: "hi",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 2,
        templateLineIdx: 0,
        words: [{ text: "hi", begin: 1.0, end: 1.5 }],
      }),
      reconcileLine({
        id: "lsl",
        text: "world",
        agentId: "v2",
        groupId: "g2",
        instanceIdx: 1,
        begin: 2.0,
        end: 3.0,
      }),
    ];
    const out = shiftAllTimings(lines, 0.5);
    expect(out[0].agentId).toBe("v1");
    expect(out[0].groupId).toBe("g1");
    expect(out[0].instanceIdx).toBe(2);
    expect(out[0].templateLineIdx).toBe(0);
    expect(lineText(out[0])).toBe("hi");
    expect(out[1].agentId).toBe("v2");
    expect(out[1].groupId).toBe("g2");
    expect(out[1].instanceIdx).toBe(1);
  });
});

describe("shiftAllTimings: edge cases", () => {
  it("clamps negative line timings to 0", () => {
    const out = shiftAllTimings([lineSynced("L", 0.1, 0.4)], 0.5);
    const bounds = mainBounds(out[0]);
    expect(bounds?.begin).toBe(0);
    expect(bounds?.end).toBe(0);
  });

  it("clamps negative word timings to 0", () => {
    const out = shiftAllTimings(
      [
        wordSynced("L", [
          { text: "early", begin: 0.1, end: 0.2 },
          { text: "later", begin: 0.6, end: 1.0 },
        ]),
      ],
      0.5,
    );
    const words = mainWords(out[0]) ?? [];
    expect(words[0].begin).toBe(0);
    expect(words[0].end).toBe(0);
    expect(words[1].begin).toBeCloseTo(0.1);
    expect(words[1].end).toBeCloseTo(0.5);
  });

  it("clamps negative background word timings to 0", () => {
    const lines: LyricLine[] = [
      reconcileLine({
        id: "L",
        text: "main",
        agentId: "a",
        backgroundText: "bg",
        backgroundWords: [{ text: "bg", begin: 0.1, end: 0.3 }],
      }),
    ];
    const out = shiftAllTimings(lines, 0.5);
    const bg = (bgWords(out[0]) ?? [])[0];
    expect(bg.begin).toBe(0);
    expect(bg.end).toBe(0);
  });

  it("handles an empty lines array", () => {
    const out = shiftAllTimings([], 0.5);
    expect(out).toEqual([]);
  });

  it("handles a word-synced line with no words", () => {
    const lines: LyricLine[] = [reconcileLine({ id: "L", text: "", agentId: "a", words: [] })];
    const out = shiftAllTimings(lines, 0.5);
    expect(mainWords(out[0]) ?? []).toEqual([]);
  });
});

describe("shiftAllTimings: invariants", () => {
  it("does not mutate the input array or its elements", () => {
    const lines: LyricLine[] = [
      lineSynced("L1", 1.0, 2.0),
      wordSynced("L2", [{ text: "x", begin: 1.0, end: 1.5 }]),
      reconcileLine({
        id: "L3",
        text: "main",
        agentId: "a",
        backgroundText: "bg",
        backgroundWords: [{ text: "bg", begin: 1.0, end: 1.5 }],
      }),
    ];
    const snapshot = JSON.parse(JSON.stringify(lines));
    shiftAllTimings(lines, 0.5);
    expect(JSON.parse(JSON.stringify(lines))).toEqual(snapshot);
  });

  it("returns the same length output", () => {
    const lines: LyricLine[] = [
      lineSynced("L1", 1.0, 2.0),
      reconcileLine({ id: "L2", text: "untimed", agentId: "a" }),
      wordSynced("L3", [{ text: "x", begin: 1.0, end: 1.5 }]),
    ];
    const out = shiftAllTimings(lines, 0.5);
    expect(out.length).toBe(lines.length);
  });

  it("preserves line ids and order", () => {
    const lines: LyricLine[] = [lineSynced("L1", 1.0, 2.0), lineSynced("L2", 3.0, 4.0), lineSynced("L3", 5.0, 6.0)];
    const out = shiftAllTimings(lines, 0.5);
    expect(out.map((l) => l.id)).toEqual(["L1", "L2", "L3"]);
  });

  it("returns the same reference when shift is 0 (no-op fast path)", () => {
    const lines = [lineSynced("L", 1.0, 2.0)];
    const out = shiftAllTimings(lines, 0);
    expect(out).toBe(lines);
  });
});
