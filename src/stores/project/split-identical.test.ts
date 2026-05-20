import { describe, expect, it, beforeEach } from "vitest";
import { useProjectStore } from "@/stores/project";
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
    expect(after[0].words).toHaveLength(2);
    expect(after[1].words).toHaveLength(2);

    useProjectStore.getState().undo();
    const reverted = useProjectStore.getState().lines;
    expect(reverted[0].words).toHaveLength(1);
    expect(reverted[1].words).toHaveLength(1);
  });

  it("source word splits even when there are no other matches", () => {
    const lines = [createLine({ id: "l1", words: [{ text: "alone", begin: 0, end: 1 }] })];
    useProjectStore.getState().setLinesWithHistory(lines);

    useProjectStore.getState().splitSyllablesAcrossIdenticalWordsWithHistory({
      source: { lineId: "l1", wordIndex: 0, type: "word" },
      splitPoints: [2],
      caseInsensitive: false,
    });

    expect(useProjectStore.getState().lines[0].words).toHaveLength(2);
  });
});
