import { describe, expect, it } from "vitest";
import { bgSource, bgText, bgWords, mainWords } from "@/domain/line/voices";
import { createLine } from "@/test/factories";
import { applySyllableSplitToLines } from "@/stores/project/syllable-split-helpers";

describe("applySyllableSplitToLines", () => {
  it("splits the source word", () => {
    const lines = [createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] })];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [3], false);
    expect(mainWords(result[0])).toHaveLength(2);
    expect(mainWords(result[0])?.[0].text).toBe("run");
    expect(mainWords(result[0])?.[1].text).toBe("ning");
  });

  it("splits identical words in other lines too", () => {
    const lines = [
      createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] }),
      createLine({ id: "l2", words: [{ text: "running", begin: 2, end: 3 }] }),
    ];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [3], false);
    expect(mainWords(result[0])).toHaveLength(2);
    expect(mainWords(result[1])).toHaveLength(2);
  });

  it("gives each split word its own syllableGroupId", () => {
    const lines = [
      createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] }),
      createLine({ id: "l2", words: [{ text: "running", begin: 2, end: 3 }] }),
    ];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [3], false);
    const g1 = mainWords(result[0])?.[0].syllableGroupId;
    const g2 = mainWords(result[1])?.[0].syllableGroupId;
    expect(g1).toBeTruthy();
    expect(g2).toBeTruthy();
    expect(g1).not.toBe(g2);
  });

  it("preserves trailing space on the last syllable when the source had one", () => {
    const lines = [createLine({ id: "l1", words: [{ text: "running ", begin: 0, end: 1 }] })];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [3], false);
    expect(mainWords(result[0])?.[1].text).toBe("ning ");
  });

  it("case-insensitive flag finds Capitalized matches", () => {
    const lines = [
      createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] }),
      createLine({ id: "l2", words: [{ text: "Running", begin: 2, end: 3 }] }),
    ];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [3], true);
    expect(mainWords(result[1])).toHaveLength(2);
    expect(mainWords(result[1])?.[0].text).toBe("Run");
    expect(mainWords(result[1])?.[1].text).toBe("ning");
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
          { text: "go", begin: 0, end: 1 },
          { text: "stop", begin: 1, end: 2 },
          { text: "go", begin: 2, end: 3 },
        ],
      }),
    ];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [1], false);
    expect(mainWords(result[0])?.map((w) => w.text)).toEqual(["g", "o", "stop", "g", "o"]);
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
    expect(mainWords(result[0])).toHaveLength(2);
    expect(bgWords(result[0])).toHaveLength(2);
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
    expect(bgWords(result[0])).toHaveLength(2);
    expect(bgSource(result[0])).toBe("manual");
    expect(bgText(result[0])).toBe("run|ning");
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
    expect(bgWords(result[0])).toHaveLength(2);
    expect(bgSource(result[0])).toBe("manual");
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
    expect(mainWords(result[0])).toHaveLength(2);
    expect(bgSource(result[0])).toBe("extraction");
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
    expect(bgSource(result[0])).toBe("manual");
    expect(bgSource(result[1])).toBe("manual");
    expect(bgWords(result[1])).toHaveLength(2);
  });
});
