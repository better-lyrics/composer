import { describe, expect, it } from "vitest";
import {
  applyBackground,
  backgroundFields,
  buildBackgroundVoice,
  CLEARED_BACKGROUND,
  manualBackgroundWordEdit,
  setBackground,
} from "@/domain/line/background";
import { bgBounds, mainBounds } from "@/domain/line/bounds";
import { reconcileLine } from "@/domain/line/model";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { bgSource, bgText, bgVoice, bgWords, lineText, mainWords } from "@/domain/line/voices";
import { isLineSynced as isVoiceLineSynced } from "@/domain/voice/predicates";
import type { WordTiming } from "@/domain/word/timing";

const line: LyricLine = reconcileLine({ id: "a", text: "hello", agentId: "v1" });

const bgWord: WordTiming = { text: "ooh", begin: 1.2, end: 1.8 };

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
    expect(bgText(withBg)).toBe("ooh");
    expect(bgSource(withBg)).toBe("manual");

    const cleared = applyBackground(withBg, { text: "", source: "manual" });
    expect(bgText(cleared)).toBeUndefined();
    expect(bgWords(cleared)).toBeUndefined();
    expect(bgSource(cleared)).toBeUndefined();
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
    const source: LyricLine = reconcileLine({
      id: "u1",
      text: "verse one",
      agentId: "v2",
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 3,
      detached: true,
    });
    const result = applyBackground(source, { text: "ooh", source: "extraction" });
    expect(result).toMatchObject({
      id: "u1",
      agentId: "v2",
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 3,
      detached: true,
    });
    expect(lineText(result)).toBe("verse one");
  });

  it("preserves the word-synced timing variant", () => {
    const wordSynced: LyricLine = reconcileLine({
      id: "w1",
      text: "hello world",
      agentId: "v1",
      words: [
        { text: "hello ", begin: 0, end: 0.5 },
        { text: "world", begin: 0.5, end: 1 },
      ],
    });
    const result = applyBackground(wordSynced, { text: "ooh", source: "manual" });
    expect(mainWords(result)).toEqual(mainWords(wordSynced));
    expect(isLineSynced(result)).toBe(false);
  });

  it("preserves the line-synced timing variant", () => {
    const lineSynced: LyricLine = reconcileLine({
      id: "l1",
      text: "hello world",
      agentId: "v1",
      begin: 2.5,
      end: 6.75,
    });
    const result = applyBackground(lineSynced, { text: "ooh", source: "extraction" });
    expect(mainBounds(result)?.begin).toBe(2.5);
    expect(mainBounds(result)?.end).toBe(6.75);
    expect(mainWords(result)).toBeUndefined();
  });
});

describe("applyBackground overwriting", () => {
  it("flips an existing manual provenance to extraction", () => {
    const manual = applyBackground(line, { text: "ooh", source: "manual" });
    const overwritten = applyBackground(manual, { text: "aah", source: "extraction" });
    expect(bgText(overwritten)).toBe("aah");
    expect(bgSource(overwritten)).toBe("extraction");
  });

  it("flips an existing extraction provenance to manual", () => {
    const extracted = applyBackground(line, { text: "ooh", source: "extraction" });
    const overwritten = applyBackground(extracted, { text: "aah", source: "manual" });
    expect(bgText(overwritten)).toBe("aah");
    expect(bgSource(overwritten)).toBe("manual");
  });

  it("clears backgroundWords when clearing a line that had words-based background", () => {
    const withWords = applyBackground(line, { words: [bgWord], source: "extraction" });
    expect(bgWords(withWords)).toEqual([bgWord]);
    const cleared = applyBackground(withWords, { text: "", source: "manual" });
    expect(bgWords(cleared)).toBeUndefined();
    expect(bgText(cleared)).toBeUndefined();
    expect(bgSource(cleared)).toBeUndefined();
  });
});

describe("manualBackgroundWordEdit", () => {
  it("stamps source manual and keeps the word array intact", () => {
    const words: WordTiming[] = [
      { text: "ooh ", begin: 0, end: 0.5 },
      { text: "aah", begin: 0.5, end: 1 },
    ];
    const fields = manualBackgroundWordEdit(words);
    expect(fields.backgroundWords).toEqual(words);
    expect(fields.backgroundTextSource).toBe("manual");
  });

  it("derives backgroundText coherently from the word array", () => {
    const fields = manualBackgroundWordEdit([
      { text: "ooh ", begin: 0, end: 0.5 },
      { text: "aah", begin: 0.5, end: 1 },
    ]);
    expect(fields.backgroundText).toBe("ooh aah");
  });

  it("reinserts the split character between syllables with no trailing space", () => {
    const fields = manualBackgroundWordEdit([
      { text: "oh", begin: 0, end: 0.5 },
      { text: "oh", begin: 0.5, end: 1 },
    ]);
    expect(fields.backgroundText).toBe("oh|oh");
  });
});

describe("applyBackground granularity resolution", () => {
  it("makes untimed bg text a line-synced background on a line-synced main", () => {
    const lineSynced: LyricLine = reconcileLine({ id: "ls", text: "hello world", agentId: "v1", begin: 2, end: 6 });
    const result = applyBackground(lineSynced, { text: "ooh", source: "extraction" });
    expect(bgText(result)).toBe("ooh");
    expect(bgBounds(result)).toEqual({ begin: 4, end: 6 });
    expect(bgWords(result)).toBeUndefined();
    const voice = bgVoice(result);
    expect(voice).not.toBeNull();
    expect(isVoiceLineSynced(voice as NonNullable<typeof voice>)).toBe(true);
  });

  it("distributes untimed bg text over a word-synced main's second half", () => {
    const wordSynced: LyricLine = reconcileLine({
      id: "ws",
      text: "hello world",
      agentId: "v1",
      words: [
        { text: "hello ", begin: 0, end: 2 },
        { text: "world", begin: 2, end: 4 },
      ],
    });
    const result = applyBackground(wordSynced, { text: "ooh aah", source: "manual" });
    const words = bgWords(result);
    expect(words).toBeDefined();
    expect(words).toHaveLength(2);
    expect((words as WordTiming[])[0].begin).toBeGreaterThanOrEqual(2);
    expect((words as WordTiming[])[1].end).toBe(4);
  });

  it("keeps untimed bg text untimed on an untimed main", () => {
    const result = applyBackground(line, { text: "ooh", source: "extraction" });
    expect(bgText(result)).toBe("ooh");
    expect(bgWords(result)).toBeUndefined();
    expect(bgBounds(result)).toBeNull();
  });

  it("keeps a word-synced bg verbatim regardless of main state", () => {
    const wordSynced: LyricLine = reconcileLine({
      id: "ws",
      text: "hello world",
      agentId: "v1",
      words: [
        { text: "hello ", begin: 0, end: 2 },
        { text: "world", begin: 2, end: 4 },
      ],
    });
    const inputWords: WordTiming[] = [
      { text: "ooh ", begin: 1, end: 1.5 },
      { text: "aah", begin: 1.5, end: 2 },
    ];
    const result = applyBackground(wordSynced, { words: inputWords, source: "manual" });
    expect(bgWords(result)).toEqual(inputWords);
  });

  it("preserves an extraction source through line-synced resolution", () => {
    const lineSynced: LyricLine = reconcileLine({ id: "ls", text: "hello world", agentId: "v1", begin: 2, end: 6 });
    const result = applyBackground(lineSynced, { text: "ooh", source: "extraction" });
    expect(bgSource(result)).toBe("extraction");
  });

  it("preserves a manual source through distribution", () => {
    const wordSynced: LyricLine = reconcileLine({
      id: "ws",
      text: "hello world",
      agentId: "v1",
      words: [
        { text: "hello ", begin: 0, end: 2 },
        { text: "world", begin: 2, end: 4 },
      ],
    });
    const result = applyBackground(wordSynced, { text: "ooh aah", source: "manual" });
    expect(bgSource(result)).toBe("manual");
  });

  it("clears a line-synced background through the funnel on a blank write", () => {
    const lineSynced: LyricLine = reconcileLine({ id: "ls", text: "hello world", agentId: "v1", begin: 2, end: 6 });
    const withBg = applyBackground(lineSynced, { text: "ooh", source: "extraction" });
    expect(bgBounds(withBg)).toEqual({ begin: 4, end: 6 });
    const cleared = applyBackground(withBg, { text: "   ", source: "manual" });
    expect(bgVoice(cleared)).toBeNull();
    expect("background" in cleared).toBe(false);
  });

  it("clears a word-synced background through the funnel on a blank write", () => {
    const wordSynced: LyricLine = reconcileLine({
      id: "ws",
      text: "hello world",
      agentId: "v1",
      words: [
        { text: "hello ", begin: 0, end: 2 },
        { text: "world", begin: 2, end: 4 },
      ],
    });
    const withBg = applyBackground(wordSynced, { words: [bgWord], source: "manual" });
    expect(bgWords(withBg)).toEqual([bgWord]);
    const cleared = applyBackground(withBg, { text: "", source: "manual" });
    expect(bgVoice(cleared)).toBeNull();
    expect("background" in cleared).toBe(false);
  });
});

describe("setBackground", () => {
  const voice = { text: "ooh", begin: 1, end: 2, source: "manual" } as const;

  it("sets a nested background voice and returns a new reference", () => {
    const snapshot = structuredClone(line);
    const result = setBackground(line, { ...voice });
    expect(result).not.toBe(line);
    expect(bgVoice(result)).toEqual(voice);
    expect(line).toEqual(snapshot);
  });

  it("removes the background key entirely on a null write", () => {
    const withBg = setBackground(line, { ...voice });
    const cleared = setBackground(withBg, null);
    expect("background" in cleared).toBe(false);
    expect(bgVoice(cleared)).toBeNull();
  });

  it("is idempotent when clearing an already-absent background", () => {
    const cleared = setBackground(line, null);
    expect("background" in cleared).toBe(false);
    expect(bgVoice(cleared)).toBeNull();
  });

  it("leaves every background accessor coherent after a clear", () => {
    const withBg = setBackground(line, { text: "ooh", words: [bgWord], source: "extraction" });
    const cleared = setBackground(withBg, null);
    expect(bgText(cleared)).toBeUndefined();
    expect(bgWords(cleared)).toBeUndefined();
    expect(bgSource(cleared)).toBeUndefined();
    expect(bgBounds(cleared)).toBeNull();
  });
});

describe("buildBackgroundVoice", () => {
  it("builds a word-synced voice when words are present, defaulting text to empty", () => {
    expect(buildBackgroundVoice({ words: [bgWord], source: "extraction" })).toEqual({
      text: "",
      words: [bgWord],
      source: "extraction",
    });
  });

  it("builds an untimed voice from text only", () => {
    expect(buildBackgroundVoice({ text: "ooh", source: "manual" })).toEqual({ text: "ooh", source: "manual" });
  });

  it("returns null for whitespace-only text with no words", () => {
    expect(buildBackgroundVoice({ text: "   ", source: "manual" })).toBeNull();
  });

  it("returns null for empty text with no words", () => {
    expect(buildBackgroundVoice({ text: "", source: "extraction" })).toBeNull();
  });

  it("treats an empty words array with text as untimed, not word-synced", () => {
    expect(buildBackgroundVoice({ words: [], text: "ooh", source: "manual" })).toEqual({
      text: "ooh",
      source: "manual",
    });
  });

  it("lets words win when both text and words are present", () => {
    expect(buildBackgroundVoice({ text: "ooh", words: [bgWord], source: "manual" })).toEqual({
      text: "ooh",
      words: [bgWord],
      source: "manual",
    });
  });
});

describe("applyBackground invariants", () => {
  it("composes to a fixed point on a line-synced main", () => {
    const lineSynced: LyricLine = reconcileLine({ id: "ls", text: "hello world", agentId: "v1", begin: 2, end: 6 });
    const params = { text: "ooh", source: "extraction" } as const;
    const once = applyBackground(lineSynced, params);
    const twice = applyBackground(once, params);
    expect(twice).toEqual(once);
  });

  it("does not mutate the input line during resolution", () => {
    const lineSynced: LyricLine = reconcileLine({ id: "ls", text: "hello world", agentId: "v1", begin: 2, end: 6 });
    const snapshot = structuredClone(lineSynced);
    applyBackground(lineSynced, { text: "ooh", source: "extraction" });
    expect(lineSynced).toEqual(snapshot);
  });
});
