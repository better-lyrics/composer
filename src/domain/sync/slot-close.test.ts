import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { type SyncGesture, commitGesture } from "@/domain/sync/commit-gesture";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

const word = (text: string, begin: number, end: number) => ({ text, begin, end });
const DUR = 0.3;

function run(lines: LyricLine[], gesture: SyncGesture, cursor: [number, number], time: number) {
  return commitGesture(lines, gesture, {
    cursor: { lineIndex: cursor[0], wordIndex: cursor[1] },
    jumped: false,
    time,
    defaultWordDuration: DUR,
  });
}

function updatedIds(lines: LyricLine[], gesture: SyncGesture, cursor: [number, number], time: number) {
  return run(lines, gesture, cursor, time)?.lineUpdates.map((update) => update.id);
}

describe("how a gesture ends the previous slot", () => {
  it("regression: re-recording a line inside the previous line's set last word leaves that word alone", () => {
    const lines = [
      createLine({ id: "l0", text: "a b", words: [word("a ", 1, 2), word("b", 2, 9)] }),
      createLine({ id: "l1", text: "c d", words: [word("c ", 6, 6.5), word("d", 6.5, 7)] }),
    ];
    expect(updatedIds(lines, "tap-word", [1, 0], 5)).toEqual(["l1"]);
    expect(updatedIds(lines, "hold-start", [1, 0], 5)).toEqual(["l1"]);
  });

  it("moves a previous end that was joined to the start being re-recorded", () => {
    const lines = [
      createLine({ id: "l0", text: "a b", words: [word("a ", 1, 2), word("b", 2, 6)] }),
      createLine({ id: "l1", text: "c d", words: [word("c ", 6, 6.5), word("d", 6.5, 7)] }),
    ];
    expect(run(lines, "tap-word", [1, 0], 5.5)?.lineUpdates).toContainEqual({
      id: "l0",
      updates: { words: [word("a ", 1, 2), word("b", 2, 5.5)] },
    });
  });

  it("keeps the gap a held word left before the next tap, across lines and inside a line", () => {
    const acrossLines = [
      createLine({ id: "l0", text: "a b", words: [word("a ", 1, 2), word("b", 2, 2.8)] }),
      createLine({ id: "l1", text: "c d" }),
    ];
    expect(updatedIds(acrossLines, "tap-word", [1, 0], 3.5)).toEqual(["l1"]);

    const insideLine = [createLine({ id: "l0", text: "a b c", words: [word("a ", 1, 2), word("b ", 2, 2.8)] })];
    const commit = run(insideLine, "tap-word", [0, 2], 3.5);
    expect(commit?.lineUpdates[0].updates.words?.slice(0, 2)).toEqual([word("a ", 1, 2), word("b ", 2, 2.8)]);
  });

  it("still cuts a set word inside the same line at the tap, so words never overlap", () => {
    const lines = [createLine({ id: "l0", text: "a b c", words: [word("a ", 1, 2), word("b ", 2, 5)] })];
    expect(run(lines, "tap-word", [0, 2], 3)?.lineUpdates[0].updates.words?.[1]).toEqual(word("b ", 2, 3));
  });

  it("regression: a Line mode pass over timed lines ends each line at the next tap", () => {
    const lines = [
      createLine({ id: "l0", text: "first", begin: 10, end: 12 }),
      createLine({ id: "l1", text: "second", begin: 12, end: 15 }),
    ];
    const first = run(lines, "tap-line", [0, 0], 11);
    const shifted = lines.map((line) => {
      const update = first?.lineUpdates.find((u) => u.id === line.id);
      return update ? reconcileLine({ ...line, ...update.updates }) : line;
    });
    expect(run(shifted, "tap-line", [1, 0], 12.5)?.lineUpdates).toContainEqual({ id: "l0", updates: { end: 12.5 } });
  });
});
