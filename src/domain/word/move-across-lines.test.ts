/**
 * @vitest-environment node
 */
import { mainBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { bgSource, bgWords, lineText, mainWords } from "@/domain/line/voices";
import type { WordTiming } from "@/domain/word/timing";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";
import { applyWordMoveAcrossLines } from "./move-across-lines";

// -- Helpers ------------------------------------------------------------------

const DURATION = 60;

function findById(lines: LyricLine[], id: string): LyricLine {
  const line = lines.find((l) => l.id === id);
  if (!line) throw new Error(`line ${id} not found`);
  return line;
}

// -- Happy paths --------------------------------------------------------------

describe("applyWordMoveAcrossLines: happy paths", () => {
  it("moves a main word from line A to line B (main -> main)", () => {
    const lineA = createLine({
      id: "A",
      words: [
        { text: "hello ", begin: 0, end: 0.5 },
        { text: "world", begin: 0.5, end: 1 },
      ],
    });
    const lineB = createLine({
      id: "B",
      words: [
        { text: "foo ", begin: 2, end: 2.5 },
        { text: "bar", begin: 2.5, end: 3 },
      ],
    });
    const moved: WordTiming = { text: "world", begin: 5, end: 5.5 };
    const result = applyWordMoveAcrossLines(
      [lineA, lineB],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 1,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: moved,
        },
      ],
      DURATION,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const a = findById(result.lines, "A");
    const b = findById(result.lines, "B");
    expect(mainWords(a)?.map((w) => w.text.trimEnd())).toEqual(["hello"]);
    expect(mainWords(b)?.map((w) => w.text.trimEnd())).toEqual(["foo", "bar", "world"]);
  });

  it("moves a main word into the background track (main -> bg)", () => {
    const lineA = createLine({
      id: "A",
      words: [
        { text: "hello ", begin: 0, end: 0.5 },
        { text: "world", begin: 0.5, end: 1 },
      ],
    });
    const lineB = createLine({
      id: "B",
      words: [{ text: "main", begin: 2, end: 2.5 }],
      backgroundWords: [{ text: "ooh", begin: 3, end: 3.5 }],
      backgroundText: "ooh",
      backgroundTextSource: "manual",
    });
    const moved: WordTiming = { text: "world", begin: 5, end: 5.5 };
    const result = applyWordMoveAcrossLines(
      [lineA, lineB],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 1,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "bg",
          word: moved,
        },
      ],
      DURATION,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const a = findById(result.lines, "A");
    const b = findById(result.lines, "B");
    expect(mainWords(a)?.map((w) => w.text.trimEnd())).toEqual(["hello"]);
    expect(bgWords(b)?.map((w) => w.text.trimEnd())).toEqual(["ooh", "world"]);
    expect(bgSource(b)).toBe("manual");
  });

  it("moves a background word from line A to line B (bg -> bg)", () => {
    const lineA = createLine({
      id: "A",
      words: [{ text: "main", begin: 0, end: 0.5 }],
      backgroundWords: [
        { text: "ooh ", begin: 0.6, end: 0.9 },
        { text: "ahh", begin: 0.9, end: 1.2 },
      ],
      backgroundText: "ooh ahh",
      backgroundTextSource: "manual",
    });
    const lineB = createLine({
      id: "B",
      words: [{ text: "other", begin: 2, end: 2.5 }],
      backgroundWords: [{ text: "yeah", begin: 3, end: 3.5 }],
      backgroundText: "yeah",
      backgroundTextSource: "manual",
    });
    const moved: WordTiming = { text: "ahh", begin: 5, end: 5.5 };
    const result = applyWordMoveAcrossLines(
      [lineA, lineB],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 1,
          sourceTrack: "bg",
          targetLineId: "B",
          targetTrack: "bg",
          word: moved,
        },
      ],
      DURATION,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const a = findById(result.lines, "A");
    const b = findById(result.lines, "B");
    expect(bgWords(a)?.map((w) => w.text.trimEnd())).toEqual(["ooh"]);
    expect(bgWords(b)?.map((w) => w.text.trimEnd())).toEqual(["yeah", "ahh"]);
  });

  it("moves a background word into the main track (bg -> main)", () => {
    const lineA = createLine({
      id: "A",
      words: [{ text: "main", begin: 0, end: 0.5 }],
      backgroundWords: [
        { text: "ooh ", begin: 0.6, end: 0.9 },
        { text: "ahh", begin: 0.9, end: 1.2 },
      ],
      backgroundText: "ooh ahh",
      backgroundTextSource: "manual",
    });
    const lineB = createLine({
      id: "B",
      words: [{ text: "first", begin: 2, end: 2.5 }],
    });
    const moved: WordTiming = { text: "ahh", begin: 5, end: 5.5 };
    const result = applyWordMoveAcrossLines(
      [lineA, lineB],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 1,
          sourceTrack: "bg",
          targetLineId: "B",
          targetTrack: "word",
          word: moved,
        },
      ],
      DURATION,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const a = findById(result.lines, "A");
    const b = findById(result.lines, "B");
    expect(bgWords(a)?.map((w) => w.text.trimEnd())).toEqual(["ooh"]);
    expect(mainWords(b)?.map((w) => w.text.trimEnd())).toEqual(["first", "ahh"]);
  });

  it("moves two main words from one source into one target", () => {
    const lineA = createLine({
      id: "A",
      words: [
        { text: "one ", begin: 0, end: 0.5 },
        { text: "two ", begin: 0.5, end: 1 },
        { text: "three", begin: 1, end: 1.5 },
      ],
    });
    const lineB = createLine({
      id: "B",
      words: [{ text: "alpha", begin: 3, end: 3.5 }],
    });
    const moveW1: WordTiming = { text: "one", begin: 5, end: 5.4 };
    const moveW2: WordTiming = { text: "two", begin: 5.5, end: 5.9 };
    const result = applyWordMoveAcrossLines(
      [lineA, lineB],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 0,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: moveW1,
        },
        {
          sourceLineId: "A",
          sourceWordIndex: 1,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: moveW2,
        },
      ],
      DURATION,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const a = findById(result.lines, "A");
    const b = findById(result.lines, "B");
    expect(mainWords(a)?.map((w) => w.text.trimEnd())).toEqual(["three"]);
    expect(mainWords(b)?.map((w) => w.text.trimEnd())).toEqual(["alpha", "one", "two"]);
  });

  it("moves words from two different source lines into one target line", () => {
    const lineA = createLine({
      id: "A",
      words: [
        { text: "a1 ", begin: 0, end: 0.5 },
        { text: "a2", begin: 0.5, end: 1 },
      ],
    });
    const lineB = createLine({
      id: "B",
      words: [
        { text: "b1 ", begin: 2, end: 2.5 },
        { text: "b2", begin: 2.5, end: 3 },
      ],
    });
    const lineC = createLine({
      id: "C",
      words: [{ text: "c1", begin: 4, end: 4.5 }],
    });
    const fromA: WordTiming = { text: "a2", begin: 6, end: 6.4 };
    const fromB: WordTiming = { text: "b1", begin: 7, end: 7.4 };
    const result = applyWordMoveAcrossLines(
      [lineA, lineB, lineC],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 1,
          sourceTrack: "word",
          targetLineId: "C",
          targetTrack: "word",
          word: fromA,
        },
        {
          sourceLineId: "B",
          sourceWordIndex: 0,
          sourceTrack: "word",
          targetLineId: "C",
          targetTrack: "word",
          word: fromB,
        },
      ],
      DURATION,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const a = findById(result.lines, "A");
    const b = findById(result.lines, "B");
    const c = findById(result.lines, "C");
    expect(mainWords(a)?.map((w) => w.text.trimEnd())).toEqual(["a1"]);
    expect(mainWords(b)?.map((w) => w.text.trimEnd())).toEqual(["b2"]);
    expect(mainWords(c)?.map((w) => w.text.trimEnd())).toEqual(["c1", "a2", "b1"]);
  });
});

// -- Rejections ---------------------------------------------------------------

describe("applyWordMoveAcrossLines: rejections", () => {
  it("rejects cross-instance moves", () => {
    const lineA = createLine({
      id: "A",
      groupId: "g1",
      instanceIdx: 0,
      words: [{ text: "word", begin: 0, end: 0.5 }],
    });
    const lineB = createLine({
      id: "B",
      groupId: "g1",
      instanceIdx: 1,
      words: [{ text: "other", begin: 2, end: 2.5 }],
    });
    const moved: WordTiming = { text: "word", begin: 5, end: 5.5 };
    const result = applyWordMoveAcrossLines(
      [lineA, lineB],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 0,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: moved,
        },
      ],
      DURATION,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected reject");
    expect(result.reject).toBe("cross-instance");
  });

  it("rejects when target is line-synced and target track is word", () => {
    const lineA = createLine({
      id: "A",
      words: [
        { text: "hello ", begin: 0, end: 0.5 },
        { text: "world", begin: 0.5, end: 1 },
      ],
    });
    const lineB = createLine({
      id: "B",
      text: "this is line synced",
      begin: 10,
      end: 12,
    });
    const moved: WordTiming = { text: "world", begin: 5, end: 5.5 };
    const result = applyWordMoveAcrossLines(
      [lineA, lineB],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 1,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: moved,
        },
      ],
      DURATION,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected reject");
    expect(result.reject).toBe("line-synced-target");
  });

  it("rejects when moved word overlaps an existing word on the target track", () => {
    const lineA = createLine({
      id: "A",
      words: [
        { text: "hello ", begin: 0, end: 0.5 },
        { text: "world", begin: 0.5, end: 1 },
      ],
    });
    const lineB = createLine({
      id: "B",
      words: [{ text: "blocker", begin: 5, end: 6 }],
    });
    const moved: WordTiming = { text: "world", begin: 5.3, end: 5.7 };
    const result = applyWordMoveAcrossLines(
      [lineA, lineB],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 1,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: moved,
        },
      ],
      DURATION,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected reject");
    expect(result.reject).toBe("overlap");
  });

  it("rejects when two incoming moves overlap each other on the target track", () => {
    const lineA = createLine({
      id: "A",
      words: [
        { text: "one ", begin: 0, end: 0.5 },
        { text: "two", begin: 0.5, end: 1 },
      ],
    });
    const lineB = createLine({
      id: "B",
      words: [{ text: "anchor", begin: 2, end: 2.5 }],
    });
    const moveW1: WordTiming = { text: "one", begin: 5, end: 5.5 };
    const moveW2: WordTiming = { text: "two", begin: 5.3, end: 5.8 };
    const result = applyWordMoveAcrossLines(
      [lineA, lineB],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 0,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: moveW1,
        },
        {
          sourceLineId: "A",
          sourceWordIndex: 1,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: moveW2,
        },
      ],
      DURATION,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected reject");
    expect(result.reject).toBe("overlap");
  });
});

// -- Invariants ---------------------------------------------------------------

describe("applyWordMoveAcrossLines: invariants", () => {
  it("re-derives source-line text from remaining words", () => {
    const lineA = createLine({
      id: "A",
      words: [
        { text: "alpha ", begin: 0, end: 0.5 },
        { text: "beta ", begin: 0.5, end: 1 },
        { text: "gamma", begin: 1, end: 1.5 },
      ],
    });
    const lineB = createLine({
      id: "B",
      words: [{ text: "x", begin: 2, end: 2.5 }],
    });
    const moved: WordTiming = { text: "beta", begin: 5, end: 5.5 };
    const result = applyWordMoveAcrossLines(
      [lineA, lineB],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 1,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: moved,
        },
      ],
      DURATION,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const a = findById(result.lines, "A");
    expect(lineText(a)).toBe("alpha gamma");
  });

  it("re-derives target-line text after merge", () => {
    const lineA = createLine({
      id: "A",
      words: [
        { text: "hello ", begin: 0, end: 0.5 },
        { text: "world", begin: 0.5, end: 1 },
      ],
    });
    const lineB = createLine({
      id: "B",
      words: [{ text: "foo", begin: 2, end: 2.5 }],
    });
    const moved: WordTiming = { text: "world", begin: 5, end: 5.5 };
    const result = applyWordMoveAcrossLines(
      [lineA, lineB],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 1,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: moved,
        },
      ],
      DURATION,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const b = findById(result.lines, "B");
    expect(lineText(b)).toBe("foo world");
  });

  it("regenerates syllable group ids on inserted words", () => {
    const lineA = createLine({
      id: "A",
      words: [
        { text: "ti", begin: 0, end: 0.4, syllableGroupId: "shared" },
        { text: "tle", begin: 0.4, end: 0.8, syllableGroupId: "shared" },
      ],
    });
    const lineB = createLine({
      id: "B",
      words: [{ text: "anchor", begin: 2, end: 2.5 }],
    });
    const moveW1: WordTiming = { text: "ti", begin: 5, end: 5.4, syllableGroupId: "shared" };
    const moveW2: WordTiming = { text: "tle", begin: 5.4, end: 5.8, syllableGroupId: "shared" };
    const result = applyWordMoveAcrossLines(
      [lineA, lineB],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 0,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: moveW1,
        },
        {
          sourceLineId: "A",
          sourceWordIndex: 1,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: moveW2,
        },
      ],
      DURATION,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const b = findById(result.lines, "B");
    const inserted = mainWords(b)?.filter((w) => w.text.trimEnd() === "ti" || w.text.trimEnd() === "tle") ?? [];
    expect(inserted).toHaveLength(2);
    for (const w of inserted) expect(w.syllableGroupId).not.toBe("shared");
    expect(inserted[0].syllableGroupId).toBeDefined();
    expect(inserted[0].syllableGroupId).toBe(inserted[1].syllableGroupId);
  });

  it("does not mutate the input lines array", () => {
    const lineA = createLine({
      id: "A",
      words: [
        { text: "hello ", begin: 0, end: 0.5 },
        { text: "world", begin: 0.5, end: 1 },
      ],
    });
    const lineB = createLine({
      id: "B",
      words: [{ text: "foo", begin: 2, end: 2.5 }],
    });
    const input = [lineA, lineB];
    const snapshot = JSON.stringify(input);
    applyWordMoveAcrossLines(
      input,
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 1,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: { text: "world", begin: 5, end: 5.5 },
        },
      ],
      DURATION,
    );
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("returns a new array (referential change)", () => {
    const lineA = createLine({
      id: "A",
      words: [
        { text: "hello ", begin: 0, end: 0.5 },
        { text: "world", begin: 0.5, end: 1 },
      ],
    });
    const lineB = createLine({
      id: "B",
      words: [{ text: "foo", begin: 2, end: 2.5 }],
    });
    const input = [lineA, lineB];
    const result = applyWordMoveAcrossLines(
      input,
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 1,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: { text: "world", begin: 5, end: 5.5 },
        },
      ],
      DURATION,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.lines).not.toBe(input);
  });

  it("source line that becomes empty has words: [] and undefined begin/end via reconcileLine", () => {
    const lineA = createLine({
      id: "A",
      words: [{ text: "only", begin: 0, end: 0.5 }],
    });
    const lineB = createLine({
      id: "B",
      words: [{ text: "anchor", begin: 2, end: 2.5 }],
    });
    const moved: WordTiming = { text: "only", begin: 5, end: 5.5 };
    const result = applyWordMoveAcrossLines(
      [lineA, lineB],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 0,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: moved,
        },
      ],
      DURATION,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const a = findById(result.lines, "A");
    expect(mainWords(a)).toEqual([]);
    expect(mainBounds(a)?.begin).toBeUndefined();
    expect(mainBounds(a)?.end).toBeUndefined();
  });
});

// -- Edge cases ---------------------------------------------------------------

describe("applyWordMoveAcrossLines: edge cases", () => {
  it("accepts a move into an empty target line (no words, no begin/end)", () => {
    const lineA = createLine({
      id: "A",
      words: [
        { text: "hello ", begin: 0, end: 0.5 },
        { text: "world", begin: 0.5, end: 1 },
      ],
    });
    const lineB = createLine({ id: "B", text: "" });
    const moved: WordTiming = { text: "world", begin: 5, end: 5.5 };
    const result = applyWordMoveAcrossLines(
      [lineA, lineB],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 1,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: moved,
        },
      ],
      DURATION,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const b = findById(result.lines, "B");
    expect(mainWords(b)?.map((w) => w.text.trimEnd())).toEqual(["world"]);
  });

  it("rejects when target line is line-synced and target track is word", () => {
    const lineA = createLine({
      id: "A",
      words: [{ text: "moved", begin: 0, end: 0.5 }],
    });
    const lineB = createLine({
      id: "B",
      text: "synced line",
      begin: 8,
      end: 9,
    });
    const result = applyWordMoveAcrossLines(
      [lineA, lineB],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 0,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: { text: "moved", begin: 5, end: 5.5 },
        },
      ],
      DURATION,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected reject");
    expect(result.reject).toBe("line-synced-target");
  });

  it("does not falsely overlap an adjacent zero-width-boundary word", () => {
    const lineA = createLine({
      id: "A",
      words: [{ text: "moved", begin: 0, end: 0.5 }],
    });
    const lineB = createLine({
      id: "B",
      words: [{ text: "neighbor", begin: 2, end: 5 }],
    });
    const moved: WordTiming = { text: "moved", begin: 5, end: 5 };
    const result = applyWordMoveAcrossLines(
      [lineA, lineB],
      [
        {
          sourceLineId: "A",
          sourceWordIndex: 0,
          sourceTrack: "word",
          targetLineId: "B",
          targetTrack: "word",
          word: moved,
        },
      ],
      DURATION,
    );
    expect(result.ok).toBe(true);
  });

  it("returns ok with no changes when moves is empty", () => {
    const lineA = createLine({
      id: "A",
      words: [{ text: "only", begin: 0, end: 0.5 }],
    });
    const input = [lineA];
    const result = applyWordMoveAcrossLines(input, [], DURATION);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.lines).toBe(input);
  });
});
