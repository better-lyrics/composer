import { describe, expect, it } from "vitest";
import { UNBOUNDED_TIME_RANGE } from "@/domain/group/shared-timing";
import type { LyricLine } from "@/domain/line/model";
import type { WordSelection } from "@/domain/selection/model";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine } from "@/test/factories";
import { writeStepKey } from "@/utils/timing/step-key-write";

const word = (text: string, begin: number, end: number) => ({ text, begin, end });
const chorus = (id: string, instanceIdx: number, begin: number): LyricLine =>
  createLine({
    id,
    text: "Hold the light",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      word("Hold ", begin, begin + 0.4),
      word("the ", begin + 0.44, begin + 0.6),
      word("light", begin + 0.66, begin + 1.5),
    ],
  });
const slot = (lineId: string, lineIndex: number, wordIndex: number): WordSelection => ({
  lineId,
  lineIndex,
  wordIndex,
  type: "word",
});
const store = () => useProjectStore.getState();
const lineById = (id: string) => store().lines.find((line) => line.id === id);
const press = (cursor: WordSelection, startNext: WordSelection | null, time: number) =>
  writeStepKey({
    lines: store().lines,
    cursor,
    startNext,
    key: "step",
    time,
    minDuration: 0.05,
    rangeOf: () => UNBOUNDED_TIME_RANGE,
    updateLinesWithHistory: store().updateLinesWithHistory,
  });

describe("writeStepKey", () => {
  it("writes one step as one undo step", () => {
    useProjectStore.setState({ lines: [chorus("c0", 0, 28)], groups: [] });
    const before = lineById("c0")?.words;
    expect(press(slot("c0", 0, 0), slot("c0", 0, 1), 28.5)).toBeNull();
    expect(lineById("c0")?.words?.[1].begin).toBe(28.5);
    store().undo();
    expect(lineById("c0")?.words).toEqual(before);
  });

  it("keeps a shared instance in step with the written instance", () => {
    useProjectStore.setState({
      lines: [chorus("c0", 0, 28), chorus("c1", 1, 40)],
      groups: [createGroup({ id: "g1", sharesTiming: true })],
    });
    press(slot("c0", 0, 0), slot("c0", 0, 1), 28.5);
    expect(lineById("c1")?.words?.[0].end).toBeCloseTo(40.5);
    expect(lineById("c1")?.words?.[1].begin).toBeCloseTo(40.5);
  });

  it("ends a line's last word and starts the next line at the same time, as one undo step", () => {
    const next = createLine({
      id: "n",
      text: "Fold the night",
      words: [word("Fold ", 33, 33.4), word("the ", 33.5, 34)],
    });
    useProjectStore.setState({ lines: [chorus("c0", 0, 28), next], groups: [] });
    const before = store().lines;
    expect(press(slot("c0", 0, 2), slot("n", 1, 0), 29.9)).toBeNull();
    expect(lineById("c0")?.words?.[2].end).toBe(29.9);
    expect(lineById("n")?.words?.[0]).toMatchObject({ begin: 29.9, end: 33.4 });
    store().undo();
    expect(store().lines.map((line) => line.words)).toEqual(before.map((line) => line.words));
  });

  it("only ends the word when there is no word to chain into, and leaves the next line's start alone", () => {
    const echo = createLine({
      id: "e",
      text: "Hold the light",
      words: [word("Hold ", 30, 30.4), word("light", 30.4, 31)],
      backgroundText: "oh",
      backgroundWords: [word("oh", 30.2, 30.6)],
    });
    const next = createLine({
      id: "n",
      text: "Fold the night",
      words: [word("Fold ", 33, 33.4), word("the ", 33.5, 34)],
    });
    useProjectStore.setState({ lines: [echo, next], groups: [] });
    press({ lineId: "e", lineIndex: 0, wordIndex: 0, type: "bg" }, null, 30.7);
    expect(lineById("e")?.backgroundWords?.[0].end).toBe(30.7);
    expect(lineById("n")?.words?.[0].begin).toBe(33);
  });
});
