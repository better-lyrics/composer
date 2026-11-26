import { describe, expect, it } from "vitest";
import { timeRangeResolver } from "@/domain/group/shared-timing";
import { pieceOf } from "@/domain/language/pieces";
import { lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import { mainTrack, roleWords } from "@/domain/line/track";
import { withMainTrack, withTrackSpan, withTrackSyllables } from "@/domain/line/track-writes";
import { lineTimingWordId, newWordId } from "@/domain/word/id";
import { wordFromSpaced } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";
import { createGroup, createLine, createWords } from "@/test/factories";
import { patchOf, updatedLine } from "@/test/field-updates";
import { applyPasteToLines, clipboardInLane, pasteOverlaps } from "@/views/timeline/apply-paste-to-lines";
import type { ClipboardData } from "@/views/timeline/selection-types";

// -- Helpers ------------------------------------------------------------------

const line = (id: string, words: WordTiming[] | undefined, text: string): LyricLine =>
  lineFromFields({ id, agentId: "a", text, words }) as LyricLine;

const wholeSong = (duration: number) => timeRangeResolver([], [], duration);

// -- Tests --------------------------------------------------------------------

describe("applyPasteToLines", () => {
  describe("happy paths", () => {
    it("gives a pasted syllable its reading on lines with and without a romanization", () => {
      const reading = {
        language: "ja-Latn",
        origin: "manual" as const,
        sourceFingerprint: "",
        main: { text: "umi" },
      };
      const romanized = { ...line("l1", [], ""), languages: { transliteration: reading } };
      const plain = line("l2", [], "");
      const clipboard: ClipboardData = {
        entries: [0, 1].map((lineOffset) => ({
          word: { id: `w${lineOffset}`, text: "海", sep: "", begin: 1, end: 1.5, joinsNext: false },
          piece: { text: "umi" },
          lineOffset,
          trackType: "word" as const,
        })),
      };
      const updates = applyPasteToLines({
        lines: [romanized, plain],
        clipboard,
        targetLineIndex: 0,
        timeDelta: 0,
        rangeOf: wholeSong(10),
      });
      const [word] = roleWords(updatedLine(updates?.[0].updates), "main") ?? [];
      expect(pieceOf(updates?.[0].updates.languages?.transliteration?.main.pieces, word)).toEqual({ text: "umi" });
      const [plainWord] = roleWords(updatedLine(updates?.[1].updates), "main") ?? [];
      expect(pieceOf(updates?.[1].updates.languages?.heldReadings?.main, plainWord)).toEqual({ text: "umi" });
    });

    it("re-derives main text from the new words after pasting onto an existing line", () => {
      const lines = [
        line(
          "l1",
          [
            { id: "w1", text: "a", sep: " ", begin: 0, end: 0.5, joinsNext: false },
            { id: "w2", text: "b", sep: "", begin: 0.5, end: 1, joinsNext: false },
          ],
          "a b",
        ),
      ];
      const clipboard: ClipboardData = {
        entries: [
          {
            word: { id: "w3", text: "z", sep: "", begin: 2, end: 2.5, joinsNext: true },
            lineOffset: 0,
            trackType: "word",
          },
        ],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, rangeOf: wholeSong(10) });
      expect(updates).not.toBeNull();
      expect(lineText(updatedLine(updates?.[0].updates)!)).toBeDefined();
      expect(lineText(updatedLine(updates?.[0].updates)!)).not.toBe("a b");
      expect(lineText(updatedLine(updates?.[0].updates)!)).toContain("z");
    });

    it("re-derives bg text on bg paste", () => {
      const lines = [line("l1", [{ id: "w4", text: "a", sep: "", begin: 0, end: 0.5, joinsNext: false }], "a")];
      const clipboard: ClipboardData = {
        entries: [
          {
            word: { id: "w5", text: "bgw", sep: "", begin: 1, end: 1.5, joinsNext: true },
            lineOffset: 0,
            trackType: "bg",
          },
        ],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, rangeOf: wholeSong(10) });
      expect(updates).not.toBeNull();
      expect(backgroundText(updatedLine(updates?.[0].updates))).toBeDefined();
    });

    it("distributes entries across multiple destination lines via lineOffset", () => {
      const lines = [
        line("l1", [{ id: "w6", text: "a", sep: "", begin: 0, end: 0.5, joinsNext: false }], "a"),
        line("l2", [{ id: "w7", text: "b", sep: "", begin: 0, end: 0.5, joinsNext: false }], "b"),
      ];
      const clipboard: ClipboardData = {
        entries: [
          {
            word: { id: "w8", text: "x", sep: "", begin: 1, end: 1.5, joinsNext: true },
            lineOffset: 0,
            trackType: "word",
          },
          {
            word: { id: "w9", text: "y", sep: "", begin: 2, end: 2.5, joinsNext: true },
            lineOffset: 1,
            trackType: "word",
          },
        ],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, rangeOf: wholeSong(10) });
      expect(updates).not.toBeNull();
      expect(updates).toHaveLength(2);
      const byId = new Map(updates?.map((u) => [u.id, u]));
      expect(roleWords(updatedLine(byId.get("l1")?.updates), "main")?.some((w) => w.text === "x")).toBe(true);
      expect(roleWords(updatedLine(byId.get("l2")?.updates), "main")?.some((w) => w.text === "y")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("returns null when an entry would land at an out-of-bounds line index", () => {
      const lines = [line("l1", [{ id: "w10", text: "a", sep: "", begin: 0, end: 1, joinsNext: false }], "a")];
      const clipboard: ClipboardData = {
        entries: [
          {
            word: { id: "w11", text: "z", sep: "", begin: 0, end: 0.5, joinsNext: true },
            lineOffset: 5,
            trackType: "word",
          },
        ],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, rangeOf: wholeSong(10) });
      expect(updates).toBeNull();
    });

    it("returns null when targetLineIndex is negative", () => {
      const lines = [line("l1", [{ id: "w12", text: "a", sep: "", begin: 0, end: 1, joinsNext: false }], "a")];
      const clipboard: ClipboardData = {
        entries: [
          {
            word: { id: "w13", text: "z", sep: "", begin: 0, end: 0.5, joinsNext: true },
            lineOffset: 0,
            trackType: "word",
          },
        ],
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
        entries: [
          {
            word: { id: "w14", text: "z", sep: "", begin: -5, end: 100, joinsNext: true },
            lineOffset: 0,
            trackType: "word",
          },
        ],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, rangeOf: wholeSong(10) });
      expect(roleWords(updatedLine(updates?.[0].updates), "main")?.[0].begin).toBe(0);
      expect(roleWords(updatedLine(updates?.[0].updates), "main")?.[0].end).toBe(10);
    });

    it("handles a clipboard with mixed word and bg entries on the same line", () => {
      const lines = [line("l1", [{ id: "w15", text: "a", sep: "", begin: 0, end: 0.5, joinsNext: false }], "a")];
      const clipboard: ClipboardData = {
        entries: [
          {
            word: { id: "w16", text: "mw", sep: "", begin: 1, end: 1.5, joinsNext: true },
            lineOffset: 0,
            trackType: "word",
          },
          {
            word: { id: "w17", text: "bw", sep: "", begin: 2, end: 2.5, joinsNext: true },
            lineOffset: 0,
            trackType: "bg",
          },
        ],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, rangeOf: wholeSong(10) });
      expect(roleWords(updatedLine(updates?.[0].updates), "main")?.some((w) => w.text === "mw")).toBe(true);
      expect(roleWords(updatedLine(updates?.[0].updates), "bg")?.some((w) => w.text === "bw")).toBe(true);
    });
  });

  describe("invariants", () => {
    it("does not mutate input lines", () => {
      const lines = [line("l1", [{ id: "w18", text: "a", sep: "", begin: 0, end: 1, joinsNext: false }], "a")];
      const before = JSON.stringify(lines);
      const clipboard: ClipboardData = {
        entries: [
          {
            word: { id: "w19", text: "z", sep: "", begin: 1, end: 1.5, joinsNext: true },
            lineOffset: 0,
            trackType: "word",
          },
        ],
      };
      applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, rangeOf: wholeSong(10) });
      expect(JSON.stringify(lines)).toBe(before);
    });

    it("applies timeDelta to all pasted entries", () => {
      const lines = [line("l1", [], "")];
      const clipboard: ClipboardData = {
        entries: [
          {
            word: { id: "w20", text: "z", sep: "", begin: 1, end: 2, joinsNext: true },
            lineOffset: 0,
            trackType: "word",
          },
        ],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 2, rangeOf: wholeSong(10) });
      expect(roleWords(updatedLine(updates?.[0].updates), "main")?.[0].begin).toBe(3);
      expect(roleWords(updatedLine(updates?.[0].updates), "main")?.[0].end).toBe(4);
    });
  });
});

describe("pasting onto a line-synced row", () => {
  const lineSynced: LyricLine = lineFromFields({ id: "ls", agentId: "a", text: "It hurts for me", begin: 10, end: 12 });
  const clipboardAt = (begin: number, end: number): ClipboardData => ({
    entries: [
      {
        word: { id: newWordId(), text: "never", sep: "", begin, end, joinsNext: false },
        lineOffset: 0,
        trackType: "word",
      },
    ],
  });

  it("regression: pasting onto a line-synced line of several words writes each word once", () => {
    // A line converted to words once and back to a line span keeps the id its drawn word had on syllable 0.
    const fresh = lineFromFields({ id: "s3", agentId: "a", text: "one two three", begin: 10, end: 12 });
    const main = mainTrack(fresh);
    const renamed = main.syllables.map((syllable, index) =>
      index === 0 ? { ...syllable, id: lineTimingWordId("s3") } : syllable,
    );
    const synced = withMainTrack(fresh, withTrackSpan(withTrackSyllables(main, renamed), 10, 12));
    const updates = applyPasteToLines({
      lines: [synced],
      clipboard: {
        entries: [
          {
            word: { id: newWordId(), text: "yeah", sep: "", begin: 13, end: 13.5, joinsNext: false },
            lineOffset: 0,
            trackType: "word",
          },
        ],
      },
      targetLineIndex: 0,
      timeDelta: 0,
      rangeOf: wholeSong(60),
    });
    expect(lineText(updatedLine(updates?.[0].updates)!)).toBe("one two three yeah");
  });

  it("regression: pasting after the line's span keeps its text and timing as the first word", () => {
    const updates = applyPasteToLines({
      lines: [lineSynced],
      clipboard: clipboardAt(13, 13.5),
      targetLineIndex: 0,
      timeDelta: 0,
      rangeOf: wholeSong(60),
    });
    expect(roleWords(updatedLine(updates?.[0].updates), "main")).toEqual([
      { text: "It hurts for me", sep: " ", begin: 10, end: 12, joinsNext: false },
      { text: "never", sep: "", begin: 13, end: 13.5, joinsNext: false },
    ]);
    expect(lineText(updatedLine(updates?.[0].updates)!)).toContain("It hurts for me");
    expect(lineText(updatedLine(updates?.[0].updates)!)).toContain("never");
  });

  it("regression: a paste inside the line's span counts as an overlap", () => {
    expect(pasteOverlaps(clipboardAt(11, 11.5), 0, 0, [lineSynced], wholeSong(60))).toBe(true);
  });

  it("does not report an overlap for a paste outside the line's span", () => {
    expect(pasteOverlaps(clipboardAt(13, 13.5), 0, 0, [lineSynced], wholeSong(60))).toBe(false);
  });
});

describe("pasteOverlaps", () => {
  const wordLine: LyricLine = lineFromFields({
    id: "w",
    agentId: "a",
    text: "a b",
    words: [
      { id: "w21", text: "a", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w22", text: "b", sep: "", begin: 1, end: 2, joinsNext: false },
    ],
  });

  it("reports an overlap with an existing word", () => {
    const clipboard: ClipboardData = {
      entries: [
        {
          word: { id: "w23", text: "z", sep: "", begin: 0.5, end: 1.5, joinsNext: true },
          lineOffset: 0,
          trackType: "word",
        },
      ],
    };
    expect(pasteOverlaps(clipboard, 0, 0, [wordLine], wholeSong(10))).toBe(true);
  });

  it("allows a paste into free space", () => {
    const clipboard: ClipboardData = {
      entries: [
        {
          word: { id: "w24", text: "z", sep: "", begin: 3, end: 4, joinsNext: true },
          lineOffset: 0,
          trackType: "word",
        },
      ],
    };
    expect(pasteOverlaps(clipboard, 0, 0, [wordLine], wholeSong(10))).toBe(false);
  });

  describe("edge cases", () => {
    it("treats a target line index out of range as blocked", () => {
      const clipboard: ClipboardData = {
        entries: [
          {
            word: { id: "w25", text: "z", sep: "", begin: 3, end: 4, joinsNext: true },
            lineOffset: 1,
            trackType: "word",
          },
        ],
      };
      expect(pasteOverlaps(clipboard, 0, 0, [wordLine], wholeSong(10))).toBe(true);
    });

    it("treats a word clamped to zero width at the song end as blocked", () => {
      const clipboard: ClipboardData = {
        entries: [
          {
            word: { id: "w26", text: "z", sep: "", begin: 12, end: 13, joinsNext: true },
            lineOffset: 0,
            trackType: "word",
          },
        ],
      };
      expect(pasteOverlaps(clipboard, 0, 0, [wordLine], wholeSong(10))).toBe(true);
    });

    it("ignores an untimed target line", () => {
      const untimed: LyricLine = lineFromFields({ id: "u", agentId: "a", text: "free text" });
      const clipboard: ClipboardData = {
        entries: [
          {
            word: { id: "w27", text: "z", sep: "", begin: 3, end: 4, joinsNext: true },
            lineOffset: 0,
            trackType: "word",
          },
        ],
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
      words: createWords([
        { text: "go", sep: " ", begin, end: begin + 1 },
        { text: "now", begin: begin + 1, end: begin + 2 },
      ]),
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
    entries: [{ word: { id: newWordId(), text: "z", sep: "", begin, end, joinsNext: true }, lineOffset: 0, trackType }],
  });
  const paste = (clipboard: ClipboardData, targetLineIndex: number, sharesTiming = true) =>
    applyPasteToLines({ lines: chorusLines, clipboard, targetLineIndex, timeDelta: 0, rangeOf: rangeOf(sharesTiming) });

  it("ends a pasted word where the latest instance reaches the song end", () => {
    expect(roleWords(updatedLine(paste(clipboardAt(12.5, 13.5), 0)?.[0].updates), "main")?.[2]).toMatchObject({
      begin: 12.5,
      end: 13,
    });
  });

  it("starts a pasted word where the earliest instance reaches zero", () => {
    expect(roleWords(updatedLine(paste(clipboardAt(6.5, 7.5), 1)?.[0].updates), "main")?.[0]).toMatchObject({
      begin: 7,
      end: 7.5,
    });
  });

  it("ends a pasted background word inside the range", () => {
    const updates = paste(clipboardAt(12.5, 13.5, "bg"), 0)?.[0].updates;
    expect(roleWords(updatedLine(updates), "bg")?.[0]).toMatchObject({ begin: 12.5, end: 13 });
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
          {
            word: { id: "w28", text: "x", sep: "", begin: 6.5, end: 7.5, joinsNext: true },
            lineOffset: 0,
            trackType: "word",
          },
          {
            word: { id: "w29", text: "y", sep: "", begin: 16, end: 16.5, joinsNext: true },
            lineOffset: 1,
            trackType: "word",
          },
        ],
      };
      const updates = paste(clipboard, 0);
      expect(roleWords(updatedLine(updates?.[0].updates), "main")?.[2]).toMatchObject({
        text: "x",
        sep: "",
        begin: 6.5,
        end: 7.5,
        joinsNext: true,
      });
      expect(roleWords(updatedLine(updates?.[1].updates), "main")?.[2]).toMatchObject({
        text: "y",
        sep: "",
        begin: 16,
        end: 16.5,
        joinsNext: true,
      });
    });
  });

  describe("regressions", () => {
    it("regression: a line of an old group still takes a pasted word up to the song end", () => {
      expect(roleWords(updatedLine(paste(clipboardAt(12.5, 13.5), 0, false)?.[0].updates), "main")?.[2]).toMatchObject({
        begin: 12.5,
        end: 13.5,
      });
      expect(pasteOverlaps(clipboardAt(13.5, 14), 0, 0, chorusLines, rangeOf(false))).toBe(false);
    });
  });
});

describe("pasting into the hovered lane", () => {
  const mainWord = (text: string, begin: number, lineOffset = 0) => ({
    word: wordFromSpaced({ id: newWordId(), text, begin, end: begin + 0.5 }),
    lineOffset,
    trackType: "word" as const,
  });
  const bgWord = (text: string, begin: number, lineOffset = 0) => ({
    ...mainWord(text, begin, lineOffset),
    trackType: "bg" as const,
  });
  const target = () => [line("l1", [{ id: "w30", text: "a", sep: "", begin: 0, end: 0.5, joinsNext: false }], "a")];
  const pasteInto = (clipboard: ClipboardData, lane: "word" | "bg") =>
    applyPasteToLines({
      lines: target(),
      clipboard: clipboardInLane(clipboard, lane),
      targetLineIndex: 0,
      timeDelta: 0,
      rangeOf: wholeSong(10),
    });

  it("regression: words copied from a main lane paste into the hovered background lane", () => {
    const updates = pasteInto({ entries: [mainWord("you", 2)] }, "bg");
    expect(roleWords(updatedLine(updates?.[0].updates), "bg")).toEqual([
      { text: "you", sep: "", begin: 2, end: 2.5, joinsNext: false },
    ]);
    expect("words" in patchOf(updates?.[0].updates, target()[0])).toBe(false);
  });

  it("words copied from a background lane paste into the hovered main lane", () => {
    const updates = pasteInto({ entries: [bgWord("ooh", 2)] }, "word");
    expect(roleWords(updatedLine(updates?.[0].updates), "main")?.map((word) => word.text.trim())).toEqual(["a", "ooh"]);
    expect("backgroundWords" in patchOf(updates?.[0].updates, target()[0])).toBe(false);
  });

  it("checks overlaps against the hovered lane", () => {
    const clipboard = clipboardInLane({ entries: [mainWord("x", 0.2)] }, "bg");
    expect(pasteOverlaps(clipboard, 0, 0, target(), wholeSong(10))).toBe(false);
  });

  describe("invariants", () => {
    it("keeps each word's own lane when the copy spans both lanes", () => {
      const clipboard: ClipboardData = { entries: [mainWord("x", 2), bgWord("y", 3)] };
      expect(clipboardInLane(clipboard, "bg")).toBe(clipboard);
    });

    it("keeps line offsets and timing when moving words to another lane", () => {
      const clipboard: ClipboardData = { entries: [mainWord("x", 2), mainWord("y", 3, 1)] };
      const moved = clipboardInLane(clipboard, "bg");
      expect(moved.entries.map(({ word, lineOffset, trackType }) => [word, lineOffset, trackType])).toEqual([
        [clipboard.entries[0].word, 0, "bg"],
        [clipboard.entries[1].word, 1, "bg"],
      ]);
    });

    it("returns the same clipboard when the words already come from the hovered lane", () => {
      const clipboard: ClipboardData = { entries: [bgWord("x", 2)] };
      expect(clipboardInLane(clipboard, "bg")).toBe(clipboard);
    });
  });
});
