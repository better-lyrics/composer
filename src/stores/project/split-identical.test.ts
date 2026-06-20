import { describe, expect, it, beforeEach } from "vitest";
import { useProjectStore } from "@/stores/project";
import { bgSource, bgWords, mainWords } from "@/domain/line/voices";
import { createLine } from "@/test/factories";

describe("project.splitSyllablesAcrossIdenticalWordsWithHistory", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it("splits source and matches in a single undo step", () => {
    const lines = [
      createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] }),
      createLine({ id: "l2", words: [{ text: "running", begin: 2, end: 3 }] }),
    ];
    useProjectStore.getState().setLinesWithHistory(lines);

    useProjectStore.getState().splitSyllablesAcrossIdenticalWordsWithHistory({
      source: { lineId: "l1", wordIndex: 0, type: "word" },
      splitPoints: [3],
      caseInsensitive: false,
    });

    const after = useProjectStore.getState().lines;
    expect(mainWords(after[0])).toHaveLength(2);
    expect(mainWords(after[1])).toHaveLength(2);

    useProjectStore.getState().undo();
    const reverted = useProjectStore.getState().lines;
    expect(mainWords(reverted[0])).toHaveLength(1);
    expect(mainWords(reverted[1])).toHaveLength(1);
  });

  it("source word splits even when there are no other matches", () => {
    const lines = [createLine({ id: "l1", words: [{ text: "alone", begin: 0, end: 1 }] })];
    useProjectStore.getState().setLinesWithHistory(lines);

    useProjectStore.getState().splitSyllablesAcrossIdenticalWordsWithHistory({
      source: { lineId: "l1", wordIndex: 0, type: "word" },
      splitPoints: [2],
      caseInsensitive: false,
    });

    expect(mainWords(useProjectStore.getState().lines[0])).toHaveLength(2);
  });

  it("case-insensitive flag splits Capitalized siblings via the action", () => {
    const lines = [
      createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] }),
      createLine({ id: "l2", words: [{ text: "Running", begin: 2, end: 3 }] }),
    ];
    useProjectStore.getState().setLinesWithHistory(lines);
    useProjectStore.getState().splitSyllablesAcrossIdenticalWordsWithHistory({
      source: { lineId: "l1", wordIndex: 0, type: "word" },
      splitPoints: [3],
      caseInsensitive: true,
    });
    const after = useProjectStore.getState().lines;
    expect(mainWords(after[1])).toHaveLength(2);
    expect(mainWords(after[1])?.[0].text).toBe("Run");
  });

  it("is a no-op when splitPoints is empty", () => {
    const lines = [createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] })];
    useProjectStore.getState().setLinesWithHistory(lines);
    const before = useProjectStore.getState().lines;
    useProjectStore.getState().splitSyllablesAcrossIdenticalWordsWithHistory({
      source: { lineId: "l1", wordIndex: 0, type: "word" },
      splitPoints: [],
      caseInsensitive: false,
    });
    expect(useProjectStore.getState().lines).toBe(before);
  });
});

describe("project.splitSyllablesAcrossIdenticalWordsWithHistory · background provenance", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it("flips backgroundTextSource to manual after splitting a background word", () => {
    const lines = [
      createLine({
        id: "l1",
        words: [{ text: "main", begin: 0, end: 1 }],
        backgroundText: "running",
        backgroundTextSource: "extraction",
        backgroundWords: [{ text: "running", begin: 1, end: 2 }],
      }),
    ];
    useProjectStore.getState().setLinesWithHistory(lines);
    useProjectStore.getState().splitSyllablesAcrossIdenticalWordsWithHistory({
      source: { lineId: "l1", wordIndex: 0, type: "bg" },
      splitPoints: [3],
      caseInsensitive: false,
    });
    const line = useProjectStore.getState().lines[0];
    expect(bgWords(line)).toHaveLength(2);
    expect(bgSource(line)).toBe("manual");
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
    useProjectStore.getState().setLinesWithHistory(lines);
    useProjectStore.getState().splitSyllablesAcrossIdenticalWordsWithHistory({
      source: { lineId: "l1", wordIndex: 0, type: "word" },
      splitPoints: [3],
      caseInsensitive: false,
    });
    expect(bgSource(useProjectStore.getState().lines[0])).toBe("extraction");
  });

  it("undo restores the prior extraction provenance", () => {
    const lines = [
      createLine({
        id: "l1",
        words: [{ text: "main", begin: 0, end: 1 }],
        backgroundText: "running",
        backgroundTextSource: "extraction",
        backgroundWords: [{ text: "running", begin: 1, end: 2 }],
      }),
    ];
    useProjectStore.getState().setLinesWithHistory(lines);
    useProjectStore.getState().splitSyllablesAcrossIdenticalWordsWithHistory({
      source: { lineId: "l1", wordIndex: 0, type: "bg" },
      splitPoints: [3],
      caseInsensitive: false,
    });
    expect(bgSource(useProjectStore.getState().lines[0])).toBe("manual");
    useProjectStore.getState().undo();
    expect(bgSource(useProjectStore.getState().lines[0])).toBe("extraction");
  });
});
