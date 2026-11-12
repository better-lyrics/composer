import { beforeEach, describe, expect, it } from "vitest";
import {
  isLineFullyTimed,
  isLineTimed,
  isProjectFullySynced,
  isSyncableLine,
  syncGaps,
  syncProgress,
  wordSlotCount,
} from "@/domain/line/sync-progress";
import { useSettingsStore } from "@/stores/settings";
import { createLine } from "@/test/factories";

const word = (text: string, begin: number, end: number) => ({ text, begin, end });

describe("isSyncableLine", () => {
  it("is true for a line with main lyrics", () => {
    expect(isSyncableLine(createLine({ text: "hello" }))).toBe(true);
  });
  it("is false for a blank line, whitespace, and undefined", () => {
    expect(isSyncableLine(createLine({ text: "" }))).toBe(false);
    expect(isSyncableLine(createLine({ text: "   " }))).toBe(false);
    expect(isSyncableLine(undefined)).toBe(false);
  });
});

describe("isLineTimed", () => {
  it("is true for word-synced and line-synced lines", () => {
    expect(isLineTimed(createLine({ text: "a", words: [word("a", 1, 2)] }))).toBe(true);
    expect(isLineTimed(createLine({ text: "a", begin: 1, end: 2 }))).toBe(true);
  });
  it("is false for an untimed line", () => {
    expect(isLineTimed(createLine({ text: "a" }))).toBe(false);
  });
  it("regression: a line-synced line beginning at 0 is timed", () => {
    expect(isLineTimed(createLine({ text: "a", begin: 0, end: 1 }))).toBe(true);
  });
});

describe("wordSlotCount and isLineFullyTimed", () => {
  it("counts syllables split by the split character as slots", () => {
    expect(wordSlotCount(createLine({ text: "hel|lo world" }))).toBe(3);
  });
  it("a word-synced line is fully timed only when every slot has a word", () => {
    expect(isLineFullyTimed(createLine({ text: "a b", words: [word("a ", 1, 2)] }))).toBe(false);
    expect(isLineFullyTimed(createLine({ text: "a b", words: [word("a ", 1, 2), word("b", 2, 3)] }))).toBe(true);
  });
  it("a line-synced line is fully timed", () => {
    expect(isLineFullyTimed(createLine({ text: "a b", begin: 1, end: 2 }))).toBe(true);
  });
  it("an untimed line and a blank line are not fully timed", () => {
    expect(isLineFullyTimed(createLine({ text: "a b" }))).toBe(false);
    expect(isLineFullyTimed(createLine({ text: "" }))).toBe(false);
  });
});

describe("syncProgress", () => {
  const lines = [
    createLine({ text: "a b", words: [word("a ", 1, 2)] }),
    createLine({ text: "" }),
    createLine({ text: "c", begin: 3, end: 4 }),
    createLine({ text: "d e" }),
  ];
  it("line granularity counts only syncable lines (regression U2: blank lines are not in the denominator)", () => {
    expect(syncProgress(lines, "line")).toEqual({ done: 2, total: 3 });
  });
  it("word granularity counts word slots and timed words, with a line-synced line counting every slot", () => {
    expect(syncProgress(lines, "word")).toEqual({ done: 2, total: 5 });
  });
  it("regression #290: line-synced lines stay done in word granularity", () => {
    const lineSynced = [createLine({ text: "a b c", begin: 1, end: 2 }), createLine({ text: "d e", begin: 2, end: 3 })];
    expect(syncProgress(lineSynced, "word")).toEqual({ done: 5, total: 5 });
  });
  it("is zero over zero for no lines", () => {
    expect(syncProgress([], "line")).toEqual({ done: 0, total: 0 });
    expect(syncProgress([], "word")).toEqual({ done: 0, total: 0 });
  });
  it("invariant: done never exceeds total even if words outnumber slots", () => {
    const over = [createLine({ text: "a", words: [word("a", 1, 2), word("b", 2, 3)] })];
    expect(syncProgress(over, "word")).toEqual({ done: 1, total: 1 });
  });
});

describe("isProjectFullySynced", () => {
  it("is true only when every syncable line is fully timed", () => {
    const done = [createLine({ text: "a", words: [word("a", 1, 2)] }), createLine({ text: "" })];
    expect(isProjectFullySynced(done)).toBe(true);
  });
  it("regression U3: a partially timed line means the sync is not complete", () => {
    expect(isProjectFullySynced([createLine({ text: "a b c", words: [word("a ", 1, 2), word("b ", 2, 3)] })])).toBe(
      false,
    );
  });
  it("is true when every line with lyrics is fully timed, ignoring blank lines", () => {
    const lines = [
      createLine({ text: "a b", words: [word("a ", 1, 2), word("b", 2, 3)] }),
      createLine({ text: "Line", begin: 3, end: 4 }),
      createLine({ text: "" }),
    ];
    expect(isProjectFullySynced(lines)).toBe(true);
  });

  it("is true for a line-synced line whose background has no words of its own", () => {
    expect(isProjectFullySynced([createLine({ text: "Main", begin: 1, end: 2, backgroundText: "ooh" })])).toBe(true);
  });

  describe("edge cases", () => {
    it("is false with an untimed line", () => {
      expect(
        isProjectFullySynced([createLine({ text: "Timed", begin: 0, end: 1 }), createLine({ text: "Not yet" })]),
      ).toBe(false);
    });

    it("is false with a partly word-synced line", () => {
      expect(isProjectFullySynced([createLine({ text: "a b c", words: [word("a ", 1, 2), word("b ", 2, 3)] })])).toBe(
        false,
      );
    });

    it("is false with a line that has background vocals but no main lyrics", () => {
      const lines = [createLine({ text: "Main", begin: 0, end: 1 }), createLine({ text: "", backgroundText: "ooh" })];
      expect(isProjectFullySynced(lines)).toBe(false);
    });

    it("is false when the background words do not cover the background text", () => {
      const line = createLine({
        text: "Main",
        begin: 0,
        end: 2,
        backgroundText: "ooh aah",
        backgroundWords: [word("ooh ", 0, 1)],
      });
      expect(isProjectFullySynced([line])).toBe(false);
    });

    it("is false with no lyrics at all", () => {
      expect(isProjectFullySynced([])).toBe(false);
      expect(isProjectFullySynced([createLine({ text: "" })])).toBe(false);
    });
  });

  describe("invariants", () => {
    it("never holds when the sync is not complete", () => {
      const partial = [createLine({ text: "a b", words: [word("a ", 1, 2)] })];
      expect(isProjectFullySynced(partial)).toBe(false);
    });
  });
});

describe("per-line cache", () => {
  it("recomputes only a replaced line, matches a fresh computation, and follows the split character", () => {
    useSettingsStore.setState({ splitCharacter: "|" });
    const lines = [
      createLine({ text: "hel|lo world", words: [word("hel", 1, 2)] }),
      createLine({ text: "far a|way", begin: 3, end: 4 }),
      createLine({ text: "" }),
    ];
    expect(syncProgress(lines, "word")).toEqual({ done: 4, total: 6 });

    const untouched = lines[1];
    untouched.text = "edited";
    expect(wordSlotCount(untouched)).toBe(3);
    untouched.text = "far a|way";

    const tapped = [
      createLine({ text: "hel|lo world", words: [word("hel", 1, 2), word("lo ", 2, 3)] }),
      untouched,
      lines[2],
    ];
    expect(syncProgress(tapped, "word")).toEqual(syncProgress(structuredClone(tapped), "word"));
    expect(isProjectFullySynced(tapped)).toBe(isProjectFullySynced(structuredClone(tapped)));

    useSettingsStore.setState({ splitCharacter: "/" });
    expect(wordSlotCount(tapped[0])).toBe(2);
  });
});

describe("syncGaps", () => {
  beforeEach(() => useSettingsStore.setState({ splitCharacter: "|" }));

  it("regression: a timed word that covers two slots is a gap, and the count agrees with the pass rule", () => {
    const line = createLine({
      text: "pada hal ke|cil",
      words: [word("pada ", 1, 2), word("hal ke", 2, 3), word("cil", 3, 4)],
    });
    expect(syncGaps([line])).toEqual([
      {
        lineId: line.id,
        lineIndex: 0,
        track: "main",
        kind: "partial",
        timedSlots: 2,
        slotCount: 4,
        problemSlots: [1, 2],
      },
    ]);
    expect(isProjectFullySynced([line])).toBe(false);
  });

  it("marks the untimed tail of a partly synced line", () => {
    const line = createLine({ text: "aku sayang kamu", words: [word("aku ", 1, 2)] });
    expect(syncGaps([line])[0]).toMatchObject({ kind: "partial", timedSlots: 1, slotCount: 3, problemSlots: [1, 2] });
  });

  it("reports background vocals as their own track", () => {
    const line = createLine({
      text: "aku sayang",
      words: [word("aku ", 1, 2), word("sayang", 2, 3)],
      backgroundText: "(ooh, na-na, yeah)",
      backgroundWords: [word("(ooh, ", 2, 3)],
    });
    expect(syncGaps([line])).toEqual([
      expect.objectContaining({ track: "background", kind: "partial", problemSlots: [1, 2] }),
    ]);
  });

  it("reports untimed background vocals on a word-synced line", () => {
    const line = createLine({ text: "aku", words: [word("aku", 1, 2)], backgroundText: "(ooh)" });
    expect(syncGaps([line])).toEqual([
      expect.objectContaining({ track: "background", kind: "untimed", timedSlots: 0, slotCount: 1 }),
    ]);
    expect(isProjectFullySynced([line])).toBe(false);
  });

  it("reports an untimed line and background vocals with no main lyrics", () => {
    const untimed = createLine({ text: "aku sayang" });
    const backgroundOnly = createLine({ text: "", backgroundText: "(ooh)" });
    expect(syncGaps([untimed, backgroundOnly]).map((gap) => [gap.lineIndex, gap.track, gap.kind])).toEqual([
      [0, "main", "untimed"],
      [1, "background", "background-only"],
    ]);
  });

  it("is empty for a fully synced project, and that is the pass rule", () => {
    const line = createLine({ text: "aku", words: [word("aku", 1, 2)] });
    expect(syncGaps([line])).toEqual([]);
    expect(isProjectFullySynced([line])).toBe(true);
  });
});
