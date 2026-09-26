import { describe, expect, it } from "vitest";
import { reconcileLine, type LyricLine } from "@/domain/line/model";
import { commitGesture, type GestureCommit, type SyncGesture } from "@/domain/sync/commit-gesture";
import { createLine } from "@/test/factories";

const word = (text: string, begin: number, end: number) => ({ text, begin, end });
const DUR = 0.3;

function run(lines: LyricLine[], gesture: SyncGesture, cursor: [number, number], time: number, jumped = false) {
  return commitGesture(lines, gesture, {
    cursor: { lineIndex: cursor[0], wordIndex: cursor[1] },
    jumped,
    time,
    defaultWordDuration: DUR,
  });
}

function apply(lines: LyricLine[], commit: GestureCommit | null): LyricLine[] {
  if (!commit) return lines;
  return lines.map((line) => {
    const update = commit.lineUpdates.find((u) => u.id === line.id);
    return update ? reconcileLine({ ...line, ...update.updates }) : line;
  });
}

function flatTimings(lines: LyricLine[]) {
  return lines.flatMap((l) => l.words ?? (l.begin !== undefined ? [{ text: l.text, begin: l.begin, end: l.end }] : []));
}

function expectMonotonic(lines: LyricLine[]) {
  const flat = flatTimings(lines);
  flat.forEach((w, i) => {
    expect(w.end, `${w.text} end >= begin`).toBeGreaterThanOrEqual(w.begin);
    if (i > 0) expect(w.begin, `${w.text} begins after previous end`).toBeGreaterThanOrEqual(flat[i - 1].end);
  });
}

describe("tap-word", () => {
  it("writes the first word of an untimed line with a provisional end", () => {
    const lines = [createLine({ id: "l0", text: "one two" })];
    const commit = run(lines, "tap-word", [0, 0], 1);
    expect(commit?.lineUpdates).toEqual([{ id: "l0", updates: { words: [word("one ", 1, 1 + DUR)] } }]);
    expect(commit?.nextCursor).toEqual({ lineIndex: 0, wordIndex: 1 });
    expect(commit?.nextJumped).toBe(false);
    expect(commit?.clampedTo).toBeNull();
  });

  it("closes the previous word in the same line with one update", () => {
    const lines = [createLine({ id: "l0", text: "one two", words: [word("one ", 1, 1.3)] })];
    const commit = run(lines, "tap-word", [0, 1], 2);
    expect(commit?.lineUpdates).toEqual([{ id: "l0", updates: { words: [word("one ", 1, 2), word("two", 2, 2.3)] } }]);
  });

  it("closes the previous line's last word across a blank line", () => {
    const lines = [
      createLine({ id: "l0", text: "a", words: [word("a", 1, 1.3)] }),
      createLine({ id: "blank", text: "" }),
      createLine({ id: "l2", text: "b" }),
    ];
    const commit = run(lines, "tap-word", [2, 0], 2);
    expect(commit?.lineUpdates).toContainEqual({ id: "l0", updates: { words: [word("a", 1, 2)] } });
    expect(commit?.lineUpdates).toContainEqual({ id: "l2", updates: { words: [word("b", 2, 2.3)] } });
    expect(commit?.lineUpdates).toHaveLength(2);
  });

  it("regression D5: a tap behind the previous word is clamped to its begin and flagged", () => {
    const lines = [createLine({ id: "l0", text: "a b c", words: [word("a ", 5, 6), word("b ", 6, 6.3)] })];
    const commit = run(lines, "tap-word", [0, 2], 1);
    expect(commit?.clampedTo).toBe(6);
    expectMonotonic(apply(lines, commit));
  });

  it("regression D5: across lines, never writes end < begin", () => {
    const lines = [
      createLine({ id: "l0", text: "a b", words: [word("a ", 5, 6), word("b", 6, 6.3)] }),
      createLine({ id: "l1", text: "c d" }),
    ];
    expectMonotonic(apply(lines, run(lines, "tap-word", [1, 0], 2)));
  });

  it("regression D3: a jumped re-record leaves earlier words intact and clamps to the previous end", () => {
    const texts = ["I ", "heard ", "the ", "rumors ", "going ", "round"];
    const lines = [
      createLine({
        id: "l0",
        text: "I heard the rumors going round",
        words: texts.map((t, i) => word(t, 1 + i, 2 + i)),
      }),
    ];
    const commit = run(lines, "tap-word", [0, 3], 2.6, true);
    const after = apply(lines, commit);
    expect(commit?.clampedTo).toBe(4);
    for (const w of after[0].words?.slice(0, 3) ?? []) expect(w.end - w.begin).toBeGreaterThan(0);
    expect(after[0].words?.map((w) => w.text)).toEqual(texts);
  });

  it("a jumped tap after the previous end leaves the previous word untouched", () => {
    const lines = [createLine({ id: "l0", text: "a b", words: [word("a ", 1, 2), word("b", 3, 4)] })];
    const after = apply(lines, run(lines, "tap-word", [0, 1], 2.5, true));
    expect(after[0].words?.[0]).toEqual(word("a ", 1, 2));
    expect(after[0].words?.[1].begin).toBe(2.5);
  });

  it("caps a re-recorded word's end at the next word's begin instead of pushing it", () => {
    const lines = [createLine({ id: "l0", text: "a b", words: [word("a ", 1, 2), word("b", 2.1, 3)] })];
    const after = apply(lines, run(lines, "tap-word", [0, 0], 2, true));
    expect(after[0].words).toEqual([word("a ", 2, 2.1), word("b", 2.1, 3)]);
  });

  it("keeps existing word fields when re-recording in place", () => {
    const lines = [
      createLine({ id: "l0", text: "a b", words: [{ ...word("a ", 1, 2), explicit: true }, word("b", 2, 3)] }),
    ];
    const after = apply(lines, run(lines, "tap-word", [0, 0], 1.5, true));
    expect(after[0].words?.[0]).toMatchObject({ explicit: true, begin: 1.5 });
  });

  it("invariant: never writes text or backgroundText", () => {
    const lines = [createLine({ id: "l0", text: "a b", backgroundText: "oh" })];
    const commit = run(lines, "tap-word", [0, 0], 1);
    for (const u of commit?.lineUpdates ?? []) {
      expect(u.updates).not.toHaveProperty("text");
      expect(u.updates).not.toHaveProperty("backgroundText");
    }
  });

  it("invariant: at most one update per line id", () => {
    const lines = [createLine({ id: "l0", text: "a b", words: [word("a ", 1, 1.3)] })];
    const ids = run(lines, "tap-word", [0, 1], 2)?.lineUpdates.map((u) => u.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("rule 8: does not re-seed an untimed line that already has background words", () => {
    const lines = [createLine({ id: "l0", text: "a", backgroundText: "oh", backgroundWords: [word("oh", 7, 8)] })];
    const updates = run(lines, "tap-word", [0, 0], 1)?.lineUpdates[0].updates;
    expect(updates).not.toHaveProperty("backgroundWords");
  });

  it("seeds background words when a line gets its first timing", () => {
    const lines = [createLine({ id: "l0", text: "a", backgroundText: "oh" })];
    const updates = run(lines, "tap-word", [0, 0], 1)?.lineUpdates[0].updates;
    expect(updates?.backgroundWords?.[0].begin).toBe(1);
  });

  it("P3: re-writing slot 0 of a timed line shifts background words by the main delta", () => {
    const lines = [
      createLine({
        id: "l0",
        text: "hello world",
        begin: 26,
        end: 28,
        backgroundText: "oh oh",
        backgroundWords: [word("oh ", 26.5, 27.25), word("oh", 27.25, 28)],
      }),
    ];
    const after = apply(lines, run(lines, "tap-word", [0, 0], 5));
    expect(after[0].backgroundWords).toEqual([word("oh ", 5.5, 6.25), word("oh", 6.25, 7)]);
    expect(after[0].begin).toBeUndefined();
  });

  it("returns null when the cursor was not resolved and points past the timed words", () => {
    const lines = [createLine({ id: "l0", text: "a b c", words: [word("a ", 1, 2)] })];
    expect(run(lines, "tap-word", [0, 2], 3)).toBeNull();
  });

  it("returns null past the end, on a blank line, and past the text", () => {
    const lines = [createLine({ id: "l0", text: "a" }), createLine({ id: "blank", text: "" })];
    expect(run(lines, "tap-word", [2, 0], 1)).toBeNull();
    expect(run(lines, "tap-word", [1, 0], 1)).toBeNull();
    expect(run(lines, "tap-word", [0, 1], 1)).toBeNull();
  });
});

describe("tap-line", () => {
  it("opens an untimed line at the tap and closes the previous line", () => {
    const lines = [createLine({ id: "l0", text: "first", begin: 5, end: 5 }), createLine({ id: "l1", text: "second" })];
    const commit = run(lines, "tap-line", [1, 0], 7);
    expect(commit?.lineUpdates).toContainEqual({ id: "l0", updates: { end: 7 } });
    expect(commit?.lineUpdates).toContainEqual({ id: "l1", updates: { begin: 7, end: 7 } });
    expect(commit?.nextCursor).toEqual({ lineIndex: 2, wordIndex: 0 });
  });

  it("regression D5: a backwards line tap is clamped and never writes end < begin", () => {
    const lines = [createLine({ id: "l0", text: "first", begin: 5, end: 5 }), createLine({ id: "l1", text: "second" })];
    const commit = run(lines, "tap-line", [1, 0], 2);
    expect(commit?.clampedTo).toBe(5);
    expectMonotonic(apply(lines, commit));
  });

  it("regression T10: a word-synced line moves as a whole instead of being discarded", () => {
    const lines = [createLine({ id: "l0", text: "a b", words: [word("a ", 20, 21), word("b", 21, 22)] })];
    const after = apply(lines, run(lines, "tap-line", [0, 0], 3));
    expect(after[0].words).toEqual([word("a ", 3, 4), word("b", 4, 5)]);
  });

  it("P3: a line-synced line moves with its background words", () => {
    const lines = [
      createLine({
        id: "l0",
        text: "a",
        begin: 10,
        end: 12,
        backgroundText: "oh",
        backgroundWords: [word("oh", 11, 12)],
      }),
    ];
    const after = apply(lines, run(lines, "tap-line", [0, 0], 4));
    expect(after[0]).toMatchObject({ begin: 4, end: 6, backgroundWords: [word("oh", 5, 6)] });
  });

  it("closes a word-synced previous line's last word in line mode", () => {
    const lines = [
      createLine({ id: "l0", text: "a b", words: [word("a ", 1, 2), word("b", 2, 2.3)] }),
      createLine({ id: "l1", text: "c" }),
    ];
    const commit = run(lines, "tap-line", [1, 0], 4);
    expect(commit?.lineUpdates).toContainEqual({ id: "l0", updates: { words: [word("a ", 1, 2), word("b", 2, 4)] } });
  });

  it("regression I1: after a word-synced line, the floor is its last word's begin, never its first", () => {
    const lines = [
      createLine({ id: "l0", text: "a b", words: [word("a ", 1, 2), word("b", 5, 6)] }),
      createLine({ id: "l1", text: "c" }),
    ];
    const commit = run(lines, "tap-line", [1, 0], 3);
    expect(commit?.clampedTo).toBe(5);
    expectMonotonic(apply(lines, commit));
  });

  it("rule 2: after a jump, a tap before the previous line's end is clamped to that end", () => {
    const lines = [createLine({ id: "l0", text: "first", begin: 1, end: 4 }), createLine({ id: "l1", text: "second" })];
    const commit = run(lines, "tap-line", [1, 0], 3, true);
    expect(commit?.clampedTo).toBe(4);
    expect(commit?.lineUpdates).toEqual([{ id: "l1", updates: { begin: 4, end: 4 } }]);
  });

  it("after a jump the previous line is untouched", () => {
    const lines = [createLine({ id: "l0", text: "first", begin: 1, end: 2 }), createLine({ id: "l1", text: "second" })];
    const ids = run(lines, "tap-line", [1, 0], 3, true)?.lineUpdates.map((u) => u.id);
    expect(ids).toEqual(["l1"]);
  });
});

describe("hold gestures", () => {
  it("hold-start opens the word with end = begin and keeps the cursor", () => {
    const lines = [createLine({ id: "l0", text: "a b" })];
    const commit = run(lines, "hold-start", [0, 0], 1);
    expect(commit?.lineUpdates).toEqual([{ id: "l0", updates: { words: [word("a ", 1, 1)] } }]);
    expect(commit?.nextCursor).toEqual({ lineIndex: 0, wordIndex: 0 });
  });

  it("regression T3: hold-start on the next line closes a tapped previous word", () => {
    const lines = [
      createLine({ id: "l0", text: "a b", words: [word("a ", 5, 6), word("b", 6, 6.3)] }),
      createLine({ id: "l1", text: "c d" }),
    ];
    const after = apply(lines, run(lines, "hold-start", [1, 0], 6.1));
    expect(after[0].words?.[1].end).toBe(6.1);
  });

  it("rule 3: a forward hold-start mid-line closes the previous word in the same line", () => {
    const lines = [createLine({ id: "l0", text: "a b", words: [word("a ", 1, 1.3)] })];
    const commit = run(lines, "hold-start", [0, 1], 2);
    expect(commit?.lineUpdates).toEqual([{ id: "l0", updates: { words: [word("a ", 1, 2), word("b", 2, 2)] } }]);
  });

  it("hold-start keeps the jumped flag until the hold ends", () => {
    const lines = [createLine({ id: "l0", text: "a b", words: [word("a ", 1, 2), word("b", 2, 3)] })];
    expect(run(lines, "hold-start", [0, 1], 2, true)?.nextJumped).toBe(true);
  });

  it("hold-end closes the held word at the release time and advances", () => {
    const lines = [createLine({ id: "l0", text: "a b", words: [word("a ", 1, 1)] })];
    const commit = run(lines, "hold-end", [0, 0], 2);
    expect(apply(lines, commit)[0].words?.[0]).toEqual(word("a ", 1, 2));
    expect(commit?.nextCursor).toEqual({ lineIndex: 0, wordIndex: 1 });
  });

  it("hold-end never ends a word before it begins", () => {
    const lines = [createLine({ id: "l0", text: "a", words: [word("a", 3, 3)] })];
    const commit = run(lines, "hold-end", [0, 0], 1);
    expect(apply(lines, commit)[0].words?.[0]).toEqual(word("a", 3, 3));
    expect(commit?.clampedTo).toBe(3);
  });

  it("hold-tap closes the held word and opens the next one in the same line with one update", () => {
    const lines = [createLine({ id: "l0", text: "a b", words: [word("a ", 1, 1)] })];
    const commit = run(lines, "hold-tap", [0, 0], 2);
    expect(commit?.lineUpdates).toEqual([{ id: "l0", updates: { words: [word("a ", 1, 2), word("b", 2, 2)] } }]);
    expect(commit?.nextCursor).toEqual({ lineIndex: 0, wordIndex: 1 });
  });

  it("regression T3 sibling: hold-tap into an already synced line keeps that line's other words", () => {
    const lines = [
      createLine({ id: "l0", text: "a b", words: [word("a ", 1, 2), word("b", 2, 2)] }),
      createLine({ id: "l1", text: "c d", words: [word("c ", 10, 11), word("d", 11, 12)] }),
    ];
    const after = apply(lines, run(lines, "hold-tap", [0, 1], 3));
    expect(after[1].words?.map((w) => w.text)).toEqual(["c ", "d"]);
    expect(after[1].words?.[0]).toEqual(word("c ", 3, 3));
    expect(after[0].words?.[1]).toEqual(word("b", 2, 3));
  });

  it("hold-end and hold-tap return null when no word is held at the cursor", () => {
    const lines = [createLine({ id: "l0", text: "a b" })];
    expect(run(lines, "hold-end", [0, 0], 1)).toBeNull();
    expect(run(lines, "hold-tap", [0, 0], 1)).toBeNull();
  });
});

describe("ported behaviour", () => {
  it("re-syncs from the middle: overwrites in place, closes the prior word, and preserves later words", () => {
    const lines = [
      createLine({
        id: "l0",
        text: "one two three",
        words: [word("one ", 0, 1), word("two ", 1, 2), word("three", 2, 3)],
      }),
    ];
    const after = apply(lines, run(lines, "tap-word", [0, 1], 1.2));
    expect(after[0].words).toEqual([word("one ", 0, 1.2), word("two ", 1.2, 1.5), word("three", 2, 3)]);
  });

  it("squeezes later words forward when a redo lands past the next word", () => {
    const lines = [
      createLine({
        id: "l0",
        text: "one two three",
        words: [word("one ", 0, 1), word("two ", 1, 2), word("three", 2, 3)],
      }),
    ];
    const after = apply(lines, run(lines, "tap-word", [0, 1], 5));
    expect(after[0].words).toEqual([word("one ", 0, 5), word("two ", 5, 5 + DUR), word("three", 5 + DUR, 5 + DUR)]);
  });

  it("invariant: keeps every word chronologically ordered whatever the redo time", () => {
    const base = createLine({
      id: "l0",
      text: "one two three",
      words: [word("one ", 0, 1), word("two ", 1, 2), word("three", 2, 3)],
    });
    for (const wordIndex of [0, 1, 2]) {
      for (const time of [0, 0.5, 1.5, 2.5, 10]) {
        expectMonotonic(apply([base], run([base], "tap-word", [0, wordIndex], time, true)));
      }
    }
  });

  it("invariant: does not mutate the input lines array or its line objects", () => {
    const line = createLine({ id: "l0", text: "one two", words: [word("one ", 1, 1.3)] });
    const lines = [line];
    const snapshot = structuredClone(lines);
    run(lines, "tap-word", [0, 1], 2);
    run(lines, "hold-start", [0, 1], 2);
    expect(lines).toEqual(snapshot);
  });

  it("opens the first word at the held time without leaving it ending before it begins", () => {
    const lines = [createLine({ id: "l0", text: "one", words: [word("one", 0, 1)] })];
    const after = apply(lines, run(lines, "hold-start", [0, 0], 5));
    expect(after[0].words).toEqual([word("one", 5, 5)]);
  });

  it("redo at a mid-line word overwrites it in place and preserves later words", () => {
    const lines = [
      createLine({
        id: "l0",
        text: "one two three",
        words: [word("one ", 0, 1), word("two ", 1, 2), word("three", 2, 3)],
      }),
    ];
    const after = apply(lines, run(lines, "hold-start", [0, 1], 1.5, true));
    expect(after[0].words).toEqual([word("one ", 0, 1), word("two ", 1.5, 1.5), word("three", 2, 3)]);
  });

  it("squeezes later words forward when a re-held word lands past them", () => {
    const lines = [
      createLine({
        id: "l0",
        text: "one two three",
        words: [word("one ", 0, 1), word("two ", 1, 2), word("three", 2, 3)],
      }),
    ];
    const after = apply(lines, run(lines, "hold-start", [0, 1], 5, true));
    expect(after[0].words).toEqual([word("one ", 0, 1), word("two ", 5, 5), word("three", 5, 5)]);
  });

  it("regression: preserves explicit and syllableGroupId when re-holding a mid-line word", () => {
    const lines = [
      createLine({
        id: "l0",
        text: "one two three",
        words: [
          word("one ", 0, 1),
          word("two ", 1, 2),
          { ...word("three", 2, 3), explicit: true, syllableGroupId: "g1" },
        ],
      }),
    ];
    const after = apply(lines, run(lines, "hold-start", [0, 2], 5, true));
    expect(after[0].words?.[2]).toMatchObject({ explicit: true, syllableGroupId: "g1" });
  });

  it("regression: hold and tap agree on which metadata survives a mid-line redo", () => {
    const lines = [
      createLine({
        id: "l0",
        text: "one two",
        words: [word("one ", 0, 1), { ...word("two ", 1, 2), explicit: true, syllableGroupId: "g1" }],
      }),
    ];
    const held = apply(lines, run(lines, "hold-start", [0, 1], 5, true))[0].words?.[1];
    const tapped = apply(lines, run(lines, "tap-word", [0, 1], 5, true))[0].words?.[1];
    expect(held?.explicit).toBe(tapped?.explicit);
    expect(held?.syllableGroupId).toBe(tapped?.syllableGroupId);
  });

  it("squeezes later words forward when the closed word overruns them", () => {
    const lines = [
      createLine({
        id: "l0",
        text: "one two three",
        words: [word("one ", 0, 1), word("two ", 1, 1), word("three", 3, 4)],
      }),
    ];
    const after = apply(lines, run(lines, "hold-end", [0, 1], 5));
    expect(after[0].words).toEqual([word("one ", 0, 1), word("two ", 1, 5), word("three", 5, 5)]);
  });

  it("preserves explicit and syllableGroupId on the word hold-end closes", () => {
    const lines = [
      createLine({ id: "l0", text: "one", words: [{ ...word("one", 5, 5), explicit: true, syllableGroupId: "g1" }] }),
    ];
    const after = apply(lines, run(lines, "hold-end", [0, 0], 6));
    expect(after[0].words?.[0]).toEqual({ text: "one", begin: 5, end: 6, explicit: true, syllableGroupId: "g1" });
  });
});
