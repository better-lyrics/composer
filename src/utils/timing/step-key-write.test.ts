import { describe, expect, it } from "vitest";
import { pressStepKey } from "@/domain/commands/word-timing";
import { UNBOUNDED_TIME_RANGE } from "@/domain/group/shared-timing";
import type { LyricLine } from "@/domain/line/model";
import { backgroundTrack, mainTrack, roleWords, timedSyllables, type WordTrack } from "@/domain/line/track";
import { type ResolvedAddress, resolvedAt, toAddress } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine } from "@/test/factories";
import { planStepKey } from "@/utils/timing/step-key-write";

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
const slot = (_lineId: string, lineIndex: number, wordIndex: number, type: WordTrack = "word"): ResolvedAddress => {
  const resolved = resolvedAt(useProjectStore.getState().lines, lineIndex, type, wordIndex);
  if (!resolved) throw new Error("no word there");
  return resolved;
};
const store = () => useProjectStore.getState();
const lineById = (id: string) => store().lines.find((line) => line.id === id);
const press = (cursor: ResolvedAddress, startNext: ResolvedAddress | null, time: number) => {
  const step = { key: "step" as const, time, minDuration: 0.05 };
  const plan = planStepKey({
    lines: store().lines,
    groups: store().groups,
    cursor,
    startNext,
    ...step,
    rangeOf: () => UNBOUNDED_TIME_RANGE,
  });
  if (plan?.kind !== "written") return plan;
  const next = startNext && toAddress(startNext);
  store().commit(
    pressStepKey({ cursor: toAddress(cursor), startNext: next, ...step, duration: Number.POSITIVE_INFINITY }),
  );
  return { kind: plan.kind, endedPrevious: plan.endedPrevious };
};

describe("writeStepKey", () => {
  it("writes one step as one undo step", () => {
    useProjectStore.setState({ lines: [chorus("c0", 0, 28)], groups: [] });
    const before = roleWords(lineById("c0"), "main");
    expect(press(slot("c0", 0, 0), slot("c0", 0, 1), 28.5)).toEqual({ kind: "written" });
    expect(timedSyllables(mainTrack(lineById("c0")!))[1].begin).toBe(28.5);
    store().undo();
    expect(timedSyllables(mainTrack(lineById("c0")!))).toEqual(before);
  });

  it("keeps a shared instance in step with the written instance", () => {
    useProjectStore.setState({
      lines: [chorus("c0", 0, 28), chorus("c1", 1, 40)],
      groups: [createGroup({ id: "g1", sharesTiming: true })],
    });
    press(slot("c0", 0, 0), slot("c0", 0, 1), 28.5);
    expect(timedSyllables(mainTrack(lineById("c1")!))[0].end).toBeCloseTo(40.5);
    expect(timedSyllables(mainTrack(lineById("c1")!))[1].begin).toBeCloseTo(40.5);
  });

  it("regression: never chains into another instance of the same shared group", () => {
    const verse = (id: string, instanceIdx: number, begin: number) => ({
      ...chorus(id, instanceIdx, begin),
      templateLineIdx: 1,
    });
    useProjectStore.setState({
      lines: [chorus("a0", 0, 28), verse("a1", 0, 30), chorus("b0", 1, 40), verse("b1", 1, 42)],
      groups: [createGroup({ id: "g1", sharesTiming: true })],
    });
    const before = roleWords(lineById("a0"), "main");
    expect(press(slot("a1", 1, 2), slot("b0", 2, 0), 31.9)).toEqual({ kind: "written" });
    expect(timedSyllables(mainTrack(lineById("a1")!))[2].end).toBe(31.9);
    expect(timedSyllables(mainTrack(lineById("a0")!))).toEqual(before);
    expect(timedSyllables(mainTrack(lineById("b0")!))[0].begin).toBeCloseTo(40);
  });

  it("still chains into a detached line, which keeps its own timing", () => {
    useProjectStore.setState({
      lines: [chorus("a0", 0, 28), { ...chorus("b0", 1, 40), detached: true }],
      groups: [createGroup({ id: "g1", sharesTiming: true })],
    });
    expect(press(slot("a0", 0, 2), slot("b0", 1, 0), 29.9)).toEqual({ kind: "written" });
    expect(timedSyllables(mainTrack(lineById("b0")!))[0].begin).toBe(29.9);
  });

  it("ends a line's last word and starts the next line at the same time, as one undo step", () => {
    const next = createLine({
      id: "n",
      text: "Fold the night",
      words: [word("Fold ", 33, 33.4), word("the ", 33.5, 34)],
    });
    useProjectStore.setState({ lines: [chorus("c0", 0, 28), next], groups: [] });
    const before = store().lines;
    expect(press(slot("c0", 0, 2), slot("n", 1, 0), 29.9)).toEqual({ kind: "written" });
    expect(timedSyllables(mainTrack(lineById("c0")!))[2].end).toBe(29.9);
    expect(timedSyllables(mainTrack(lineById("n")!))[0]).toMatchObject({ begin: 29.9, end: 33.4 });
    store().undo();
    expect(store().lines.map((line) => roleWords(line, "main"))).toEqual(before.map((line) => roleWords(line, "main")));
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
    press(slot("e", 0, 0, "bg"), null, 30.7);
    expect(timedSyllables(backgroundTrack(lineById("e")!))[0].end).toBe(30.7);
    expect(timedSyllables(mainTrack(lineById("n")!))[0].begin).toBe(33);
  });

  it("regression: a step from a main word into a background word on the same line writes both", () => {
    useProjectStore.setState({
      lines: [
        createLine({
          id: "c0",
          text: "Hold the light",
          words: [word("Hold ", 28, 28.4), word("the ", 28.44, 28.6), word("light", 28.66, 29.5)],
          backgroundText: "ooh",
          backgroundWords: [word("ooh", 29.8, 30.4)],
        }),
      ],
      groups: [],
    });
    press(slot("c0", 0, 2), slot("c0", 0, 0, "bg"), 29.6);
    const written = lineById("c0")!;
    expect(timedSyllables(mainTrack(written))[2].end).toBe(29.6);
    expect(timedSyllables(backgroundTrack(written))[0].begin).toBe(29.6);
  });
});
