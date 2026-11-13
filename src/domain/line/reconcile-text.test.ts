import type { LyricLine } from "@/domain/line/model";
import { reconcileMatchedTiming } from "@/domain/line/reconcile-text";
import { describe, expect, it } from "vitest";

describe("reconcileMatchedTiming", () => {
  it("returns the same reference when the typed text is identical", () => {
    const line: LyricLine = {
      id: "L1",
      text: "Dengar|lah rindu yang menyik|sa i|ni",
      agentId: "v1",
      words: [
        { id: "w1", text: "Dengar", sep: "", begin: 1, end: 1.2 },
        { id: "w2", text: "lah", sep: " ", begin: 1.2, end: 1.4 },
        { id: "w3", text: "rindu", sep: " ", begin: 1.4, end: 1.6 },
        { id: "w4", text: "yang", sep: " ", begin: 1.6, end: 1.8 },
        { id: "w5", text: "menyik", sep: "", begin: 1.8, end: 2 },
        { id: "w6", text: "sa", sep: " ", begin: 2, end: 2.2 },
        { id: "w7", text: "i", sep: "", begin: 2.2, end: 2.4 },
        { id: "w8", text: "ni", sep: "", begin: 2.4, end: 2.6 },
      ],
    };
    const result = reconcileMatchedTiming(line, "Dengar|lah rindu yang menyik|sa i|ni");
    expect(result).toBe(line);
  });

  it("preserves begin/end on an untouched line-synced line that contains split characters", () => {
    const line: LyricLine = {
      id: "L0",
      text: "Dengar|lah rindu",
      agentId: "v1",
      begin: 1,
      end: 2,
    };
    const result = reconcileMatchedTiming(line, "Dengar|lah rindu");
    expect(result).toBe(line);
  });

  it("remaps words when split positions move but the syllable count is unchanged", () => {
    const line: LyricLine = {
      id: "L0",
      text: "Den|garlah rin|du",
      agentId: "v1",
      words: [
        { id: "w9", text: "Den", sep: "", begin: 0, end: 0.5 },
        { id: "w10", text: "garlah", sep: " ", begin: 0.5, end: 1 },
        { id: "w11", text: "rin", sep: "", begin: 1, end: 1.5 },
        { id: "w12", text: "du", sep: "", begin: 1.5, end: 2 },
      ],
    };
    const result = reconcileMatchedTiming(line, "Dengar|lah rin|du");
    expect(result.text).toBe("Dengar|lah rin|du");
    expect(result.words?.map((w) => w.begin)).toEqual([0, 0.5, 1, 1.5]);
    expect(result.words?.map((w) => w.end)).toEqual([0.5, 1, 1.5, 2]);
    expect(result.words?.map((w) => w.text + w.sep)).toEqual(["Dengar", "lah ", "rin", "du"]);
  });

  it("keeps untouched syllable timing when the syllable count changes", () => {
    const line: LyricLine = {
      id: "L0",
      text: "Dengar|lah",
      agentId: "v1",
      words: [
        { id: "w13", text: "Dengar", sep: "", begin: 0, end: 0.5 },
        { id: "w14", text: "lah", sep: "", begin: 0.5, end: 1 },
      ],
    };
    const result = reconcileMatchedTiming(line, "Dengar|lah|extra");
    expect(result.text).toBe("Dengar|lah|extra");
    expect(result.words?.map((w) => w.text)).toEqual(["Dengar", "lah", "extra"]);
    expect(result.words?.[0]).toEqual({ text: "Dengar", sep: "", begin: 0, end: 0.5 });
    expect(result.words?.[2].end).toBe(1);
  });

  it("keeps begin/end on a line-synced line whose text content changed", () => {
    const line: LyricLine = {
      id: "L0",
      text: "Dengarlah rindu",
      agentId: "v1",
      begin: 1,
      end: 2,
    };
    const result = reconcileMatchedTiming(line, "Dengarlah rindu sayang");
    expect(result.text).toBe("Dengarlah rindu sayang");
    expect(result.begin).toBe(1);
    expect(result.end).toBe(2);
    expect(result.words).toBeUndefined();
  });

  it("clears word timing when the line text is emptied", () => {
    const line: LyricLine = {
      id: "L0",
      text: "Dengar|lah",
      agentId: "v1",
      words: [
        { id: "w15", text: "Dengar", sep: "", begin: 0, end: 0.5 },
        { id: "w16", text: "lah", sep: "", begin: 0.5, end: 1 },
      ],
    };
    const result = reconcileMatchedTiming(line, "");
    expect(result.text).toBe("");
    expect(result.words).toBeUndefined();
  });

  it("clears begin/end when a line-synced line's text is emptied", () => {
    const line: LyricLine = { id: "L0", text: "Dengarlah", agentId: "v1", begin: 1, end: 2 };
    const result = reconcileMatchedTiming(line, "");
    expect(result.begin).toBeUndefined();
    expect(result.end).toBeUndefined();
  });
});

describe("reconcileMatchedTiming · edge cases", () => {
  it("returns the same reference for an untimed line whose text is identical", () => {
    const line: LyricLine = { id: "L0", text: "no timing here", agentId: "v1" };
    const result = reconcileMatchedTiming(line, "no timing here");
    expect(result).toBe(line);
  });

  it("updates text on an untimed line whose text changed", () => {
    const line: LyricLine = { id: "L0", text: "old", agentId: "v1" };
    const result = reconcileMatchedTiming(line, "new");
    expect(result.text).toBe("new");
    expect(result.words).toBeUndefined();
    expect(result.begin).toBeUndefined();
    expect(result.end).toBeUndefined();
  });

  it("treats an empty words array as no timing and clears on text change", () => {
    const line: LyricLine = {
      id: "L0",
      text: "Dengar|lah",
      agentId: "v1",
      words: [],
    };
    const result = reconcileMatchedTiming(line, "Dengar|lah|extra");
    expect(result.text).toBe("Dengar|lah|extra");
    expect(result.words).toBeUndefined();
    expect(result.begin).toBeUndefined();
    expect(result.end).toBeUndefined();
  });

  it("does not mutate the input line or its words array", () => {
    const originalWords = [
      { id: "w17", text: "Den", sep: "", begin: 0, end: 0.5 },
      { id: "w18", text: "garlah", sep: " ", begin: 0.5, end: 1 },
      { id: "w19", text: "rin", sep: "", begin: 1, end: 1.5 },
      { id: "w20", text: "du", sep: "", begin: 1.5, end: 2 },
    ];
    const line: LyricLine = {
      id: "L0",
      text: "Den|garlah rin|du",
      agentId: "v1",
      words: originalWords,
    };
    const beforeText = line.text;
    const beforeWords = line.words;
    const beforeWordsSnapshot = JSON.parse(JSON.stringify(line.words));
    reconcileMatchedTiming(line, "Dengar|lah rin|du");
    expect(line.text).toBe(beforeText);
    expect(line.words).toBe(beforeWords);
    expect(line.words).toEqual(beforeWordsSnapshot);
  });

  it("preserves background-vocal fields on the remap path", () => {
    const line: LyricLine = {
      id: "L0",
      text: "Den|garlah rin|du",
      agentId: "v1",
      words: [
        { id: "w21", text: "Den", sep: "", begin: 0, end: 0.5 },
        { id: "w22", text: "garlah", sep: " ", begin: 0.5, end: 1 },
        { id: "w23", text: "rin", sep: "", begin: 1, end: 1.5 },
        { id: "w24", text: "du", sep: "", begin: 1.5, end: 2 },
      ],
      backgroundText: "ooh",
      backgroundWords: [{ id: "w25", text: "ooh", sep: "", begin: 0.2, end: 0.8 }],
      backgroundTextSource: "manual",
    };
    const result = reconcileMatchedTiming(line, "Dengar|lah rin|du");
    expect(result.backgroundText).toBe("ooh");
    expect(result.backgroundWords).toEqual([{ text: "ooh", sep: "", begin: 0.2, end: 0.8 }]);
    expect(result.backgroundTextSource).toBe("manual");
  });

  it("preserves background-vocal fields on the clear path", () => {
    const line: LyricLine = {
      id: "L0",
      text: "Dengar|lah",
      agentId: "v1",
      words: [
        { id: "w26", text: "Dengar", sep: "", begin: 0, end: 0.5 },
        { id: "w27", text: "lah", sep: "", begin: 0.5, end: 1 },
      ],
      backgroundText: "ooh",
      backgroundWords: [{ id: "w28", text: "ooh", sep: "", begin: 0.2, end: 0.8 }],
      backgroundTextSource: "extraction",
    };
    const result = reconcileMatchedTiming(line, "");
    expect(result.backgroundText).toBe("ooh");
    expect(result.backgroundWords).toEqual([{ text: "ooh", sep: "", begin: 0.2, end: 0.8 }]);
    expect(result.backgroundTextSource).toBe("extraction");
  });

  it("preserves group fields (groupId, instanceIdx, templateLineIdx) on both paths", () => {
    const wordSynced: LyricLine = {
      id: "L0",
      text: "Den|garlah rin|du",
      agentId: "v1",
      words: [
        { id: "w29", text: "Den", sep: "", begin: 0, end: 0.5 },
        { id: "w30", text: "garlah", sep: " ", begin: 0.5, end: 1 },
        { id: "w31", text: "rin", sep: "", begin: 1, end: 1.5 },
        { id: "w32", text: "du", sep: "", begin: 1.5, end: 2 },
      ],
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 0,
    };
    const remapped = reconcileMatchedTiming(wordSynced, "Dengar|lah rin|du");
    expect(remapped.groupId).toBe("g1");
    expect(remapped.instanceIdx).toBe(0);
    expect(remapped.templateLineIdx).toBe(0);

    const cleared = reconcileMatchedTiming(wordSynced, "");
    expect(cleared.groupId).toBe("g1");
    expect(cleared.instanceIdx).toBe(0);
    expect(cleared.templateLineIdx).toBe(0);
  });
});

describe("reconcileMatchedTiming · regressions", () => {
  it("regression: typing an extra word into a line-synced line keeps its sync", () => {
    const line: LyricLine = { id: "L0", text: "It hurts for me", agentId: "v1", begin: 107.9, end: 110.425 };
    const result = reconcileMatchedTiming(line, "It hurts for me to wait");
    expect(result.begin).toBe(107.9);
    expect(result.end).toBe(110.425);
  });

  it("regression: typing an extra word into a word-synced line keeps the other words' timing", () => {
    const line: LyricLine = {
      id: "L0",
      text: "Wish I could",
      agentId: "v1",
      words: [
        { id: "w33", text: "Wish", sep: " ", begin: 1, end: 2 },
        { id: "w34", text: "I", sep: " ", begin: 2, end: 3 },
        { id: "w35", text: "could", sep: "", begin: 3, end: 4 },
      ],
    };
    const result = reconcileMatchedTiming(line, "Wish I could get it");
    expect(result.words?.slice(0, 2)).toEqual([
      { text: "Wish", sep: " ", begin: 1, end: 2 },
      { text: "I", sep: " ", begin: 2, end: 3 },
    ]);
    expect(result.words?.map((w) => w.text + w.sep)).toEqual(["Wish ", "I ", "could ", "get ", "it"]);
    expect(result.words?.[4].end).toBe(4);
  });

  it("regression: deleting a word from a word-synced line keeps the remaining timing exactly", () => {
    const line: LyricLine = {
      id: "L0",
      text: "Wish I could",
      agentId: "v1",
      words: [
        { id: "w36", text: "Wish", sep: " ", begin: 1, end: 2 },
        { id: "w37", text: "I", sep: " ", begin: 2, end: 3 },
        { id: "w38", text: "could", sep: "", begin: 3, end: 4 },
      ],
    };
    const result = reconcileMatchedTiming(line, "Wish could");
    expect(result.words).toEqual([
      { text: "Wish", sep: " ", begin: 1, end: 2 },
      { text: "could", sep: "", begin: 3, end: 4 },
    ]);
  });
});
