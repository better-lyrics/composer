import type { LyricLine } from "@/domain/line/model";
import { type AnchorUndo, anchorGesture, storedSyncPosition } from "@/domain/sync/anchor-gesture";
import { type SyncGesture, commitGesture } from "@/domain/sync/commit-gesture";
import type { SyncCursor } from "@/domain/sync/cursor";
import { createGroup, createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

const chorus = (instanceIdx: number, templateLineIdx: number, begin?: number) =>
  createLine({
    id: `c${instanceIdx}-${templateLineIdx}`,
    text: "I want",
    groupId: "g1",
    instanceIdx,
    templateLineIdx,
    ...(begin === undefined
      ? {}
      : {
          words: [
            { text: "I ", begin, end: begin + 0.4 },
            { text: "want", begin: begin + 0.5, end: begin + 1 },
          ],
        }),
  });

const verse = (id: string, begin?: number) =>
  createLine({
    id,
    text: "Walking home",
    ...(begin === undefined
      ? {}
      : {
          words: [
            { text: "Walking ", begin, end: begin + 0.5 },
            { text: "home", begin: begin + 0.6, end: begin + 1 },
          ],
        }),
  });

const sharing = [createGroup({ id: "g1", sharesTiming: true })];
const song = (secondBegin?: number): LyricLine[] => [
  chorus(0, 0, 10),
  chorus(0, 1, 11),
  verse("v1", 20),
  chorus(1, 0, secondBegin),
  chorus(1, 1, secondBegin === undefined ? undefined : secondBegin + 1),
  verse("v2"),
];

function gestureAt(lines: LyricLine[], gesture: SyncGesture, cursor: SyncCursor, time: number) {
  const ctx = { cursor, jumped: false, time, defaultWordDuration: 0.5, groups: sharing };
  return { commit: commitGesture(lines, gesture, ctx), anchor: anchorGesture(lines, gesture, ctx) };
}

describe("anchorGesture", () => {
  it("places the instance at the tapped time and resumes after it", () => {
    const { anchor } = gestureAt(song(), "tap-word", { lineIndex: 3, wordIndex: 0 }, 40);
    expect(anchor).toMatchObject({
      groupId: "g1",
      instanceIdx: 1,
      start: 40,
      anchorCursor: { lineIndex: 3, wordIndex: 0 },
      resumeCursor: { lineIndex: 5, wordIndex: 0 },
    });
  });

  it("keeps the closing update of the previous slot and drops the anchor line's own write", () => {
    const { anchor } = gestureAt(song(), "tap-word", { lineIndex: 3, wordIndex: 0 }, 40);
    expect(anchor?.precedingUpdates.map((update) => update.id)).toEqual(["v1"]);
  });

  it("uses the line begin in line mode", () => {
    const { anchor } = gestureAt(song(), "tap-line", { lineIndex: 3, wordIndex: 0 }, 41);
    expect(anchor?.start).toBe(41);
  });

  it("anchors a hold at the held begin", () => {
    const { anchor } = gestureAt(song(), "hold-start", { lineIndex: 3, wordIndex: 0 }, 42);
    expect(anchor?.start).toBe(42);
  });

  it("anchors a hold-tap at the word it opens", () => {
    const heldVerse = createLine({
      id: "v1",
      text: "Walking home",
      words: [
        { text: "Walking ", begin: 20, end: 20.5 },
        { text: "home", begin: 38, end: 38 },
      ],
    });
    const held = song().map((line) => (line.id === "v1" ? heldVerse : line));
    const { anchor } = gestureAt(held, "hold-tap", { lineIndex: 2, wordIndex: 1 }, 39);
    expect(anchor).toMatchObject({ start: 39, anchorCursor: { lineIndex: 3, wordIndex: 0 } });
    expect(anchor?.precedingUpdates.map((update) => update.id)).toEqual(["v1"]);
  });

  it("moves an instance that is already placed", () => {
    const { anchor } = gestureAt(song(50), "tap-word", { lineIndex: 3, wordIndex: 0 }, 44);
    expect(anchor?.start).toBe(44);
  });

  describe("edge cases", () => {
    it("is null for a hold release", () => {
      const held = createLine({
        id: "c1-0",
        text: "I want",
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [{ text: "I ", begin: 40, end: 40 }],
      });
      const lines = song().map((line) => (line.id === "c1-0" ? held : line));
      expect(gestureAt(lines, "hold-end", { lineIndex: 3, wordIndex: 0 }, 41).anchor).toBeNull();
    });

    it("is null away from an anchor slot", () => {
      expect(gestureAt(song(), "tap-word", { lineIndex: 5, wordIndex: 0 }, 60).anchor).toBeNull();
    });

    it("is null for the first pass over the first instance", () => {
      const lines = [chorus(0, 0), chorus(0, 1), verse("v1"), chorus(1, 0), chorus(1, 1)];
      expect(gestureAt(lines, "tap-word", { lineIndex: 0, wordIndex: 0 }, 10).anchor).toBeNull();
    });

    it("takes the floored begin of an early tap", () => {
      const { anchor } = gestureAt(song(), "tap-word", { lineIndex: 3, wordIndex: 0 }, 5);
      expect(anchor?.clampedTo).toBe(20.6);
      expect(anchor?.start).toBe(20.6);
    });
  });

  describe("regressions", () => {
    it("regression: moves a placed instance earlier than the room its old position leaves", () => {
      const { commit, anchor } = gestureAt(song(60), "tap-word", { lineIndex: 3, wordIndex: 0 }, 40);
      expect(commit?.clampedTo).toBe(50);
      expect(anchor).toMatchObject({ start: 40, clampedTo: null });
    });
  });
});

describe("storedSyncPosition", () => {
  const resume = { lineIndex: 5, wordIndex: 0 };
  const before = { name: "before placing" };
  const placed = { name: "placed" };
  const anchorUndo: AnchorUndo = {
    resume,
    anchor: { lineIndex: 3, wordIndex: 0 },
    jumped: false,
    placedEntry: placed,
    previousEntry: before,
  };
  const at = (history: object[], historyIndex: number) => ({ history, historyIndex });

  it("returns the anchor slot once the placing is undone", () => {
    expect(
      storedSyncPosition({ position: resume, jumpedToPosition: true, anchorUndo }, at([before, placed], 0)),
    ).toEqual({
      position: { lineIndex: 3, wordIndex: 0 },
      jumped: false,
    });
  });

  it("keeps the resume position while the placing stands", () => {
    expect(
      storedSyncPosition({ position: resume, jumpedToPosition: true, anchorUndo }, at([before, placed], 1)),
    ).toEqual({
      position: resume,
      jumped: true,
    });
  });

  it("keeps the resume position after later edits", () => {
    const state = { position: resume, jumpedToPosition: true, anchorUndo };
    expect(storedSyncPosition(state, at([before, placed, { name: "edit" }], 2)).position).toBe(resume);
  });

  describe("regressions", () => {
    it("regression: returns the anchor slot when an edit follows the undo", () => {
      const state = { position: resume, jumpedToPosition: true, anchorUndo };
      expect(storedSyncPosition(state, at([before, { name: "edit" }], 1)).position).toEqual({
        lineIndex: 3,
        wordIndex: 0,
      });
    });

    it("regression: keeps the resume position when a full history undoes a later edit", () => {
      const state = { position: resume, jumpedToPosition: true, anchorUndo };
      expect(storedSyncPosition(state, at([placed, { name: "a" }, { name: "b" }], 1)).position).toBe(resume);
    });

    it("keeps the resume position once the placing is too old to undo", () => {
      const state = { position: resume, jumpedToPosition: true, anchorUndo };
      expect(storedSyncPosition(state, at([{ name: "a" }, { name: "b" }], 0)).position).toBe(resume);
    });
  });

  describe("invariants", () => {
    it("ignores the record once the cursor has moved", () => {
      const moved = { lineIndex: 5, wordIndex: 0 };
      expect(storedSyncPosition({ position: moved, anchorUndo }, at([before, placed], 0))).toEqual({
        position: moved,
        jumped: false,
      });
    });

    it("reads the stored position when there is no record", () => {
      expect(storedSyncPosition({ position: resume }, at([], 0))).toEqual({ position: resume, jumped: false });
    });
  });
});
