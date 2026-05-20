import { describe, expect, it } from "vitest";
import { createLine } from "@/test/factories";
import { applySyllableSplitToLines } from "@/stores/project/syllable-split-helpers";

describe("applySyllableSplitToLines", () => {
  it("splits the source word", () => {
    const lines = [createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] })];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [3], false);
    expect(result[0].words).toHaveLength(2);
    expect(result[0].words?.[0].text).toBe("run");
    expect(result[0].words?.[1].text).toBe("ning");
  });

  it("splits identical words in other lines too", () => {
    const lines = [
      createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] }),
      createLine({ id: "l2", words: [{ text: "running", begin: 2, end: 3 }] }),
    ];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [3], false);
    expect(result[0].words).toHaveLength(2);
    expect(result[1].words).toHaveLength(2);
  });

  it("gives each split word its own syllableGroupId", () => {
    const lines = [
      createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] }),
      createLine({ id: "l2", words: [{ text: "running", begin: 2, end: 3 }] }),
    ];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [3], false);
    const g1 = result[0].words?.[0].syllableGroupId;
    const g2 = result[1].words?.[0].syllableGroupId;
    expect(g1).toBeTruthy();
    expect(g2).toBeTruthy();
    expect(g1).not.toBe(g2);
  });

  it("preserves trailing space on the last syllable when the source had one", () => {
    const lines = [createLine({ id: "l1", words: [{ text: "running ", begin: 0, end: 1 }] })];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [3], false);
    expect(result[0].words?.[1].text).toBe("ning ");
  });

  it("case-insensitive flag finds Capitalized matches", () => {
    const lines = [
      createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] }),
      createLine({ id: "l2", words: [{ text: "Running", begin: 2, end: 3 }] }),
    ];
    const result = applySyllableSplitToLines(lines, { lineId: "l1", wordIndex: 0, type: "word" }, [3], true);
    expect(result[1].words).toHaveLength(2);
    expect(result[1].words?.[0].text).toBe("Run");
    expect(result[1].words?.[1].text).toBe("ning");
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
    expect(result[0].words?.map((w) => w.text)).toEqual(["g", "o", "stop", "g", "o"]);
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
    expect(result[0].words).toHaveLength(2);
    expect(result[0].backgroundWords).toHaveLength(2);
  });
});
