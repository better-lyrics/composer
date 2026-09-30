import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { type SyncGesture, commitGesture } from "@/domain/sync/commit-gesture";
import { createGroup, createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

const word = (text: string, begin: number, end: number) => ({ text, begin, end });
const sharing = [createGroup({ id: "g1", sharesTiming: true })];

function chorusLine(id: string, instanceIdx: number, timing: Partial<LyricLine> = {}): LyricLine {
  return createLine({ id, text: "chorus", groupId: "g1", instanceIdx, templateLineIdx: 0, ...timing });
}

function run(
  lines: LyricLine[],
  gesture: SyncGesture,
  lineIndex: number,
  time: number,
  groups: readonly LinkGroup[] = sharing,
) {
  return commitGesture(lines, gesture, {
    cursor: { lineIndex, wordIndex: 0 },
    jumped: false,
    time,
    defaultWordDuration: 0.3,
    groups,
  });
}

function updateOf(lines: LyricLine[], gesture: SyncGesture, lineIndex: number, time: number, groups = sharing) {
  return run(lines, gesture, lineIndex, time, groups)?.lineUpdates.find((u) => u.id === lines[lineIndex].id)?.updates;
}

describe("commitGesture with a shared time range", () => {
  it("stops a line tap where the earliest shared instance reaches zero", () => {
    const lines = [
      chorusLine("c0", 0, { begin: 3, end: 5 }),
      createLine({ id: "x", text: "verse", begin: 6, end: 7 }),
      chorusLine("c1", 1, { begin: 10, end: 12 }),
    ];
    const commit = run(lines, "tap-line", 2, 6.5);
    expect(commit?.lineUpdates).toContainEqual({ id: "c1", updates: { begin: 7, end: 9 } });
    expect(commit?.clampedTo).toBe(7);
  });

  it("closes the previous slot at the clamped begin", () => {
    const lines = [
      chorusLine("c0", 0, { begin: 3, end: 5 }),
      createLine({ id: "x", text: "verse", begin: 6, end: 6 }),
      chorusLine("c1", 1, { begin: 10, end: 12 }),
    ];
    expect(run(lines, "tap-line", 2, 6.5)?.lineUpdates).toContainEqual({ id: "x", updates: { end: 7 } });
  });

  it("stops a word tap at the start of the range", () => {
    const lines = [
      chorusLine("c0", 0, { words: [word("chorus", 3, 5)] }),
      createLine({ id: "x", text: "verse", begin: 6, end: 7 }),
      chorusLine("c1", 1, { words: [word("chorus", 10, 12)] }),
    ];
    expect(updateOf(lines, "tap-word", 2, 6.5)?.words?.[0].begin).toBe(7);
  });

  describe("regressions", () => {
    it("regression: a tap after a placed shared instance never stretches its last word, even after an undo", () => {
      const lines = [
        chorusLine("c0", 0, { words: [word("chorus", 3, 5)] }),
        createLine({ id: "x", text: "verse", words: [word("verse", 6, 7)] }),
        chorusLine("c1", 1, { words: [word("chorus", 10, 12)] }),
        createLine({ id: "y", text: "every" }),
      ];
      const commit = run(lines, "tap-word", 3, 20);
      expect(commit?.lineUpdates.map((update) => update.id)).toEqual(["y"]);
    });

    it("regression: a tap before the end of a placed shared instance only trims the overlap", () => {
      const lines = [
        chorusLine("c0", 0, { words: [word("chorus", 3, 5)] }),
        createLine({ id: "x", text: "verse", words: [word("verse", 6, 7)] }),
        chorusLine("c1", 1, { words: [word("chorus", 10, 12)] }),
        createLine({ id: "y", text: "every" }),
      ];
      expect(run(lines, "tap-word", 3, 11)?.lineUpdates).toContainEqual({
        id: "c1",
        updates: { words: [word("chorus", 10, 11)] },
      });
    });

    it("still closes the last word of the first shared instance at the tap", () => {
      const lines = [
        chorusLine("c0", 0, { words: [word("chorus", 3, 3.3)] }),
        createLine({ id: "y", text: "every" }),
        chorusLine("c1", 1),
      ];
      expect(run(lines, "tap-word", 1, 6)?.lineUpdates).toContainEqual({
        id: "c0",
        updates: { words: [word("chorus", 3, 6)] },
      });
    });

    it("moves a line of an old group to the tap, as before", () => {
      const lines = [
        chorusLine("c0", 0, { begin: 3, end: 5 }),
        createLine({ id: "x", text: "verse", begin: 6, end: 7 }),
        chorusLine("c1", 1, { begin: 10, end: 12 }),
      ];
      const commit = run(lines, "tap-line", 2, 6.5, [createGroup({ id: "g1" })]);
      expect(commit?.lineUpdates).toContainEqual({ id: "c1", updates: { begin: 6.5, end: 8.5 } });
      expect(commit?.clampedTo).toBeNull();
    });

    it("uses the whole song when no groups are given", () => {
      const lines = [createLine({ id: "x", text: "verse", begin: 6, end: 7 }), chorusLine("c1", 1)];
      const commit = commitGesture(lines, "tap-line", {
        cursor: { lineIndex: 1, wordIndex: 0 },
        jumped: false,
        time: 6.5,
        defaultWordDuration: 0.3,
      });
      expect(commit?.lineUpdates).toContainEqual({ id: "c1", updates: { begin: 6.5, end: 6.5 } });
    });
  });

  describe("edge cases", () => {
    it("gives a line of an unplaced instance the whole song", () => {
      const lines = [
        chorusLine("c0", 0, { begin: 3, end: 5 }),
        chorusLine("c2", 2, { begin: 20, end: 22 }),
        createLine({ id: "x", text: "verse", begin: 6, end: 7 }),
        createLine({ id: "c1", text: "chorus", groupId: "g1", instanceIdx: 1, templateLineIdx: 1 }),
      ];
      expect(updateOf(lines, "tap-line", 3, 6.5)).toEqual({ begin: 6.5, end: 6.5 });
    });
  });
});
