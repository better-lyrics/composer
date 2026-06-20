import {
  advanceSyncPosition,
  buildInitialWordUpdates,
  nextSyncableLineIndex,
  prepareSyncWord,
  prevSyncableLine,
  withBgSeedIfNeeded,
} from "@/hooks/useSyncHandlers.helpers";
import type { LyricLine } from "@/domain/line/model";
import { createLine } from "@/test/factories";
import type { SyncState } from "@/utils/sync-helpers";
import { describe, expect, it } from "vitest";

describe("prepareSyncWord", () => {
  it("returns null when lines is empty", () => {
    expect(prepareSyncWord([], 0, 0, false)).toBeNull();
  });

  it("returns null when isComplete", () => {
    const lines = [createLine({ text: "Hello world" })];
    expect(prepareSyncWord(lines, 0, 0, true)).toBeNull();
  });

  it("returns null when line index is out of bounds", () => {
    const lines = [createLine({ text: "Hello" })];
    expect(prepareSyncWord(lines, 99, 0, false)).toBeNull();
  });

  it("returns null when wordIndex exceeds word count", () => {
    const lines = [createLine({ text: "Hello" })];
    expect(prepareSyncWord(lines, 0, 5, false)).toBeNull();
  });

  it("returns prepared word data with trailing space for non-final word", () => {
    const lines = [createLine({ text: "Hello world" })];
    const result = prepareSyncWord(lines, 0, 0, false);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.lineWords).toEqual(["Hello", "world"]);
    expect(result.textWithSpace).toBe("Hello ");
  });

  it("returns prepared word data without trailing space for final word", () => {
    const lines = [createLine({ text: "Hello world" })];
    const result = prepareSyncWord(lines, 0, 1, false);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.textWithSpace).toBe("world");
  });
});

describe("withBgSeedIfNeeded", () => {
  it("returns updates unchanged when line has no backgroundText", () => {
    const line = createLine({ text: "Hello" });
    const updates: Partial<LyricLine> = { begin: 0, end: 1 };
    const result = withBgSeedIfNeeded(updates, line, 0);
    expect(result.backgroundWords).toBeUndefined();
    expect(result).toBe(updates);
  });

  it("seeds backgroundWords when backgroundText exists and backgroundWords empty", () => {
    const line = createLine({ text: "Hello", backgroundText: "ooh ahh" });
    const result = withBgSeedIfNeeded<Partial<LyricLine>>({ begin: 0, end: 1 }, line, 0.5);
    expect(result.backgroundWords).toBeDefined();
    expect((result.backgroundWords ?? []).length).toBeGreaterThan(0);
  });

  it("does not overwrite existing backgroundWords", () => {
    const line = createLine({
      text: "Hello",
      backgroundText: "ooh ahh",
      backgroundWords: [{ text: "ooh", begin: 0, end: 1 }],
    });
    const result = withBgSeedIfNeeded<Partial<LyricLine>>({}, line, 0);
    expect(result.backgroundWords).toBeUndefined();
  });
});

describe("buildInitialWordUpdates", () => {
  it("creates a single-word words array with the given begin/end", () => {
    const line = createLine({ text: "Hello" });
    const result = buildInitialWordUpdates(line, "Hello", 1.5, 2.5);
    expect(result.words).toEqual([{ text: "Hello", begin: 1.5, end: 2.5 }]);
  });

  it("includes a bg seed when the line has backgroundText", () => {
    const line = createLine({ text: "Lead", backgroundText: "ooh" });
    const result = buildInitialWordUpdates(line, "Lead", 0, 0.4);
    expect(result.words?.length).toBe(1);
    expect(result.backgroundWords?.length).toBeGreaterThan(0);
  });
});

describe("advanceSyncPosition", () => {
  function makeSetter() {
    let state: SyncState = { position: { lineIndex: 0, wordIndex: 0 }, isActive: true };
    const setSyncState = (next: SyncState | ((prev: SyncState) => SyncState)) => {
      state = typeof next === "function" ? next(state) : next;
    };
    return { setSyncState, getState: () => state };
  }

  const twoLines = [createLine({ text: "Hello world" }), createLine({ text: "Second line" })];

  it("advances within the same line when not at the last word", () => {
    const { setSyncState, getState } = makeSetter();
    advanceSyncPosition(setSyncState, twoLines, 0, 1, 5);
    expect(getState().position).toEqual({ lineIndex: 0, wordIndex: 2 });
  });

  it("advances to the next line when crossing the last word", () => {
    const { setSyncState, getState } = makeSetter();
    advanceSyncPosition(setSyncState, twoLines, 0, 4, 5);
    expect(getState().position).toEqual({ lineIndex: 1, wordIndex: 0 });
  });

  it("preserves the isActive flag", () => {
    const { setSyncState, getState } = makeSetter();
    advanceSyncPosition(setSyncState, twoLines, 0, 0, 3);
    expect(getState().isActive).toBe(true);
  });

  it("skips an empty line when crossing to the next line", () => {
    const lines = [createLine({ text: "Hello" }), createLine({ text: "" }), createLine({ text: "World" })];
    const { setSyncState, getState } = makeSetter();
    advanceSyncPosition(setSyncState, lines, 0, 0, 1);
    expect(getState().position).toEqual({ lineIndex: 2, wordIndex: 0 });
  });

  it("skips multiple consecutive empty lines", () => {
    const lines = [
      createLine({ text: "Hello" }),
      createLine({ text: "" }),
      createLine({ text: "  " }),
      createLine({ text: "World" }),
    ];
    const { setSyncState, getState } = makeSetter();
    advanceSyncPosition(setSyncState, lines, 0, 0, 1);
    expect(getState().position).toEqual({ lineIndex: 3, wordIndex: 0 });
  });

  it("lands on lines.length (complete) when only empty lines follow", () => {
    const lines = [createLine({ text: "Hello" }), createLine({ text: "" })];
    const { setSyncState, getState } = makeSetter();
    advanceSyncPosition(setSyncState, lines, 0, 0, 1);
    expect(getState().position.lineIndex).toBe(lines.length);
  });
});

describe("nextSyncableLineIndex", () => {
  it("returns the immediate next line when it has words", () => {
    const lines = [createLine({ text: "a" }), createLine({ text: "b" })];
    expect(nextSyncableLineIndex(lines, 0)).toBe(1);
  });

  it("skips empty and whitespace-only lines", () => {
    const lines = [
      createLine({ text: "a" }),
      createLine({ text: "" }),
      createLine({ text: "  " }),
      createLine({ text: "b" }),
    ];
    expect(nextSyncableLineIndex(lines, 0)).toBe(3);
  });

  it("returns lines.length when no syncable line follows", () => {
    const lines = [createLine({ text: "a" }), createLine({ text: "" })];
    expect(nextSyncableLineIndex(lines, 0)).toBe(2);
  });

  it("finds the first syncable line from before the start (fromIndex -1)", () => {
    const lines = [createLine({ text: "" }), createLine({ text: "a" })];
    expect(nextSyncableLineIndex(lines, -1)).toBe(1);
  });
});

describe("prevSyncableLine", () => {
  it("returns the immediate previous line when it has words", () => {
    const lines = [createLine({ text: "a" }), createLine({ text: "b" })];
    expect(prevSyncableLine(lines, 1)?.text).toBe("a");
  });

  it("skips empty lines and returns the nearest syncable predecessor", () => {
    const lines = [createLine({ text: "a" }), createLine({ text: "" }), createLine({ text: "b" })];
    expect(prevSyncableLine(lines, 2)?.text).toBe("a");
  });

  it("returns undefined when no syncable line precedes", () => {
    const lines = [createLine({ text: "" }), createLine({ text: "b" })];
    expect(prevSyncableLine(lines, 1)).toBeUndefined();
  });
});
