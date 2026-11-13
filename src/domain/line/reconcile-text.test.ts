import { describe, expect, it } from "vitest";
import { lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { reconcileMatchedTiming } from "@/domain/line/reconcile-text";
import { backgroundText, lineText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, roleWords, timedSyllables } from "@/domain/line/track";

const timedSpans = (line: LyricLine) =>
  timedSyllables(mainTrack(line)).map((word) => [word.text, +word.begin.toFixed(3), +word.end.toFixed(3)]);

describe("reconcileMatchedTiming", () => {
  it("returns the same reference when the typed text is identical", () => {
    const line: LyricLine = lineFromFields({
      id: "L1",
      text: "Dengar|lah rindu yang menyik|sa i|ni",
      agentId: "v1",
      words: [
        { id: "w1", text: "Dengar", sep: "", begin: 1, end: 1.2, joinsNext: true },
        { id: "w2", text: "lah", sep: " ", begin: 1.2, end: 1.4, joinsNext: false },
        { id: "w3", text: "rindu", sep: " ", begin: 1.4, end: 1.6, joinsNext: false },
        { id: "w4", text: "yang", sep: " ", begin: 1.6, end: 1.8, joinsNext: false },
        { id: "w5", text: "menyik", sep: "", begin: 1.8, end: 2, joinsNext: true },
        { id: "w6", text: "sa", sep: " ", begin: 2, end: 2.2, joinsNext: false },
        { id: "w7", text: "i", sep: "", begin: 2.2, end: 2.4, joinsNext: true },
        { id: "w8", text: "ni", sep: "", begin: 2.4, end: 2.6, joinsNext: false },
      ],
    });
    const result = reconcileMatchedTiming(line, "Dengar|lah rindu yang menyik|sa i|ni");
    expect(result).toBe(line);
  });

  it("preserves begin/end on an untouched line-synced line that contains split characters", () => {
    const line: LyricLine = lineFromFields({
      id: "L0",
      text: "Dengar|lah rindu",
      agentId: "v1",
      begin: 1,
      end: 2,
    });
    const result = reconcileMatchedTiming(line, "Dengar|lah rindu");
    expect(result).toBe(line);
  });

  it("remaps words when split positions move but the syllable count is unchanged", () => {
    const line: LyricLine = lineFromFields({
      id: "L0",
      text: "Den|garlah rin|du",
      agentId: "v1",
      words: [
        { id: "w9", text: "Den", sep: "", begin: 0, end: 0.5, joinsNext: true },
        { id: "w10", text: "garlah", sep: " ", begin: 0.5, end: 1, joinsNext: false },
        { id: "w11", text: "rin", sep: "", begin: 1, end: 1.5, joinsNext: true },
        { id: "w12", text: "du", sep: "", begin: 1.5, end: 2, joinsNext: false },
      ],
    });
    const result = reconcileMatchedTiming(line, "Dengar|lah rin|du");
    expect(lineText(result)).toBe("Dengar|lah rin|du");
    expect(timedSyllables(mainTrack(result)).map((w) => w.begin)).toEqual([0, 0.5, 1, 1.5]);
    expect(timedSyllables(mainTrack(result)).map((w) => w.end)).toEqual([0.5, 1, 1.5, 2]);
    expect(timedSyllables(mainTrack(result)).map((w) => w.text + w.sep)).toEqual(["Dengar", "lah ", "rin", "du"]);
  });

  it("keeps untouched syllable timing when the syllable count changes", () => {
    const line: LyricLine = lineFromFields({
      id: "L0",
      text: "Dengar|lah",
      agentId: "v1",
      words: [
        { id: "w13", text: "Dengar", sep: "", begin: 0, end: 0.5, joinsNext: true },
        { id: "w14", text: "lah", sep: "", begin: 0.5, end: 1, joinsNext: false },
      ],
    });
    const result = reconcileMatchedTiming(line, "Dengar|lah|extra");
    expect(lineText(result)).toBe("Dengar|lah|extra");
    expect(timedSyllables(mainTrack(result)).map((w) => w.text)).toEqual(["Dengar", "lah", "extra"]);
    expect(timedSyllables(mainTrack(result))[0]).toEqual({
      text: "Dengar",
      sep: "",
      begin: 0,
      end: 0.5,
      joinsNext: true,
    });
    expect(timedSyllables(mainTrack(result))[2].end).toBe(1);
  });

  it("keeps begin/end on a line-synced line whose text content changed", () => {
    const line: LyricLine = lineFromFields({
      id: "L0",
      text: "Dengarlah rindu",
      agentId: "v1",
      begin: 1,
      end: 2,
    });
    const result = reconcileMatchedTiming(line, "Dengarlah rindu sayang");
    expect(lineText(result)).toBe("Dengarlah rindu sayang");
    expect(mainTrack(result).begin).toBe(1);
    expect(mainTrack(result).end).toBe(2);
    expect(roleWords(result, "main")).toBeUndefined();
  });

  it("clears word timing when the line text is emptied", () => {
    const line: LyricLine = lineFromFields({
      id: "L0",
      text: "Dengar|lah",
      agentId: "v1",
      words: [
        { id: "w15", text: "Dengar", sep: "", begin: 0, end: 0.5, joinsNext: true },
        { id: "w16", text: "lah", sep: "", begin: 0.5, end: 1, joinsNext: false },
      ],
    });
    const result = reconcileMatchedTiming(line, "");
    expect(lineText(result)).toBe("");
    expect(roleWords(result, "main")).toBeUndefined();
  });

  it("clears begin/end when a line-synced line's text is emptied", () => {
    const line: LyricLine = lineFromFields({ id: "L0", text: "Dengarlah", agentId: "v1", begin: 1, end: 2 });
    const result = reconcileMatchedTiming(line, "");
    expect(mainTrack(result).begin).toBeUndefined();
    expect(mainTrack(result).end).toBeUndefined();
  });
});

describe("reconcileMatchedTiming · edge cases", () => {
  it("returns the same reference for an untimed line whose text is identical", () => {
    const line: LyricLine = lineFromFields({ id: "L0", text: "no timing here", agentId: "v1" });
    const result = reconcileMatchedTiming(line, "no timing here");
    expect(result).toBe(line);
  });

  it("updates text on an untimed line whose text changed", () => {
    const line: LyricLine = lineFromFields({ id: "L0", text: "old", agentId: "v1" });
    const result = reconcileMatchedTiming(line, "new");
    expect(lineText(result)).toBe("new");
    expect(roleWords(result, "main")).toBeUndefined();
    expect(mainTrack(result).begin).toBeUndefined();
    expect(mainTrack(result).end).toBeUndefined();
  });

  it("treats an empty words array as no timing and clears on text change", () => {
    const line: LyricLine = lineFromFields({
      id: "L0",
      text: "Dengar|lah",
      agentId: "v1",
      words: [],
    });
    const result = reconcileMatchedTiming(line, "Dengar|lah|extra");
    expect(lineText(result)).toBe("Dengar|lah|extra");
    expect(roleWords(result, "main")).toBeUndefined();
    expect(mainTrack(result).begin).toBeUndefined();
    expect(mainTrack(result).end).toBeUndefined();
  });

  it("does not mutate the input line or its words array", () => {
    const originalWords = [
      { id: "w17", text: "Den", sep: "", begin: 0, end: 0.5, joinsNext: true },
      { id: "w18", text: "garlah", sep: " ", begin: 0.5, end: 1, joinsNext: false },
      { id: "w19", text: "rin", sep: "", begin: 1, end: 1.5, joinsNext: true },
      { id: "w20", text: "du", sep: "", begin: 1.5, end: 2, joinsNext: false },
    ];
    const line: LyricLine = lineFromFields({
      id: "L0",
      text: "Den|garlah rin|du",
      agentId: "v1",
      words: originalWords,
    });
    const beforeText = lineText(line);
    const beforeWords = roleWords(line, "main");
    const beforeWordsSnapshot = JSON.parse(JSON.stringify(roleWords(line, "main")));
    reconcileMatchedTiming(line, "Dengar|lah rin|du");
    expect(lineText(line)).toBe(beforeText);
    expect(roleWords(line, "main")).toBe(beforeWords);
    expect(roleWords(line, "main")).toEqual(beforeWordsSnapshot);
  });

  it("preserves background-vocal fields on the remap path", () => {
    const line: LyricLine = lineFromFields({
      id: "L0",
      text: "Den|garlah rin|du",
      agentId: "v1",
      words: [
        { id: "w21", text: "Den", sep: "", begin: 0, end: 0.5, joinsNext: true },
        { id: "w22", text: "garlah", sep: " ", begin: 0.5, end: 1, joinsNext: false },
        { id: "w23", text: "rin", sep: "", begin: 1, end: 1.5, joinsNext: true },
        { id: "w24", text: "du", sep: "", begin: 1.5, end: 2, joinsNext: false },
      ],
      backgroundText: "ooh",
      backgroundWords: [{ id: "w25", text: "ooh", sep: "", begin: 0.2, end: 0.8, joinsNext: false }],
      backgroundTextSource: "manual",
    });
    const result = reconcileMatchedTiming(line, "Dengar|lah rin|du");
    expect(backgroundText(result)).toBe("ooh");
    expect(timedSyllables(backgroundTrack(result))).toEqual([
      { text: "ooh", sep: "", begin: 0.2, end: 0.8, joinsNext: false },
    ]);
    expect(backgroundTrack(result)?.source).toBe("manual");
  });

  it("preserves background-vocal fields on the clear path", () => {
    const line: LyricLine = lineFromFields({
      id: "L0",
      text: "Dengar|lah",
      agentId: "v1",
      words: [
        { id: "w26", text: "Dengar", sep: "", begin: 0, end: 0.5, joinsNext: true },
        { id: "w27", text: "lah", sep: "", begin: 0.5, end: 1, joinsNext: false },
      ],
      backgroundText: "ooh",
      backgroundWords: [{ id: "w28", text: "ooh", sep: "", begin: 0.2, end: 0.8, joinsNext: false }],
      backgroundTextSource: "extraction",
    });
    const result = reconcileMatchedTiming(line, "");
    expect(backgroundText(result)).toBe("ooh");
    expect(timedSyllables(backgroundTrack(result))).toEqual([
      { text: "ooh", sep: "", begin: 0.2, end: 0.8, joinsNext: false },
    ]);
    expect(backgroundTrack(result)?.source).toBe("extraction");
  });

  it("preserves group fields (groupId, instanceIdx, templateLineIdx) on both paths", () => {
    const wordSynced: LyricLine = lineFromFields({
      id: "L0",
      text: "Den|garlah rin|du",
      agentId: "v1",
      words: [
        { id: "w29", text: "Den", sep: "", begin: 0, end: 0.5, joinsNext: true },
        { id: "w30", text: "garlah", sep: " ", begin: 0.5, end: 1, joinsNext: false },
        { id: "w31", text: "rin", sep: "", begin: 1, end: 1.5, joinsNext: true },
        { id: "w32", text: "du", sep: "", begin: 1.5, end: 2, joinsNext: false },
      ],
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 0,
    });
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
    const line: LyricLine = lineFromFields({
      id: "L0",
      text: "It hurts for me",
      agentId: "v1",
      begin: 107.9,
      end: 110.425,
    });
    const result = reconcileMatchedTiming(line, "It hurts for me to wait");
    expect(mainTrack(result).begin).toBe(107.9);
    expect(mainTrack(result).end).toBe(110.425);
  });

  it("regression: typing an extra word into a word-synced line keeps the other words' timing", () => {
    const line: LyricLine = lineFromFields({
      id: "L0",
      text: "Wish I could",
      agentId: "v1",
      words: [
        { id: "w33", text: "Wish", sep: " ", begin: 1, end: 2, joinsNext: false },
        { id: "w34", text: "I", sep: " ", begin: 2, end: 3, joinsNext: false },
        { id: "w35", text: "could", sep: "", begin: 3, end: 4, joinsNext: false },
      ],
    });
    const result = reconcileMatchedTiming(line, "Wish I could get it");
    expect(timedSyllables(mainTrack(result)).slice(0, 2)).toEqual([
      { text: "Wish", sep: " ", begin: 1, end: 2, joinsNext: false },
      { text: "I", sep: " ", begin: 2, end: 3, joinsNext: false },
    ]);
    expect(timedSyllables(mainTrack(result)).map((w) => w.text + w.sep)).toEqual([
      "Wish ",
      "I ",
      "could ",
      "get ",
      "it",
    ]);
    expect(timedSyllables(mainTrack(result))[4].end).toBe(4);
  });

  it("regression: deleting a word from a word-synced line keeps the remaining timing exactly", () => {
    const line: LyricLine = lineFromFields({
      id: "L0",
      text: "Wish I could",
      agentId: "v1",
      words: [
        { id: "w36", text: "Wish", sep: " ", begin: 1, end: 2, joinsNext: false },
        { id: "w37", text: "I", sep: " ", begin: 2, end: 3, joinsNext: false },
        { id: "w38", text: "could", sep: "", begin: 3, end: 4, joinsNext: false },
      ],
    });
    const result = reconcileMatchedTiming(line, "Wish could");
    expect(timedSyllables(mainTrack(result))).toEqual([
      { text: "Wish", sep: " ", begin: 1, end: 2, joinsNext: false },
      { text: "could", sep: "", begin: 3, end: 4, joinsNext: false },
    ]);
  });

  describe("typing into a partly synced line, one keystroke at a time", () => {
    const partlySynced = () =>
      lineFromFields({
        id: "ru",
        text: "Да, твои глаза как море",
        agentId: "v1",
        words: [
          { id: "w1", text: "Да,", sep: " ", begin: 70.9, end: 71.3, joinsNext: false },
          { id: "w2", text: "твои", sep: " ", begin: 71.386, end: 71.686, joinsNext: false },
        ],
      });
    const typed = (line: LyricLine, keystrokes: string[]) =>
      keystrokes.reduce((current, text) => reconcileMatchedTiming(current, text), line);

    it("regression: a word typed inside the timed part keeps the timing of the timed words after it", () => {
      const timed = timedSyllables(mainTrack(typed(partlySynced(), ["Да, my твои глаза как море"])));
      expect(timed.map((word) => word.text)).toEqual(["Да,", "my", "твои"]);
      expect(timed[2]).toMatchObject({ begin: 71.386, end: 71.686 });
      expect(timed[1].begin).toBeGreaterThanOrEqual(71.3);
      expect(timed[1].end).toBeLessThanOrEqual(71.386);
    });

    it("regression: keystrokes inside a timed word spread the words typed over it inside its time", () => {
      const line = typed(partlySynced(), [
        "Да, mтвои глаза как море",
        "Да, myтвои глаза как море",
        "Да, my твои глаза как море",
      ]);
      expect(timedSpans(line)).toEqual([
        ["Да,", 70.9, 71.3],
        ["my", 71.386, 71.423],
        ["твои", 71.423, 71.461],
        ["глаза", 71.461, 71.536],
        ["как", 71.536, 71.611],
        ["море", 71.611, 71.686],
      ]);
    });

    it("keeps a word typed in the untimed tail untimed", () => {
      const line = typed(partlySynced(), [
        "Да, твои глаза n как море",
        "Да, твои глаза ne как море",
        "Да, твои глаза new как море",
      ]);
      expect(timedSyllables(mainTrack(line)).map((word) => word.text)).toEqual(["Да,", "твои"]);
      expect(lineText(line)).toBe("Да, твои глаза new как море");
    });
  });

  describe("an edit across the timed part leaves new words after it untimed", () => {
    const halfSynced = () =>
      lineFromFields({
        id: "half",
        text: "steady rain falls slow",
        agentId: "v1",
        words: [
          { id: "w1", text: "steady", sep: " ", begin: 4, end: 4.5, joinsNext: false },
          { id: "w2", text: "rain", sep: " ", begin: 4.5, end: 5, joinsNext: false },
        ],
      });
    const typedOver = (text: string) => timedSpans(reconcileMatchedTiming(halfSynced(), text));

    it("regression: a word typed after the last timed word stays untimed when an earlier timed word changed", () => {
      expect(typedOver("steadier rain now falls slow")).toEqual([
        ["steadier", 4, 4.5],
        ["rain", 4.5, 5],
      ]);
    });

    it("regression: words typed over the last timed word share its time", () => {
      expect(typedOver("steady snow drifts slow")).toEqual([
        ["steady", 4, 4.5],
        ["snow", 4.5, 4.667],
        ["drifts", 4.667, 4.833],
        ["slow", 4.833, 5],
      ]);
    });

    it("regression: words typed over the untimed tail stay untimed when an earlier timed word changed", () => {
      expect(typedOver("steadier rain now here")).toEqual([
        ["steadier", 4, 4.5],
        ["rain", 4.5, 5],
      ]);
    });

    it("regression: words typed over the only timed word keep its time", () => {
      const line = lineFromFields({
        id: "h",
        text: "hello world",
        agentId: "v1",
        words: [{ id: "w1", text: "hello", sep: " ", begin: 1, end: 2, joinsNext: false }],
      });
      expect(timedSpans(reconcileMatchedTiming(line, "hey yo"))).toEqual([
        ["hey", 1, 1.5],
        ["yo", 1.5, 2],
      ]);
    });
  });
});
