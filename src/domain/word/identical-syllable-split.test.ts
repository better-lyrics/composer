import { describe, expect, it } from "vitest";
import { backgroundText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, roleWords, timedSyllables } from "@/domain/line/track";
import { applySyllableSplitToLines } from "@/domain/word/identical-syllable-split";
import { createLine } from "@/test/factories";

describe("applySyllableSplitToLines", () => {
  it("splits the source word", () => {
    const lines = [createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] })];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [3], false);
    expect(timedSyllables(mainTrack(result[0]))).toHaveLength(2);
    expect(timedSyllables(mainTrack(result[0]))[0].text).toBe("run");
    expect(timedSyllables(mainTrack(result[0]))[1].text).toBe("ning");
  });

  it("splits identical words in other lines too", () => {
    const lines = [
      createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] }),
      createLine({ id: "l2", words: [{ text: "running", begin: 2, end: 3 }] }),
    ];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [3], false);
    expect(timedSyllables(mainTrack(result[0]))).toHaveLength(2);
    expect(timedSyllables(mainTrack(result[1]))).toHaveLength(2);
  });

  it("joins the syllables of each split word on their own", () => {
    const lines = [
      createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] }),
      createLine({ id: "l2", words: [{ text: "running", begin: 2, end: 3 }] }),
    ];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [3], false);
    expect(roleWords(result[0], "main")?.map((word) => word.joinsNext)).toEqual([true, false]);
    expect(roleWords(result[1], "main")?.map((word) => word.joinsNext)).toEqual([true, false]);
  });

  it("preserves trailing space on the last syllable when the source had one", () => {
    const lines = [createLine({ id: "l1", words: [{ text: "running", sep: " ", begin: 0, end: 1 }] })];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [3], false);
    expect(timedSyllables(mainTrack(result[0]))[1]).toMatchObject({ text: "ning", sep: " " });
  });

  it("case-insensitive flag finds Capitalized matches", () => {
    const lines = [
      createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] }),
      createLine({ id: "l2", words: [{ text: "Running", begin: 2, end: 3 }] }),
    ];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [3], true);
    expect(timedSyllables(mainTrack(result[1]))).toHaveLength(2);
    expect(timedSyllables(mainTrack(result[1]))[0].text).toBe("Run");
    expect(timedSyllables(mainTrack(result[1]))[1].text).toBe("ning");
  });

  it("returns the original lines reference unchanged when source line doesn't exist", () => {
    const lines = [createLine({ id: "l1", words: [{ text: "alone", begin: 0, end: 1 }] })];
    const result = applySyllableSplitToLines(lines, { lineId: "missing", wordIndex: 0, type: "word" }, [2], false);
    expect(result).toBe(lines);
  });

  it("handles two matches on the same line+track without index drift", () => {
    const lines = [
      createLine({
        id: "l1",
        words: [
          { text: "go ", begin: 0, end: 1 },
          { text: "stop ", begin: 1, end: 2 },
          { text: "go", begin: 2, end: 3 },
        ],
      }),
    ];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [1], false);
    expect(timedSyllables(mainTrack(result[0])).map((w) => w.text)).toEqual(["g", "o", "stop", "g", "o"]);
  });

  it("includes background-word matches", () => {
    const lines = [
      createLine({
        id: "l1",
        words: [{ text: "yeah", begin: 0, end: 1 }],
        backgroundWords: [{ text: "yeah", begin: 0.5, end: 1.5 }],
      }),
    ];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [2], false);
    expect(timedSyllables(mainTrack(result[0]))).toHaveLength(2);
    expect(timedSyllables(backgroundTrack(result[0]))).toHaveLength(2);
  });
});

describe("applySyllableSplitToLines · background provenance", () => {
  it("flips backgroundTextSource to manual when the background track is split", () => {
    const lines = [
      createLine({
        id: "l1",
        words: [{ text: "main", begin: 0, end: 1 }],
        backgroundText: "running",
        backgroundTextSource: "extraction",
        backgroundWords: [{ text: "running", begin: 1, end: 2 }],
      }),
    ];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "bg" }, [3], false);
    expect(timedSyllables(backgroundTrack(result[0]))).toHaveLength(2);
    expect(backgroundTrack(result[0])?.source).toBe("manual");
    expect(backgroundText(result[0])).toBe("run|ning");
  });

  it("flips backgroundTextSource to manual when a main-word split also splits a matching background word", () => {
    const lines = [
      createLine({
        id: "l1",
        words: [{ text: "yeah", begin: 0, end: 1 }],
        backgroundText: "yeah",
        backgroundTextSource: "extraction",
        backgroundWords: [{ text: "yeah", begin: 0.5, end: 1.5 }],
      }),
    ];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [2], false);
    expect(timedSyllables(backgroundTrack(result[0]))).toHaveLength(2);
    expect(backgroundTrack(result[0])?.source).toBe("manual");
  });

  it("leaves backgroundTextSource untouched when only the main track is split", () => {
    const lines = [
      createLine({
        id: "l1",
        words: [{ text: "running", begin: 0, end: 1 }],
        backgroundText: "ooh",
        backgroundTextSource: "extraction",
        backgroundWords: [{ text: "ooh", begin: 1, end: 2 }],
      }),
    ];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [3], false);
    expect(timedSyllables(mainTrack(result[0]))).toHaveLength(2);
    expect(backgroundTrack(result[0])?.source).toBe("extraction");
  });

  it("flips a matching identical-word line's background track to manual", () => {
    const lines = [
      createLine({
        id: "l1",
        words: [{ text: "main", begin: 0, end: 1 }],
        backgroundText: "running",
        backgroundTextSource: "extraction",
        backgroundWords: [{ text: "running", begin: 1, end: 2 }],
      }),
      createLine({
        id: "l2",
        words: [{ text: "main", begin: 3, end: 4 }],
        backgroundText: "running",
        backgroundTextSource: "extraction",
        backgroundWords: [{ text: "running", begin: 4, end: 5 }],
      }),
    ];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "bg" }, [3], false);
    expect(backgroundTrack(result[0])?.source).toBe("manual");
    expect(backgroundTrack(result[1])?.source).toBe("manual");
    expect(timedSyllables(backgroundTrack(result[1]))).toHaveLength(2);
  });
});
