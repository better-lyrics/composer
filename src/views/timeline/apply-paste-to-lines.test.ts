import { describe, expect, it } from "vitest";
import { timeRangeResolver } from "@/domain/group/shared-timing";
import type { LyricLine } from "@/domain/line/model";
import { createGroup, createLine, createWord } from "@/test/factories";
import { applyPasteToLines, pasteOverlaps } from "@/views/timeline/apply-paste-to-lines";
import type { ClipboardData } from "@/views/timeline/selection-types";

// -- Helpers ------------------------------------------------------------------

const line = (id: string, words: LyricLine["words"], text: string): LyricLine =>
  ({ id, agentId: "a", text, words }) as LyricLine;

const wholeSong = (duration: number) => timeRangeResolver([], [], duration);

// -- Tests --------------------------------------------------------------------

describe("applyPasteToLines", () => {
  describe("happy paths", () => {
    it("re-derives main text from the new words after pasting onto an existing line", () => {
      const lines = [
        line(
          "l1",
          [
            { text: "a ", begin: 0, end: 0.5 },
            { text: "b", begin: 0.5, end: 1 },
          ],
          "a b",
        ),
      ];
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "z", begin: 2, end: 2.5 }, lineOffset: 0, trackType: "word" }],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, rangeOf: wholeSong(10) });
      expect(updates).not.toBeNull();
      expect(updates?.[0].updates.text).toBeDefined();
      expect(updates?.[0].updates.text).not.toBe("a b");
      expect(updates?.[0].updates.text).toContain("z");
    });

    it("re-derives bg text on bg paste", () => {
      const lines = [line("l1", [{ text: "a", begin: 0, end: 0.5 }], "a")];
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "bgw", begin: 1, end: 1.5 }, lineOffset: 0, trackType: "bg" }],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, rangeOf: wholeSong(10) });
      expect(updates).not.toBeNull();
      expect((updates?.[0].updates as { backgroundText?: string }).backgroundText).toBeDefined();
    });

    it("distributes entries across multiple destination lines via lineOffset", () => {
      const lines = [
        line("l1", [{ text: "a", begin: 0, end: 0.5 }], "a"),
        line("l2", [{ text: "b", begin: 0, end: 0.5 }], "b"),
      ];
      const clipboard: ClipboardData = {
        entries: [
          { word: { text: "x", begin: 1, end: 1.5 }, lineOffset: 0, trackType: "word" },
          { word: { text: "y", begin: 2, end: 2.5 }, lineOffset: 1, trackType: "word" },
        ],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, rangeOf: wholeSong(10) });
      expect(updates).not.toBeNull();
      expect(updates).toHaveLength(2);
      const byId = new Map(updates?.map((u) => [u.id, u]));
      expect(byId.get("l1")?.updates.words?.some((w) => w.text === "x")).toBe(true);
      expect(byId.get("l2")?.updates.words?.some((w) => w.text === "y")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("returns null when an entry would land at an out-of-bounds line index", () => {
      const lines = [line("l1", [{ text: "a", begin: 0, end: 1 }], "a")];
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "z", begin: 0, end: 0.5 }, lineOffset: 5, trackType: "word" }],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, rangeOf: wholeSong(10) });
      expect(updates).toBeNull();
    });

    it("returns null when targetLineIndex is negative", () => {
      const lines = [line("l1", [{ text: "a", begin: 0, end: 1 }], "a")];
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "z", begin: 0, end: 0.5 }, lineOffset: 0, trackType: "word" }],
      };
      const updates = applyPasteToLines({
        lines,
        clipboard,
        targetLineIndex: -1,
        timeDelta: 0,
        rangeOf: wholeSong(10),
      });
      expect(updates).toBeNull();
    });

    it("clamps new word times to [0, duration]", () => {
      const lines = [line("l1", [], "")];
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "z", begin: -5, end: 100 }, lineOffset: 0, trackType: "word" }],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, rangeOf: wholeSong(10) });
      expect(updates?.[0].updates.words?.[0].begin).toBe(0);
      expect(updates?.[0].updates.words?.[0].end).toBe(10);
    });

    it("handles a clipboard with mixed word and bg entries on the same line", () => {
      const lines = [line("l1", [{ text: "a", begin: 0, end: 0.5 }], "a")];
      const clipboard: ClipboardData = {
        entries: [
          { word: { text: "mw", begin: 1, end: 1.5 }, lineOffset: 0, trackType: "word" },
          { word: { text: "bw", begin: 2, end: 2.5 }, lineOffset: 0, trackType: "bg" },
        ],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, rangeOf: wholeSong(10) });
      expect(updates?.[0].updates.words?.some((w) => w.text === "mw")).toBe(true);
      expect(
        (updates?.[0].updates as { backgroundWords?: Array<{ text: string }> }).backgroundWords?.some(
          (w) => w.text === "bw",
        ),
      ).toBe(true);
    });
  });

  describe("invariants", () => {
    it("does not mutate input lines", () => {
      const lines = [line("l1", [{ text: "a", begin: 0, end: 1 }], "a")];
      const before = JSON.stringify(lines);
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "z", begin: 1, end: 1.5 }, lineOffset: 0, trackType: "word" }],
      };
      applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, rangeOf: wholeSong(10) });
      expect(JSON.stringify(lines)).toBe(before);
    });

    it("applies timeDelta to all pasted entries", () => {
      const lines = [line("l1", [], "")];
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "z", begin: 1, end: 2 }, lineOffset: 0, trackType: "word" }],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 2, rangeOf: wholeSong(10) });
      expect(updates?.[0].updates.words?.[0].begin).toBe(3);
      expect(updates?.[0].updates.words?.[0].end).toBe(4);
    });
  });
});

describe("pasting onto a line-synced row", () => {
  const lineSynced: LyricLine = { id: "ls", agentId: "a", text: "It hurts for me", begin: 10, end: 12 };
  const clipboardAt = (begin: number, end: number): ClipboardData => ({
    entries: [{ word: { text: "never", begin, end }, lineOffset: 0, trackType: "word" }],
  });

  it("regression: pasting after the line's span keeps its text and timing as the first word", () => {
    const updates = applyPasteToLines({
      lines: [lineSynced],
      clipboard: clipboardAt(13, 13.5),
      targetLineIndex: 0,
      timeDelta: 0,
      rangeOf: wholeSong(60),
    });
    expect(updates?.[0].updates.words).toEqual([
      { text: "It hurts for me ", begin: 10, end: 12 },
      { text: "never", begin: 13, end: 13.5 },
    ]);
    expect(updates?.[0].updates.text).toContain("It hurts for me");
    expect(updates?.[0].updates.text).toContain("never");
  });

  it("regression: a paste inside the line's span counts as an overlap", () => {
    expect(pasteOverlaps(clipboardAt(11, 11.5), 0, 0, [lineSynced], wholeSong(60))).toBe(true);
  });

  it("does not report an overlap for a paste outside the line's span", () => {
    expect(pasteOverlaps(clipboardAt(13, 13.5), 0, 0, [lineSynced], wholeSong(60))).toBe(false);
  });
});

describe("pasteOverlaps", () => {
  const wordLine: LyricLine = {
    id: "w",
    agentId: "a",
    text: "a b",
    words: [
      { text: "a ", begin: 0, end: 1 },
      { text: "b", begin: 1, end: 2 },
    ],
  };

  it("reports an overlap with an existing word", () => {
    const clipboard: ClipboardData = {
      entries: [{ word: { text: "z", begin: 0.5, end: 1.5 }, lineOffset: 0, trackType: "word" }],
    };
    expect(pasteOverlaps(clipboard, 0, 0, [wordLine], wholeSong(10))).toBe(true);
  });

  it("allows a paste into free space", () => {
    const clipboard: ClipboardData = {
      entries: [{ word: { text: "z", begin: 3, end: 4 }, lineOffset: 0, trackType: "word" }],
    };
    expect(pasteOverlaps(clipboard, 0, 0, [wordLine], wholeSong(10))).toBe(false);
  });

  describe("edge cases", () => {
    it("treats a target line index out of range as blocked", () => {
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "z", begin: 3, end: 4 }, lineOffset: 1, trackType: "word" }],
      };
      expect(pasteOverlaps(clipboard, 0, 0, [wordLine], wholeSong(10))).toBe(true);
    });

    it("treats a word clamped to zero width at the song end as blocked", () => {
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "z", begin: 12, end: 13 }, lineOffset: 0, trackType: "word" }],
      };
      expect(pasteOverlaps(clipboard, 0, 0, [wordLine], wholeSong(10))).toBe(true);
    });

    it("ignores an untimed target line", () => {
      const untimed: LyricLine = { id: "u", agentId: "a", text: "free text" };
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "z", begin: 3, end: 4 }, lineOffset: 0, trackType: "word" }],
      };
      expect(pasteOverlaps(clipboard, 0, 0, [untimed], wholeSong(10))).toBe(false);
    });
  });
});

describe("pasting onto a line of a group that shares timing", () => {
  const SONG_END = 20;
  const chorus = (id: string, instanceIdx: number, begin: number) =>
    createLine({
      id,
      text: "go now",
      words: [
        createWord({ text: "go ", begin, end: begin + 1 }),
        createWord({ text: "now", begin: begin + 1, end: begin + 2 }),
      ],
      groupId: "g1",
      instanceIdx,
      templateLineIdx: 0,
    });
  const chorusLines = [chorus("c0", 0, 3), chorus("c1", 1, 10)];
  const rangeOf = (sharesTiming: boolean) =>
    timeRangeResolver(
      chorusLines,
      [createGroup({ id: "g1", ...(sharesTiming ? { sharesTiming: true } : {}) })],
      SONG_END,
    );
  const clipboardAt = (begin: number, end: number, trackType: "word" | "bg" = "word"): ClipboardData => ({
    entries: [{ word: { text: "z", begin, end }, lineOffset: 0, trackType }],
  });
  const paste = (clipboard: ClipboardData, targetLineIndex: number, sharesTiming = true) =>
    applyPasteToLines({ lines: chorusLines, clipboard, targetLineIndex, timeDelta: 0, rangeOf: rangeOf(sharesTiming) });

  it("ends a pasted word where the latest instance reaches the song end", () => {
    expect(paste(clipboardAt(12.5, 13.5), 0)?.[0].updates.words?.[2]).toMatchObject({ begin: 12.5, end: 13 });
  });

  it("starts a pasted word where the earliest instance reaches zero", () => {
    expect(paste(clipboardAt(6.5, 7.5), 1)?.[0].updates.words?.[0]).toMatchObject({ begin: 7, end: 7.5 });
  });

  it("ends a pasted background word inside the range", () => {
    const updates = paste(clipboardAt(12.5, 13.5, "bg"), 0)?.[0].updates;
    expect(updates?.backgroundWords?.[0]).toMatchObject({ begin: 12.5, end: 13 });
  });

  it("blocks a word that lies wholly past the range", () => {
    expect(pasteOverlaps(clipboardAt(13.5, 14), 0, 0, chorusLines, rangeOf(true))).toBe(true);
  });

  describe("edge cases", () => {
    it("allows a word that ends exactly at the range end", () => {
      expect(pasteOverlaps(clipboardAt(12.5, 13), 0, 0, chorusLines, rangeOf(true))).toBe(false);
    });

    it("measures each target line against its own range", () => {
      const clipboard: ClipboardData = {
        entries: [
          { word: { text: "x", begin: 6.5, end: 7.5 }, lineOffset: 0, trackType: "word" },
          { word: { text: "y", begin: 16, end: 16.5 }, lineOffset: 1, trackType: "word" },
        ],
      };
      const updates = paste(clipboard, 0);
      expect(updates?.[0].updates.words?.[2]).toMatchObject({ text: "x", begin: 6.5, end: 7.5 });
      expect(updates?.[1].updates.words?.[2]).toMatchObject({ text: "y", begin: 16, end: 16.5 });
    });
  });

  describe("regressions", () => {
    it("regression: a line of an old group still takes a pasted word up to the song end", () => {
      expect(paste(clipboardAt(12.5, 13.5), 0, false)?.[0].updates.words?.[2]).toMatchObject({
        begin: 12.5,
        end: 13.5,
      });
      expect(pasteOverlaps(clipboardAt(13.5, 14), 0, 0, chorusLines, rangeOf(false))).toBe(false);
    });
  });
});
