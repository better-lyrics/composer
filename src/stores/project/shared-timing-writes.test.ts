/**
 * @vitest-environment node
 */
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { subscribeSharedTimingCopied } from "@/lib/shared-timing-signals";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine } from "@/test/factories";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const chorus = (instanceIdx: number, begin: number) =>
  createLine({
    id: `c${instanceIdx}`,
    text: "I want",
    words: [
      { text: "I ", begin, end: begin + 0.4 },
      { text: "want", begin: begin + 0.5, end: begin + 1 },
    ],
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
  });

function seed(group: LinkGroup, lines: LyricLine[] = [chorus(0, 10), chorus(1, 40)]) {
  useProjectStore.setState({ groups: [group], lines, isDirtySinceHistory: true });
}

function nudgedSecondWord(delta: number): WordTiming[] {
  const words = useProjectStore.getState().lines[0].words ?? [];
  return words.map((word, i) => (i === 1 ? { ...word, begin: word.begin + delta, end: word.end + delta } : word));
}

function secondWordBegin(id: string) {
  return useProjectStore.getState().lines.find((line) => line.id === id)?.words?.[1]?.begin;
}

const TIMING_WRITE = { deriveText: false, propagateToSiblings: false } as const;
let unsubscribe: (() => void) | undefined;

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = undefined;
});

describe("shared timing in history writes", () => {
  it("updateLinesWithHistory copies a timing edit to the placed sibling", () => {
    seed(createGroup({ id: "g1", sharesTiming: true }));
    useProjectStore.getState().updateLinesWithHistory([{ id: "c0", updates: { words: nudgedSecondWord(0.2) } }], TIMING_WRITE);
    expect(secondWordBegin("c1")).toBeCloseTo(40.7, 6);
  });

  it("updateLineWithHistory copies a timing edit to the placed sibling", () => {
    seed(createGroup({ id: "g1", sharesTiming: true }));
    useProjectStore.getState().updateLineWithHistory("c0", { words: nudgedSecondWord(0.2) }, TIMING_WRITE);
    expect(secondWordBegin("c1")).toBeCloseTo(40.7, 6);
  });

  it("makes the edit and its copies one undo step", () => {
    seed(createGroup({ id: "g1", sharesTiming: true }));
    useProjectStore.getState().updateLinesWithHistory([{ id: "c0", updates: { words: nudgedSecondWord(0.2) } }], TIMING_WRITE);
    useProjectStore.getState().undo();
    expect(secondWordBegin("c0")).toBeCloseTo(10.5, 6);
    expect(secondWordBegin("c1")).toBeCloseTo(40.5, 6);
  });

  it("notifies once with the touched group ids", () => {
    seed(createGroup({ id: "g1", sharesTiming: true }));
    const notified: (readonly string[])[] = [];
    unsubscribe = subscribeSharedTimingCopied((groupIds) => notified.push(groupIds));
    useProjectStore.getState().updateLinesWithHistory([{ id: "c0", updates: { words: nudgedSecondWord(0.2) } }], TIMING_WRITE);
    expect(notified).toEqual([["g1"]]);
  });

  describe("edge cases", () => {
    it("leaves the sibling of an old group where it was", () => {
      seed(createGroup({ id: "g1" }));
      useProjectStore.getState().updateLinesWithHistory([{ id: "c0", updates: { words: nudgedSecondWord(0.2) } }], TIMING_WRITE);
      expect(secondWordBegin("c1")).toBeCloseTo(40.5, 6);
    });

    it("rejects a batch that would move a copy below zero", () => {
      seed(createGroup({ id: "g1", sharesTiming: true }), [chorus(0, 10), chorus(1, 0.05)]);
      const before = useProjectStore.getState();
      const words = (before.lines[0].words ?? []).map((word, i) => (i === 0 ? { ...word, begin: 9.8 } : word));
      before.updateLinesWithHistory([{ id: "c0", updates: { words } }], TIMING_WRITE);
      const after = useProjectStore.getState();
      expect(after.lines).toBe(before.lines);
      expect(after.history).toBe(before.history);
    });

    it("does not notify when nothing is copied", () => {
      seed(createGroup({ id: "g1" }));
      const notified: (readonly string[])[] = [];
      unsubscribe = subscribeSharedTimingCopied((groupIds) => notified.push(groupIds));
      useProjectStore.getState().updateLinesWithHistory([{ id: "c0", updates: { words: nudgedSecondWord(0.2) } }], TIMING_WRITE);
      expect(notified).toEqual([]);
    });
  });
});
