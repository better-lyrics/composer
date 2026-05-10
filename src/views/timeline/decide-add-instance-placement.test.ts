/**
 * @vitest-environment node
 */
import type { LineTemplate, LyricLine } from "@/stores/project";
import { describe, expect, it } from "vitest";
import { decideAddInstancePlacement, templateDuration } from "./decide-add-instance-placement";

const wt = (text: string, relativeBegin: number, relativeEnd: number) => ({ text, relativeBegin, relativeEnd });

const template: LineTemplate[] = [
  {
    text: "I love you",
    agentId: "v1",
    relativeBegin: 0,
    relativeEnd: 1,
    words: [wt("I ", 0, 0.3), wt("love ", 0.3, 0.6), wt("you", 0.6, 1)],
  },
];

const wordSyncedLine = (id: string, begin: number, end: number): LyricLine => ({
  id,
  text: "x",
  agentId: "v1",
  words: [{ text: "x", begin, end }],
});

const lineSyncedLine = (id: string, begin: number, end: number): LyricLine => ({
  id,
  text: "x",
  agentId: "v1",
  begin,
  end,
});

describe("templateDuration", () => {
  it("returns the span between earliest begin and latest end across all template words", () => {
    expect(templateDuration(template)).toBeCloseTo(1);
  });

  it("returns 0 for an empty template", () => {
    expect(templateDuration([])).toBe(0);
  });

  it("includes background words in the duration calculation", () => {
    const t: LineTemplate[] = [
      {
        text: "x",
        agentId: "v1",
        words: [wt("x", 0, 0.5)],
        backgroundWords: [wt("ah", 0.3, 0.9)],
      },
    ];
    expect(templateDuration(t)).toBeCloseTo(0.9);
  });

  it("uses line-level relativeBegin/End when no words present", () => {
    const t: LineTemplate[] = [{ text: "x", agentId: "v1", relativeBegin: 0, relativeEnd: 2 }];
    expect(templateDuration(t)).toBe(2);
  });
});

describe("decideAddInstancePlacement", () => {
  it("inserts at start when project is empty", () => {
    const result = decideAddInstancePlacement([], template, 5);
    expect(result).toEqual({ kind: "insert", instanceStart: 5, insertAtIndex: 0 });
  });

  it("inserts in the gap between two lines and after prev's list index when gap fits", () => {
    const lines = [wordSyncedLine("A", 0, 2), wordSyncedLine("B", 10, 12)];
    // Playhead at 5, gap is [2..10] = 8 wide, template duration 1 fits
    const result = decideAddInstancePlacement(lines, template, 5);
    expect(result).toEqual({ kind: "insert", instanceStart: 5, insertAtIndex: 1 });
  });

  it("returns 'fallback: gap-too-small' when the gap can't fit the template duration", () => {
    const lines = [wordSyncedLine("A", 0, 2), wordSyncedLine("B", 2.5, 4)];
    // Playhead at 2.2; gap is [2..2.5] = 0.5 wide; template needs 1
    const result = decideAddInstancePlacement(lines, template, 2.2);
    expect(result).toEqual({ kind: "fallback", reason: "gap-too-small" });
  });

  it("returns 'fallback: playhead-inside-line' when playhead is within an existing line's time range", () => {
    const lines = [wordSyncedLine("A", 0, 5), wordSyncedLine("B", 10, 12)];
    const result = decideAddInstancePlacement(lines, template, 3);
    expect(result).toEqual({ kind: "fallback", reason: "playhead-inside-line" });
  });

  it("returns 'fallback: past-last-line' when playhead is past every existing line's end", () => {
    const lines = [wordSyncedLine("A", 0, 5), wordSyncedLine("B", 10, 12)];
    const result = decideAddInstancePlacement(lines, template, 50);
    expect(result).toEqual({ kind: "fallback", reason: "past-last-line" });
  });

  it("inserts at index 0 when playhead is before any line", () => {
    const lines = [wordSyncedLine("A", 10, 12), wordSyncedLine("B", 20, 22)];
    const result = decideAddInstancePlacement(lines, template, 5);
    expect(result).toEqual({ kind: "insert", instanceStart: 5, insertAtIndex: 0 });
  });

  it("treats line-synced rows as time-occupying for the inside-line check", () => {
    const lines = [lineSyncedLine("A", 0, 5)];
    const result = decideAddInstancePlacement(lines, template, 3);
    expect(result).toEqual({ kind: "fallback", reason: "playhead-inside-line" });
  });

  it("treats line-synced rows as time-occupying for the gap-fit check", () => {
    const lines = [lineSyncedLine("A", 0, 2), lineSyncedLine("B", 10, 12)];
    const result = decideAddInstancePlacement(lines, template, 5);
    expect(result).toEqual({ kind: "insert", instanceStart: 5, insertAtIndex: 1 });
  });

  it("ignores untimed lines (no words, no begin/end) when finding neighbors", () => {
    // A is untimed, B is the only real anchor
    const lines: LyricLine[] = [{ id: "A", text: "untimed", agentId: "v1" }, wordSyncedLine("B", 10, 12)];
    // Playhead at 5, before B → insert before B at list index 0 (since prev=null)
    const result = decideAddInstancePlacement(lines, template, 5);
    expect(result).toEqual({ kind: "insert", instanceStart: 5, insertAtIndex: 0 });
  });

  it("handles a tightly-packed playhead at exactly a gap boundary", () => {
    // Playhead exactly at A.end (which is also gap-start)
    const lines = [wordSyncedLine("A", 0, 5), wordSyncedLine("B", 10, 12)];
    // A.end = 5, B.begin = 10, playhead = 5, gap = 5..10. Inside-line check uses
    // <= so playhead == A.end IS counted as inside line A.
    const result = decideAddInstancePlacement(lines, template, 5);
    expect(result).toEqual({ kind: "fallback", reason: "playhead-inside-line" });
  });

  it("template duration affects the gap-fit decision", () => {
    const lines = [wordSyncedLine("A", 0, 2), wordSyncedLine("B", 4, 6)];
    // Gap is [2..4] = 2 wide. Template duration 1 fits with playhead at 2.5 (ends at 3.5)
    expect(decideAddInstancePlacement(lines, template, 2.5)).toEqual({
      kind: "insert",
      instanceStart: 2.5,
      insertAtIndex: 1,
    });
    // Same gap, longer template (4s) does not fit
    const longTemplate: LineTemplate[] = [
      {
        text: "x",
        agentId: "v1",
        relativeBegin: 0,
        relativeEnd: 4,
        words: [wt("x", 0, 4)],
      },
    ];
    expect(decideAddInstancePlacement(lines, longTemplate, 2.5)).toEqual({
      kind: "fallback",
      reason: "gap-too-small",
    });
  });

  it("inserts after prev when there are multiple lines on each side of the playhead", () => {
    const lines = [
      wordSyncedLine("A", 0, 1),
      wordSyncedLine("B", 2, 3),
      wordSyncedLine("C", 10, 11),
      wordSyncedLine("D", 12, 13),
    ];
    // Playhead at 5 → gap is between B and C → insert after B at list index 2
    const result = decideAddInstancePlacement(lines, template, 5);
    expect(result).toEqual({ kind: "insert", instanceStart: 5, insertAtIndex: 2 });
  });

  it("respects original list-index even when timing order disagrees with list order", () => {
    // List order: B (later), A (earlier in time). Time-sorted: A then B.
    // Playhead in the gap before A's begin → insert at list index 0 (no prev in time-sort)
    const lines = [wordSyncedLine("B", 10, 12), wordSyncedLine("A", 5, 6)];
    const result = decideAddInstancePlacement(lines, template, 2);
    // No prev in time order → insertAtIndex 0
    expect(result).toEqual({ kind: "insert", instanceStart: 2, insertAtIndex: 0 });
  });
});
