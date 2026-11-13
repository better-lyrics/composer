import { describe, expect, it } from "vitest";
import {
  CLEARED_BACKGROUND,
  applyBackground,
  backgroundFields,
  manualBackgroundWordEdit,
  withSeededBackground,
} from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import type { WordTiming } from "@/domain/word/timing";

const line: LyricLine = { id: "a", text: "hello", agentId: "v1" };

const bgWord: WordTiming = { id: "w1", text: "ooh", sep: "", begin: 1.2, end: 1.8, joinsNext: true };

describe("backgroundFields", () => {
  it("stamps the provenance flag alongside the text", () => {
    expect(backgroundFields({ text: "ooh", source: "extraction" })).toEqual({
      backgroundText: "ooh",
      backgroundWords: undefined,
      backgroundTextSource: "extraction",
    });
  });

  it("clears all three fields on an empty write", () => {
    expect(backgroundFields({ text: "", source: "manual" })).toEqual({
      backgroundText: undefined,
      backgroundWords: undefined,
      backgroundTextSource: undefined,
    });
  });
});

describe("backgroundFields edge cases", () => {
  it("treats whitespace-only text as empty and clears all three fields", () => {
    expect(backgroundFields({ text: "   ", source: "manual" })).toEqual({
      backgroundText: undefined,
      backgroundWords: undefined,
      backgroundTextSource: undefined,
    });
  });

  it("keeps words on a words-only write and leaves text undefined", () => {
    expect(backgroundFields({ words: [bgWord], source: "extraction" })).toEqual({
      backgroundText: undefined,
      backgroundWords: [bgWord],
      backgroundTextSource: "extraction",
    });
  });

  it("treats an empty words array as no words", () => {
    expect(backgroundFields({ words: [], source: "extraction" })).toEqual({
      backgroundText: undefined,
      backgroundWords: undefined,
      backgroundTextSource: undefined,
    });
  });

  it("keeps both text and words when both are present, stamping source once", () => {
    expect(backgroundFields({ text: "ooh", words: [bgWord], source: "manual" })).toEqual({
      backgroundText: "ooh",
      backgroundWords: [bgWord],
      backgroundTextSource: "manual",
    });
  });

  it("ignores source when an explicit empty text is written", () => {
    expect(backgroundFields({ text: "", source: "extraction" }).backgroundTextSource).toBeUndefined();
  });

  it("ignores source when no text and no words are supplied", () => {
    expect(backgroundFields({ source: "manual" }).backgroundTextSource).toBeUndefined();
  });
});

describe("CLEARED_BACKGROUND", () => {
  it("equals backgroundFields of an empty write", () => {
    expect(CLEARED_BACKGROUND).toEqual(backgroundFields({ text: "", source: "manual" }));
  });

  it("is a coherent all-undefined triple", () => {
    expect(CLEARED_BACKGROUND).toEqual({
      backgroundText: undefined,
      backgroundWords: undefined,
      backgroundTextSource: undefined,
    });
  });
});

describe("applyBackground", () => {
  it("sets then clears a line's background coherently", () => {
    const withBg = applyBackground(line, { text: "ooh", source: "manual" });
    expect(backgroundText(withBg)).toBe("ooh");
    expect(backgroundTrack(withBg)?.source).toBe("manual");

    const cleared = applyBackground(withBg, { text: "", source: "manual" });
    expect(backgroundText(cleared)).toBeUndefined();
    expect(cleared.backgroundWords).toBeUndefined();
    expect(backgroundTrack(cleared)?.source).toBeUndefined();
  });
});

describe("applyBackground immutability and field preservation", () => {
  it("does not mutate the input line and returns a new reference", () => {
    const snapshot = structuredClone(line);
    const result = applyBackground(line, { text: "ooh", source: "manual" });
    expect(line).toEqual(snapshot);
    expect(result).not.toBe(line);
  });

  it("preserves unrelated fields on an untimed line", () => {
    const source: LyricLine = {
      id: "u1",
      text: "verse one",
      agentId: "v2",
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 3,
      detached: true,
    };
    const result = applyBackground(source, { text: "ooh", source: "extraction" });
    expect(result).toMatchObject({
      id: "u1",
      text: "verse one",
      agentId: "v2",
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 3,
      detached: true,
    });
  });

  it("preserves the word-synced timing variant", () => {
    const wordSynced: LyricLine = {
      id: "w1",
      text: "hello world",
      agentId: "v1",
      words: [
        { id: "w2", text: "hello", sep: " ", begin: 0, end: 0.5, joinsNext: false },
        { id: "w3", text: "world", sep: "", begin: 0.5, end: 1, joinsNext: false },
      ],
    };
    const result = applyBackground(wordSynced, { text: "ooh", source: "manual" });
    expect(timedSyllables(mainTrack(result))).toEqual(timedSyllables(mainTrack(wordSynced)));
    expect(result.begin).toBeUndefined();
    expect(result.end).toBeUndefined();
  });

  it("preserves the line-synced timing variant", () => {
    const lineSynced: LyricLine = {
      id: "l1",
      text: "hello world",
      agentId: "v1",
      begin: 2.5,
      end: 6.75,
    };
    const result = applyBackground(lineSynced, { text: "ooh", source: "extraction" });
    expect(result.begin).toBe(2.5);
    expect(result.end).toBe(6.75);
    expect(result.words).toBeUndefined();
  });
});

describe("applyBackground overwriting", () => {
  it("flips an existing manual provenance to extraction", () => {
    const manual = applyBackground(line, { text: "ooh", source: "manual" });
    const overwritten = applyBackground(manual, { text: "aah", source: "extraction" });
    expect(backgroundText(overwritten)).toBe("aah");
    expect(backgroundTrack(overwritten)?.source).toBe("extraction");
  });

  it("flips an existing extraction provenance to manual", () => {
    const extracted = applyBackground(line, { text: "ooh", source: "extraction" });
    const overwritten = applyBackground(extracted, { text: "aah", source: "manual" });
    expect(backgroundText(overwritten)).toBe("aah");
    expect(backgroundTrack(overwritten)?.source).toBe("manual");
  });

  it("clears backgroundWords when clearing a line that had words-based background", () => {
    const withWords = applyBackground(line, { words: [bgWord], source: "extraction" });
    expect(timedSyllables(backgroundTrack(withWords))).toEqual([bgWord]);
    const cleared = applyBackground(withWords, { text: "", source: "manual" });
    expect(cleared.backgroundWords).toBeUndefined();
    expect(backgroundText(cleared)).toBeUndefined();
    expect(backgroundTrack(cleared)?.source).toBeUndefined();
  });
});

describe("manualBackgroundWordEdit", () => {
  it("stamps source manual and keeps the word array intact", () => {
    const words: WordTiming[] = [
      { id: "w4", text: "ooh", sep: " ", begin: 0, end: 0.5, joinsNext: false },
      { id: "w5", text: "aah", sep: "", begin: 0.5, end: 1, joinsNext: false },
    ];
    const fields = manualBackgroundWordEdit(words);
    expect(fields.backgroundWords).toEqual(words);
    expect(fields.backgroundTextSource).toBe("manual");
  });

  it("derives backgroundText coherently from the word array", () => {
    const fields = manualBackgroundWordEdit([
      { id: "w6", text: "ooh", sep: " ", begin: 0, end: 0.5, joinsNext: false },
      { id: "w7", text: "aah", sep: "", begin: 0.5, end: 1, joinsNext: false },
    ]);
    expect(fields.backgroundText).toBe("ooh aah");
  });

  it("reinserts the split character between syllables with no trailing space", () => {
    const fields = manualBackgroundWordEdit([
      { id: "w8", text: "oh", sep: "", begin: 0, end: 0.5, joinsNext: true },
      { id: "w9", text: "oh", sep: "", begin: 0.5, end: 1, joinsNext: false },
    ]);
    expect(fields.backgroundText).toBe("oh|oh");
  });
});

describe("withSeededBackground", () => {
  const timed: LyricLine = { id: "t", text: "hello", agentId: "v1", begin: 10, end: 14, backgroundText: "ooh ah" };

  it("seeds background words over the second half of a timed line", () => {
    const seeded = withSeededBackground(timed);
    expect(timedSyllables(backgroundTrack(seeded)).map((word) => word.text.trim())).toEqual(["ooh", "ah"]);
    expect(timedSyllables(backgroundTrack(seeded))[0].begin).toBe(12);
    expect(timedSyllables(backgroundTrack(seeded)).at(-1)?.end).toBe(14);
  });

  it("returns the same line when there is nothing to seed", () => {
    const withWords = { ...timed, backgroundWords: [bgWord] };
    const untimed = { ...timed, begin: undefined, end: undefined };
    const noText = { ...timed, backgroundText: undefined };
    const zeroLength = { ...timed, begin: 10, end: 10 };
    const inverted = { ...timed, begin: 14, end: 10 };
    for (const candidate of [withWords, untimed, noText, zeroLength, inverted])
      expect(withSeededBackground(candidate)).toBe(candidate);
  });
});
