import type { LyricLine } from "@/domain/line/model";
import { UNBOUNDED_TIME_RANGE } from "@/domain/group/shared-timing";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine } from "@/test/factories";
import { stepWordWrite } from "@/utils/timing/word-timing";
import { describe, expect, it } from "vitest";

const word = (text: string, begin: number, end: number) => ({ text, begin, end });
const chorus = (id: string, instanceIdx: number, begin: number): LyricLine =>
  createLine({
    id, text: "Hold the light", groupId: "g1", instanceIdx, templateLineIdx: 0,
    words: [word("Hold ", begin, begin + 0.4), word("the ", begin + 0.44, begin + 0.6), word("light", begin + 0.66, begin + 1.5)],
  });
const store = () => useProjectStore.getState();
const lineById = (id: string) => store().lines.find((line) => line.id === id);
const press = (time: number) =>
  stepWordWrite({
    lines: store().lines, lineIdx: 0, wordIdx: 0, key: "step", time, minDuration: 0.05,
    range: UNBOUNDED_TIME_RANGE, updateLineWithHistory: store().updateLineWithHistory,
  });

describe("stepWordWrite", () => {
  it("writes one step as one undo step", () => {
    useProjectStore.setState({ lines: [chorus("c0", 0, 28)], groups: [] });
    const before = lineById("c0")?.words;
    expect(press(28.5)).toBeNull();
    expect(lineById("c0")?.words?.[1].begin).toBe(28.5);
    store().undo();
    expect(lineById("c0")?.words).toEqual(before);
  });

  it("keeps a shared instance in step with the written instance", () => {
    useProjectStore.setState({ lines: [chorus("c0", 0, 28), chorus("c1", 1, 40)], groups: [createGroup({ id: "g1", sharesTiming: true })] });
    press(28.5);
    expect(lineById("c1")?.words?.[0].end).toBeCloseTo(40.5);
    expect(lineById("c1")?.words?.[1].begin).toBeCloseTo(40.5);
  });
});
