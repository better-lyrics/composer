import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { mainTrack, roleWords, timedSyllables } from "@/domain/line/track";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord, createWords } from "@/test/factories";
import { applyCrossLineMove, applySameLineReorder, type DragData } from "@/views/timeline/drag-handlers";

// -- Fixtures -----------------------------------------------------------------

const DURATION = 20;

function chorus(id: string, instanceIdx: number, begin: number): LyricLine {
  return createLine({
    id,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: createWords([
      { text: "go", sep: " ", begin, end: begin + 1 },
      { text: "now", begin: begin + 2, end: begin + 3 },
    ]),
    backgroundText: "hey",
    backgroundWords: [createWord({ text: "hey", begin: begin + 1, end: begin + 1.5 })],
  });
}

function seed(sharesTiming: boolean): void {
  useProjectStore.setState({
    lines: [chorus("c0", 0, 3), chorus("c1", 1, 10), chorus("c2", 2, 16)],
    groups: [createGroup({ id: "g1", ...(sharesTiming ? { sharesTiming: true } : {}) })],
  });
}

const store = () => useProjectStore.getState();
const lineById = (id: string) => store().lines.find((line) => line.id === id);

function dragOf(trackType: "word" | "bg", wordIndex: number, begin: number, end: number): DragData {
  return { lineId: "c1", lineIndex: 1, wordIndex, trackType, text: "go ", begin, end };
}

function reorderFirstWord(timeDelta: number): void {
  const selection = [{ lineId: "c1", lineIndex: 1, wordIndex: 0, type: "word" as const }];
  applySameLineReorder(selection, store().lines, timeDelta, DURATION);
}

// -- Tests --------------------------------------------------------------------

describe("applySameLineReorder with a shared time range", () => {
  it("stops a dragged word where the earliest instance reaches zero", () => {
    seed(true);

    reorderFirstWord(-9);

    expect(timedSyllables(mainTrack(lineById("c1")!))[0]).toMatchObject({ begin: 7, end: 8 });
    expect(timedSyllables(mainTrack(lineById("c0")!))[0]).toMatchObject({ begin: 0, end: 1 });
  });

  describe("regressions", () => {
    it("regression: a line of an old group still stops at zero", () => {
      seed(false);

      reorderFirstWord(-15);

      expect(timedSyllables(mainTrack(lineById("c1")!))[0]).toMatchObject({ begin: 0, end: 1 });
      expect(timedSyllables(mainTrack(lineById("c0")!))[0]).toMatchObject({ begin: 3, end: 4 });
    });
  });
});

describe("applyCrossLineMove with a shared time range", () => {
  it("stops a word moved to the other track at the target range end", () => {
    seed(true);
    const target = lineById("c1");
    if (!target) throw new Error("missing c1");

    applyCrossLineMove({
      activeData: dragOf("bg", 0, 11, 11.5),
      targetLine: target,
      targetTrack: "word",
      wordsToMove: [{ lineId: "c1", lineIndex: 1, wordIndex: 0, type: "bg" }],
      lines: store().lines,
      timeDelta: 2.8,
      duration: DURATION,
    });

    const moved = roleWords(lineById("c1"), "main")?.at(-1);
    const copied = roleWords(lineById("c2"), "main")?.at(-1);
    expect(moved?.begin).toBeCloseTo(13.8, 6);
    expect(moved?.end).toBe(14);
    expect(copied?.begin).toBeCloseTo(19.8, 6);
    expect(copied?.end).toBe(20);
  });
});
