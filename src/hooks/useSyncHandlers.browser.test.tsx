import { beforeEach, describe, expect, it } from "vitest";
import { type PositionalPieces, positionalPieces } from "@/domain/language/pieces";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import type { WordTiming } from "@/domain/word/timing";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { DEFAULTS, useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { createGroup, createLine, createWord, createWords } from "@/test/factories";
import { type LegacyWord, legacyLine, legacyWords, piecesOfLegacyWords } from "@/test/legacy-languages";
import { render } from "@/test/render";
import { at, mountSyncHandlers, positionOf } from "@/test/sync-handlers-harness";
import { SyncPanel } from "@/views/sync/sync-panel";

// These tests cover gestures and holds after playback starts, not the count-in before it.
beforeEach(() => {
  useSettingsStore.setState({ syncCountIn: 0 });
});

const ORIGINAL_TEXT = "Hello world how are you";

describe("useSyncHandlers.handleTap (word granularity)", () => {
  it("preserves line.text across a full word-by-word tap sequence", async () => {
    useProjectStore.getState().restoreLyrics({ lines: [createLine({ id: "l0", text: ORIGINAL_TEXT })] });

    const { result, rerender, act, getSyncState } = await mountSyncHandlers();

    for (let tap = 0; tap < 5; tap++) {
      const currentTime = tap * 0.5;
      await act(() => {
        result.current.handleTap();
      });
      expect(lineText(useProjectStore.getState().lines[0])).toBe(ORIGINAL_TEXT);
      await rerender({ syncState: getSyncState(), currentTime: currentTime + 0.5 });
    }

    expect(useProjectStore.getState().lines[0].words?.length).toBe(5);
    expect(lineText(useProjectStore.getState().lines[0])).toBe(ORIGINAL_TEXT);
  });

  it("preserves both lines' text across a cross-line tap transition", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [createLine({ id: "l0", text: "Hello world" }), createLine({ id: "l1", text: "Foo bar" })],
    });

    const { result, rerender, act, getSyncState } = await mountSyncHandlers();

    for (let tap = 0; tap < 5; tap++) {
      const currentTime = tap * 0.5;
      await act(() => {
        result.current.handleTap();
      });
      expect(lineText(useProjectStore.getState().lines[0])).toBe("Hello world");
      expect(lineText(useProjectStore.getState().lines[1])).toBe("Foo bar");
      await rerender({ syncState: getSyncState(), currentTime: currentTime + 0.5 });
    }

    expect(useProjectStore.getState().lines[0].words?.length).toBe(2);
    expect(useProjectStore.getState().lines[1].words?.length).toBe(2);
    expect(lineText(useProjectStore.getState().lines[0])).toBe("Hello world");
    expect(lineText(useProjectStore.getState().lines[1])).toBe("Foo bar");
  });

  it("re-syncing mid-line overwrites in place and preserves the line's later words", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({
          id: "l0",
          text: ORIGINAL_TEXT,
          words: [
            { text: "Hello", sep: " ", begin: 0, end: 0.4 },
            { text: "world", sep: " ", begin: 0.4, end: 0.8 },
            { text: "how", sep: " ", begin: 0.8, end: 1.2 },
            { text: "are", sep: " ", begin: 1.2, end: 1.6 },
            { text: "you", begin: 1.6, end: 2.0 },
          ],
        }),
      ],
    });

    const { result, act } = await mountSyncHandlers({
      initialSyncState: { position: at(0, 1), isActive: true },
      initialCurrentTime: 5.0,
    });

    await act(() => {
      result.current.handleTap();
    });

    const words = useProjectStore.getState().lines[0].words;
    expect(lineText(useProjectStore.getState().lines[0])).toBe(ORIGINAL_TEXT);
    expect(words?.length).toBe(5);
    expect(words?.[1].begin).toBe(5.0);
    expect(words?.[0].end).toBe(5.0);
    expect(words?.map((w) => w.text + w.sep)).toEqual(["Hello ", "world ", "how ", "are ", "you"]);
    for (let i = 0; i < (words?.length ?? 0); i++) {
      const word = words?.[i];
      if (!word) continue;
      expect(word.end).toBeGreaterThanOrEqual(word.begin);
      if (i > 0) expect(word.begin).toBeGreaterThanOrEqual(words![i - 1].end);
    }
  });

  it("regression: a redo past the line's later words never exports a line ending before it begins", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({
          id: "l0",
          text: ORIGINAL_TEXT,
          words: [
            { text: "Hello", sep: " ", begin: 0, end: 0.4 },
            { text: "world", sep: " ", begin: 0.4, end: 0.8 },
            { text: "how", sep: " ", begin: 0.8, end: 1.2 },
            { text: "are", sep: " ", begin: 1.2, end: 1.6 },
            { text: "you", begin: 1.6, end: 2.0 },
          ],
        }),
      ],
    });

    const { result, act } = await mountSyncHandlers({
      initialSyncState: { position: at(0, 0), isActive: true },
      initialCurrentTime: 5.0,
    });

    await act(() => {
      result.current.handleTap();
    });

    const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(words).toHaveLength(5);
    expect(words[0].begin).toBeLessThanOrEqual(words[words.length - 1].end);
  });

  it("regression: skips an empty line and still patches the word before it (issue #114)", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({ id: "l0", text: "Hello world" }),
        createLine({ id: "lblank", text: "" }),
        createLine({ id: "l2", text: "Foo bar" }),
      ],
    });

    const { result, rerender, act, getSyncState } = await mountSyncHandlers();

    await act(() => result.current.handleTap());
    await rerender({ syncState: getSyncState(), currentTime: 0.5 });
    await act(() => result.current.handleTap());

    expect(positionOf(getSyncState()).lineIndex).toBe(2);

    await rerender({ syncState: getSyncState(), currentTime: 1.25 });
    await act(() => result.current.handleTap());

    const lines = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(lines[0]))).toHaveLength(2);
    expect(timedSyllables(mainTrack(lines[0]))[1].end).toBe(1.25);
    expect(lineText(lines[1])).toBe("");
    expect(lines[1].words).toBeUndefined();
    expect(lineText(lines[2])).toBe("Foo bar");
    expect(timedSyllables(mainTrack(lines[2]))).toHaveLength(1);
  });
});

function splitArguments(replacements: LegacyWord[]): [WordTiming[], PositionalPieces] {
  const { words, pieces } = piecesOfLegacyWords(replacements);
  return [words, positionalPieces(words, pieces)];
}

describe("useSyncHandlers.handleSplitWord", () => {
  it("reconciles manually selected transliteration boundaries with the language track", async () => {
    const line: LyricLine = legacyLine({
      id: "l0",
      agentId: "v1",
      text: "일단은",
      words: [{ id: "w1", text: "일단은", sep: "", begin: 0, end: 1, transliteration: "ildan eun", joinsNext: false }],
      transliteration: {
        language: "ko-Latn",
        text: "ildan eun",
        segments: [{ original: "일단은", transliteration: "ildan eun" }],
        origin: "google" as const,
        sourceFingerprint: "source",
      },
    });
    useProjectStore.getState().restoreLyrics({ lines: [line] });
    const { result, act } = await mountSyncHandlers();

    await act(() => {
      result.current.handleSplitWord(
        0,
        0,
        ...splitArguments([
          {
            id: "w2",
            text: "일",
            sep: "",
            begin: 0,
            end: 0.3,
            transliteration: "i",
            transliterationJoinerAfter: "",
            joinsNext: true,
          },
          {
            id: "w3",
            text: "단",
            sep: "",
            begin: 0.3,
            end: 0.6,
            transliteration: "ldan",
            transliterationJoinerAfter: " ",
            joinsNext: true,
          },
          { id: "w4", text: "은", sep: "", begin: 0.6, end: 1, transliteration: "eun", joinsNext: false },
        ]),
      );
    });

    const saved = useProjectStore.getState().lines[0];
    const savedWords = legacyWords(timedSyllables(mainTrack(saved)), saved.languages) ?? [];
    expect(saved.languages?.transliteration?.main.text).toBe("ildan eun");
    expect(savedWords.map((word) => word.transliteration)).toEqual(["i", "ldan", "eun"]);
    expect(savedWords.map((word) => word.transliterationJoinerAfter)).toEqual(["", " ", undefined]);
  });

  it("regression: keeps the chosen roman split when stored words lost their pieces (#283)", async () => {
    const line: LyricLine = legacyLine({
      id: "l0",
      agentId: "v1",
      text: "Uh 일단은 나",
      words: [
        { id: "w5", text: "Uh", sep: " ", begin: 0, end: 0.5, joinsNext: false },
        { id: "w6", text: "일단은", sep: " ", begin: 0.5, end: 1.5, joinsNext: false },
        { id: "w7", text: "나", sep: "", begin: 1.5, end: 2, joinsNext: false },
      ],
      transliteration: {
        language: "ko-Latn",
        text: "Uh  ildan eun  na",
        segments: [{ original: "Uh 일단은 나", transliteration: "Uh  ildan eun  na" }],
        origin: "google" as const,
        sourceFingerprint: "source",
      },
    });
    useProjectStore.getState().restoreLyrics({ lines: [line] });
    const { result, act } = await mountSyncHandlers();

    await act(() => {
      result.current.handleSplitWord(
        0,
        1,
        ...splitArguments([
          {
            id: "w8",
            text: "일",
            sep: "",
            begin: 0.5,
            end: 0.8,
            transliteration: "il",
            transliterationJoinerAfter: "",
            joinsNext: true,
          },
          { id: "w9", text: "단은", sep: " ", begin: 0.8, end: 1.5, transliteration: "dan eun", joinsNext: false },
        ]),
      );
    });

    const saved = useProjectStore.getState().lines[0];
    expect(legacyWords(timedSyllables(mainTrack(saved)), saved.languages)?.map((word) => word.transliteration)).toEqual(
      ["Uh", "il", "dan eun", "na"],
    );
    expect(saved.languages?.transliteration?.main.text).toBe("Uh  ildan eun  na");
    expect(saved.languages?.transliteration?.main.alignmentStatus).toBe("inferred");
  });
});

describe("useSyncHandlers live audio time (issue #203)", () => {
  function registerAudioAt(time: number): HTMLAudioElement {
    const audioElement = document.createElement("audio");
    useAudioStore.getState().registerAudioElement(audioElement);
    audioElement.currentTime = time;
    return audioElement;
  }

  it("regression: a word tap timestamps from the element's live currentTime, not the throttled store value", async () => {
    useProjectStore.getState().restoreLyrics({ lines: [createLine({ id: "l0", text: "Hello world" })] });
    const audioElement = registerAudioAt(1.234);

    const { result, act } = await mountSyncHandlers({ initialCurrentTime: 1.0 });

    await act(() => result.current.handleTap());

    const begin = useProjectStore.getState().lines[0].words?.[0].begin;
    expect(begin).toBe(audioElement.currentTime);
    expect(begin).not.toBe(1.0);
  });

  it("regression: a line tap timestamps from the element's live currentTime", async () => {
    useProjectStore.getState().restoreLyrics({ lines: [createLine({ id: "l0", text: "Verse start" })] });
    const audioElement = registerAudioAt(2.5);

    const { result, act } = await mountSyncHandlers({ granularity: "line", initialCurrentTime: 2.25 });

    await act(() => result.current.handleTap());

    expect(useProjectStore.getState().lines[0].begin).toBe(audioElement.currentTime);
  });

  it("regression: a hold start timestamps from the element's live currentTime", async () => {
    useProjectStore.getState().restoreLyrics({ lines: [createLine({ id: "l0", text: "Hold this line" })] });
    const audioElement = registerAudioAt(3.75);

    const { result, act } = await mountSyncHandlers({ initialCurrentTime: 3.5 });

    await act(() => result.current.handleHoldStart());

    expect(timedSyllables(mainTrack(useProjectStore.getState().lines[0]))[0].begin).toBe(audioElement.currentTime);
  });

  it("falls back to the prop time when no audio element is registered", async () => {
    useProjectStore.getState().restoreLyrics({ lines: [createLine({ id: "l0", text: "Hello world" })] });

    const { result, act } = await mountSyncHandlers({ initialCurrentTime: 4.2 });

    await act(() => result.current.handleTap());

    expect(timedSyllables(mainTrack(useProjectStore.getState().lines[0]))[0].begin).toBe(4.2);
  });
});

describe("useSyncHandlers.handleTap (line granularity)", () => {
  it("preserves prev-line text when patching a partially synced previous line on cross-line tap", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({
          id: "l0",
          text: ORIGINAL_TEXT,
          words: [createWord({ text: "Hello", sep: " ", begin: 0, end: 0.5 })],
        }),
        createLine({ id: "l1", text: "Next line", words: [createWord({ text: "Next", sep: " ", begin: 3, end: 4 })] }),
      ],
    });

    const TAP_TIME = 1.25;
    const { result, act } = await mountSyncHandlers({
      initialSyncState: { position: at(1, 0), isActive: true },
      initialCurrentTime: TAP_TIME,
      granularity: "line",
    });

    await act(() => {
      result.current.handleTap();
    });

    const lines = useProjectStore.getState().lines;
    expect(lineText(lines[0])).toBe(ORIGINAL_TEXT);
    expect(timedSyllables(mainTrack(lines[0]))).toHaveLength(1);
    expect(timedSyllables(mainTrack(lines[0]))[0].end).toBe(TAP_TIME);
    expect(lineText(lines[1])).toBe("Next line");
    expect(timedSyllables(mainTrack(lines[1]))).toHaveLength(1);
  });

  it("preserves text on both lines across line-granularity taps", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [createLine({ id: "l0", text: "Verse start" }), createLine({ id: "l1", text: "Verse two" })],
    });

    const { result, rerender, act, getSyncState } = await mountSyncHandlers({ granularity: "line" });

    await act(() => {
      result.current.handleTap();
    });
    expect(lineText(useProjectStore.getState().lines[0])).toBe("Verse start");
    expect(lineText(useProjectStore.getState().lines[1])).toBe("Verse two");
    expect(useProjectStore.getState().lines[0].begin).toBe(0);
    await rerender({ syncState: getSyncState(), currentTime: 1.0 });

    await act(() => {
      result.current.handleTap();
    });
    expect(lineText(useProjectStore.getState().lines[0])).toBe("Verse start");
    expect(lineText(useProjectStore.getState().lines[1])).toBe("Verse two");
    expect(useProjectStore.getState().lines[1].begin).toBe(1.0);
  });
});

describe("useSyncHandlers.handleHold (word granularity)", () => {
  it("preserves text across handleHoldStart followed by handleHoldEnd", async () => {
    const HOLD_TEXT = "Hold this line";
    useProjectStore.getState().restoreLyrics({ lines: [createLine({ id: "l0", text: HOLD_TEXT })] });

    const { result, rerender, act, getSyncState } = await mountSyncHandlers();

    await act(() => {
      result.current.handleHoldStart();
    });
    expect(lineText(useProjectStore.getState().lines[0])).toBe(HOLD_TEXT);
    await rerender({ syncState: getSyncState(), currentTime: 0.5 });

    await act(() => {
      result.current.handleHoldEnd();
    });
    expect(lineText(useProjectStore.getState().lines[0])).toBe(HOLD_TEXT);
    expect(useProjectStore.getState().lines[0].words?.length).toBe(1);
  });

  it("preserves text across a handleHoldTap sequence", async () => {
    const HOLD_TAP_TEXT = "Hold tap test";
    useProjectStore.getState().restoreLyrics({ lines: [createLine({ id: "l0", text: HOLD_TAP_TEXT })] });

    const { result, rerender, act, getSyncState } = await mountSyncHandlers();

    await act(() => {
      result.current.handleHoldStart();
    });
    expect(lineText(useProjectStore.getState().lines[0])).toBe(HOLD_TAP_TEXT);
    await rerender({ syncState: getSyncState(), currentTime: 0.4 });

    await act(() => {
      result.current.handleHoldTap();
    });
    expect(lineText(useProjectStore.getState().lines[0])).toBe(HOLD_TAP_TEXT);
    await rerender({ syncState: getSyncState(), currentTime: 0.8 });

    await act(() => {
      result.current.handleHoldTap();
    });
    expect(lineText(useProjectStore.getState().lines[0])).toBe(HOLD_TAP_TEXT);
  });

  it("preserves text when handleHoldStart re-enters a line that already has words", async () => {
    const TEXT = "Hold this line";
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({
          id: "l0",
          text: TEXT,
          words: [createWord({ text: "Hold", sep: " ", begin: 0, end: 0.5 })],
        }),
      ],
    });

    const { result, act } = await mountSyncHandlers({
      initialSyncState: { position: at(0, 1), isActive: true },
      initialCurrentTime: 1.0,
    });

    await act(() => {
      result.current.handleHoldStart();
    });

    const line = useProjectStore.getState().lines[0];
    expect(lineText(line)).toBe(TEXT);
    expect(timedSyllables(mainTrack(line))).toHaveLength(2);
  });

  it("preserves text when handleHoldEnd closes an open trailing word", async () => {
    const TEXT = "End me now";
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({
          id: "l0",
          text: TEXT,
          words: createWords([
            { text: "End", sep: " ", begin: 0, end: 0 },
            { text: "me", sep: " ", begin: 1, end: 1 },
          ]),
        }),
      ],
    });

    const END_TIME = 2.0;
    const { result, act } = await mountSyncHandlers({
      initialSyncState: { position: at(0, 1), isActive: true },
      initialCurrentTime: END_TIME,
    });

    await act(() => {
      result.current.handleHoldEnd();
    });

    const line = useProjectStore.getState().lines[0];
    expect(lineText(line)).toBe(TEXT);
    expect(timedSyllables(mainTrack(line))[1].end).toBe(END_TIME);
  });
});

// -- Mid-line hold redo -------------------------------------------------------

describe("useSyncHandlers.handleHold (mid-line redo)", () => {
  const REDO_TEXT = "one two three";

  function seedFullyTimedLine() {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({
          id: "l0",
          text: REDO_TEXT,
          words: createWords([
            { text: "one", sep: " ", begin: 0, end: 1 },
            { text: "two", sep: " ", begin: 1, end: 2 },
            { text: "three", begin: 2, end: 3 },
          ]),
        }),
      ],
    });
  }

  it("regression: handleHoldEnd closes the held word, not the last word of the line", async () => {
    seedFullyTimedLine();

    const { result, rerender, act } = await mountSyncHandlers({
      initialSyncState: { position: at(0, 1), isActive: true },
      initialCurrentTime: 5,
    });

    await act(() => {
      result.current.handleHoldStart();
    });
    await rerender({ syncState: { position: at(0, 1), isActive: true }, currentTime: 6 });
    await act(() => {
      result.current.handleHoldEnd();
    });

    const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(words[1]).toMatchObject({ begin: 5, end: 6 });
    expect(words).toHaveLength(3);
    expect(words[2].begin).toBeGreaterThanOrEqual(words[1].end);
  });

  it("regression: handleHoldEnd never leaves a word ending before it begins", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({
          id: "l0",
          text: REDO_TEXT,
          words: createWords([
            { text: "one", sep: " ", begin: 0, end: 1 },
            { text: "two", sep: " ", begin: 1, end: 2 },
            { text: "three", begin: 10, end: 11 },
          ]),
        }),
      ],
    });

    const { result, rerender, act } = await mountSyncHandlers({
      initialSyncState: { position: at(0, 1), isActive: true },
      initialCurrentTime: 5,
    });

    await act(() => {
      result.current.handleHoldStart();
    });
    await rerender({ syncState: { position: at(0, 1), isActive: true }, currentTime: 6 });
    await act(() => {
      result.current.handleHoldEnd();
    });

    for (const word of timedSyllables(mainTrack(useProjectStore.getState().lines[0]))) {
      expect(word.end).toBeGreaterThanOrEqual(word.begin);
    }
  });

  it("regression: handleHoldTap keeps one timing per word instead of appending a duplicate", async () => {
    seedFullyTimedLine();

    const { result, rerender, act } = await mountSyncHandlers({
      initialSyncState: { position: at(0, 1), isActive: true },
      initialCurrentTime: 5,
    });

    await act(() => {
      result.current.handleHoldStart();
    });
    await rerender({ syncState: { position: at(0, 1), isActive: true }, currentTime: 6 });
    await act(() => {
      result.current.handleHoldTap();
    });

    const line = useProjectStore.getState().lines[0];
    expect(lineText(line)).toBe(REDO_TEXT);
    expect(timedSyllables(mainTrack(line))).toHaveLength(3);
    expect(timedSyllables(mainTrack(line)).filter((word) => word.text.trim() === "three")).toHaveLength(1);
  });

  it("handleHoldTap opens the next word in place and moves the cursor onto it", async () => {
    seedFullyTimedLine();

    const { result, rerender, act, getSyncState } = await mountSyncHandlers({
      initialSyncState: { position: at(0, 1), isActive: true },
      initialCurrentTime: 5,
    });

    await act(() => {
      result.current.handleHoldStart();
    });
    await rerender({ syncState: { position: at(0, 1), isActive: true }, currentTime: 6 });
    await act(() => {
      result.current.handleHoldTap();
    });

    const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(words[1]).toMatchObject({ begin: 5, end: 6 });
    expect(words[2]).toMatchObject({ text: "three", sep: "", begin: 6, end: 6, joinsNext: false });
    expect(positionOf(getSyncState()).wordIndex).toBe(2);
  });

  it("preserves explicit and syllableGroupId when re-holding a mid-line word", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({
          id: "l0",
          text: REDO_TEXT,
          words: createWords([
            { text: "one", sep: " ", begin: 0, end: 1 },
            { text: "two", sep: " ", begin: 1, end: 2, explicit: true, joinsNext: true },
            { text: "three", begin: 2, end: 3 },
          ]),
        }),
      ],
    });

    const { result, act } = await mountSyncHandlers({
      initialSyncState: { position: at(0, 1), isActive: true },
      initialCurrentTime: 5,
    });

    await act(() => {
      result.current.handleHoldStart();
    });

    const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(words[1].explicit).toBe(true);
    expect(words[1].joinsNext).toBe(true);
  });
});

describe("useSyncHandlers.handleJumpToLine (smart line redo)", () => {
  function twoSyncedLines() {
    return [
      createLine({
        id: "l0",
        text: "Hello world",
        words: createWords([
          { text: "Hello", sep: " ", begin: 0, end: 0.5 },
          { text: "world", begin: 0.5, end: 1.0 },
        ]),
      }),
      createLine({
        id: "l1",
        text: "Second line",
        words: createWords([
          { text: "Second", sep: " ", begin: 3, end: 3.5 },
          { text: "line", begin: 3.5, end: 4 },
        ]),
      }),
    ];
  }

  it("seeks to a pre-roll before the line and moves the cursor, but stays paused", async () => {
    useProjectStore.getState().restoreLyrics({ lines: twoSyncedLines() });
    const { result, act, getSyncState, playingCalls } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToLine(1));

    expect(positionOf(getSyncState())).toEqual({ lineIndex: 1, wordIndex: 0 });
    expect(useAudioStore.getState().currentTime).toBe(3 - DEFAULTS.redoPreroll);
    expect(playingCalls).not.toContain(true);
  });

  it("uses the configured pre-roll instead of the default", async () => {
    useSettingsStore.setState({ redoPreroll: 0.5 });
    useProjectStore.getState().restoreLyrics({ lines: twoSyncedLines() });
    const { result, act } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToLine(1));

    expect(useAudioStore.getState().currentTime).toBe(3 - 0.5);
  });

  it("seeks exactly to the line begin when the pre-roll is zero", async () => {
    useSettingsStore.setState({ redoPreroll: 0 });
    useProjectStore.getState().restoreLyrics({ lines: twoSyncedLines() });
    const { result, act } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToLine(1));

    expect(useAudioStore.getState().currentTime).toBe(3);
  });

  it("clamps the pre-roll seek to zero when the line begins inside the pre-roll window", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({
          id: "l0",
          text: "Early line",
          words: createWords([
            { text: "Early", sep: " ", begin: 0.4, end: 0.8 },
            { text: "line", begin: 0.8, end: 1.2 },
          ]),
        }),
      ],
    });
    const { result, act } = await mountSyncHandlers({
      initialSyncState: { position: at(5, 2), isActive: true },
    });

    await act(() => result.current.handleJumpToLine(0));

    expect(useAudioStore.getState().currentTime).toBe(0);
  });

  it("only moves the cursor for an unsynced line, without seeking or resuming playback", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({ id: "l0", text: "Synced", words: [createWord({ text: "Synced", begin: 0, end: 1 })] }),
        createLine({ id: "l1", text: "Not synced yet" }),
      ],
    });
    useAudioStore.getState().seekTo(2.5);
    const { result, act, getSyncState, playingCalls } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToLine(1));

    expect(positionOf(getSyncState())).toEqual({ lineIndex: 1, wordIndex: 0 });
    expect(useAudioStore.getState().currentTime).toBe(2.5);
    expect(playingCalls).toHaveLength(0);
  });

  it("in edit mode scrubs exactly to the line begin (no pre-roll), moves the cursor, and stays paused", async () => {
    useProjectStore.getState().restoreLyrics({ lines: twoSyncedLines() });
    const { result, act, getSyncState, playingCalls } = await mountSyncHandlers({ editMode: true });

    await act(() => result.current.handleJumpToLine(1));

    expect(useAudioStore.getState().currentTime).toBe(3);
    expect(positionOf(getSyncState())).toEqual({ lineIndex: 1, wordIndex: 0 });
    expect(playingCalls).not.toContain(true);
  });

  it("invariant: a redo re-tap commits to the store immediately so it survives a later quit", async () => {
    useProjectStore.getState().restoreLyrics({ lines: twoSyncedLines() });
    const { result, rerender, act, getSyncState } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToLine(1));
    await rerender({ syncState: getSyncState(), currentTime: 5.0 });
    await act(() => result.current.handleTap());

    const line = useProjectStore.getState().lines[1];
    expect(lineText(line)).toBe("Second line");
    expect(timedSyllables(mainTrack(line))[0].begin).toBe(5.0);
  });
});

describe("useSyncHandlers.handleJumpToWord (smart word redo)", () => {
  function twoSyncedLines() {
    return [
      createLine({
        id: "l0",
        text: "Hello world",
        words: createWords([
          { text: "Hello", sep: " ", begin: 0, end: 0.5 },
          { text: "world", begin: 0.5, end: 1.0 },
        ]),
      }),
      createLine({
        id: "l1",
        text: "Second line",
        words: createWords([
          { text: "Second", sep: " ", begin: 3, end: 3.5 },
          { text: "line", begin: 3.5, end: 4 },
        ]),
      }),
    ];
  }

  it("seeks to the word's begin minus a pre-roll, moves the cursor to that word, and stays paused", async () => {
    useProjectStore.getState().restoreLyrics({ lines: twoSyncedLines() });
    const { result, act, getSyncState, playingCalls } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToWord(1, 1));

    expect(positionOf(getSyncState())).toEqual({ lineIndex: 1, wordIndex: 1 });
    expect(useAudioStore.getState().currentTime).toBe(3.5 - DEFAULTS.redoPreroll);
    expect(playingCalls).not.toContain(true);
  });

  it("uses the configured pre-roll for word redo", async () => {
    useSettingsStore.setState({ redoPreroll: 0.5 });
    useProjectStore.getState().restoreLyrics({ lines: twoSyncedLines() });
    const { result, act } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToWord(1, 1));

    expect(useAudioStore.getState().currentTime).toBe(3.5 - 0.5);
  });

  it("regression: ignores a word with no timing so the cursor cannot desync from the line's text", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({ id: "l0", text: "Synced", words: [createWord({ text: "Synced", begin: 0, end: 1 })] }),
        createLine({ id: "l1", text: "Not synced yet" }),
      ],
    });
    useAudioStore.getState().seekTo(2.5);
    const { result, act, getSyncState } = await mountSyncHandlers();
    const before = getSyncState().position;

    await act(() => result.current.handleJumpToWord(1, 2));

    expect(getSyncState().position).toEqual(before);
    expect(useAudioStore.getState().currentTime).toBe(2.5);
  });

  it("regression: tapping after a jump writes the word at the cursor, not into slot 0", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({
          id: "l0",
          text: "one two three",
          words: createWords([
            { text: "one", sep: " ", begin: 0, end: 0.5 },
            { text: "two", sep: " ", begin: 0.5, end: 1 },
            { text: "three", begin: 1, end: 1.5 },
          ]),
        }),
      ],
    });
    const { result, act, rerender, getSyncState } = await mountSyncHandlers({ initialCurrentTime: 4 });

    await act(() => result.current.handleJumpToWord(0, 2));
    expect(positionOf(getSyncState())).toEqual({ lineIndex: 0, wordIndex: 2 });

    await rerender({ syncState: { position: at(0, 2), isActive: true }, currentTime: 4 });
    await act(() => result.current.handleTap());

    const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(words).toHaveLength(3);
    expect(words.map((w) => w.text + w.sep)).toEqual(["one ", "two ", "three"]);
    expect(words[2].begin).toBe(4);
  });

  it("in edit mode scrubs exactly to the word begin (no pre-roll) and moves the cursor to that word", async () => {
    useProjectStore.getState().restoreLyrics({ lines: twoSyncedLines() });
    const { result, act, getSyncState } = await mountSyncHandlers({ editMode: true });

    await act(() => result.current.handleJumpToWord(1, 1));

    expect(useAudioStore.getState().currentTime).toBe(3.5);
    expect(positionOf(getSyncState())).toEqual({ lineIndex: 1, wordIndex: 1 });
  });

  it("pauses playback so a jump never leaves the transport running", async () => {
    useProjectStore.getState().restoreLyrics({ lines: twoSyncedLines() });
    const { result, act, playingCalls } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToWord(1, 1));

    expect(playingCalls).toContain(false);
    expect(playingCalls).not.toContain(true);
  });

  it("regression: re-recording a jumped-to line does not stretch the line before it (issue #132)", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({
          id: "l0",
          text: "first line",
          words: createWords([
            { text: "first", sep: " ", begin: 0, end: 0.5 },
            { text: "line", begin: 0.5, end: 1 },
          ]),
        }),
        createLine({
          id: "l1",
          text: "second line",
          words: createWords([
            { text: "second", sep: " ", begin: 8, end: 8.5 },
            { text: "line", begin: 8.5, end: 9 },
          ]),
        }),
      ],
    });
    const { result, act, rerender, getSyncState } = await mountSyncHandlers({ initialCurrentTime: 7 });

    await act(() => result.current.handleJumpToWord(1, 0));
    await rerender({ syncState: getSyncState(), currentTime: 7 });
    await act(() => result.current.handleTap());

    const lines = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(lines[1]))[0].begin).toBe(7);
    expect(timedSyllables(mainTrack(lines[0]))[1].end).toBe(1);
  });

  it("regression: pressing play after a jump still suppresses the previous-line close (issue #132)", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({
          id: "l0",
          text: "first line",
          words: createWords([
            { text: "first", sep: " ", begin: 0, end: 0.5 },
            { text: "line", begin: 0.5, end: 1 },
          ]),
        }),
        createLine({
          id: "l1",
          text: "second line",
          words: createWords([
            { text: "second", sep: " ", begin: 8, end: 8.5 },
            { text: "line", begin: 8.5, end: 9 },
          ]),
        }),
      ],
    });
    const { result, act, rerender, getSyncState } = await mountSyncHandlers({ initialCurrentTime: 7 });

    await act(() => result.current.handleJumpToWord(1, 0));
    await rerender({ syncState: getSyncState(), currentTime: 7 });
    await act(() => result.current.handleStartSync());
    await rerender({ syncState: getSyncState(), currentTime: 7 });
    await act(() => result.current.handleTap());

    expect(timedSyllables(mainTrack(useProjectStore.getState().lines[0]))[1].end).toBe(1);
  });

  it("regression: a jumped-to line re-record does not stretch the previous line at line granularity", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({ id: "l0", text: "first line", begin: 0, end: 1 }),
        createLine({ id: "l1", text: "second line", begin: 8, end: 9 }),
      ],
    });
    const { result, act, rerender, getSyncState } = await mountSyncHandlers({
      granularity: "line",
      initialCurrentTime: 7,
    });

    await act(() => result.current.handleJumpToLine(1));
    await rerender({ syncState: getSyncState(), currentTime: 7 });
    await act(() => result.current.handleTap());

    expect(useProjectStore.getState().lines[0].end).toBe(1);
    expect(useProjectStore.getState().lines[1].begin).toBe(7);
  });

  it("still closes the previous line when the cursor advanced there normally", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({
          id: "l0",
          text: "one",
          words: [createWord({ text: "one", begin: 0, end: 0.5 })],
        }),
        createLine({ id: "l1", text: "two" }),
      ],
    });
    const { result, act, rerender, getSyncState } = await mountSyncHandlers({ initialCurrentTime: 0 });

    await act(() => result.current.handleTap());
    await rerender({ syncState: getSyncState(), currentTime: 3 });
    await act(() => result.current.handleTap());

    expect(timedSyllables(mainTrack(useProjectStore.getState().lines[0]))[0].end).toBe(3);
  });

  it("leaves playback alone in edit mode, where a click is a scrub", async () => {
    useProjectStore.getState().restoreLyrics({ lines: twoSyncedLines() });
    const { result, act, playingCalls } = await mountSyncHandlers({ editMode: true });

    await act(() => result.current.handleJumpToWord(1, 1));

    expect(playingCalls).toHaveLength(0);
    expect(useAudioStore.getState().currentTime).toBe(3.5);
  });
});

// -- Background words ---------------------------------------------------------

describe("useSyncHandlers.handleJumpToBgWord", () => {
  it("scrubs to a background word with the same pre-roll", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({
          id: "l0",
          text: "Main line",
          words: createWords([
            { text: "Main", sep: " ", begin: 0, end: 1 },
            { text: "line", begin: 1, end: 2 },
          ]),
          backgroundText: "ooh ahh",
          backgroundWords: createWords([
            { text: "ooh", sep: " ", begin: 4, end: 4.5 },
            { text: "ahh", begin: 4.5, end: 5 },
          ]),
        }),
      ],
    });
    const { result, act } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToBgWord(0, 1));

    expect(useAudioStore.getState().currentTime).toBe(4.5 - 1.5);
  });

  it("leaves the sync cursor alone, since it addresses main words only", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({
          id: "l0",
          text: "Main line",
          words: createWords([
            { text: "Main", sep: " ", begin: 0, end: 1 },
            { text: "line", begin: 1, end: 2 },
          ]),
          backgroundText: "ooh ahh",
          backgroundWords: createWords([
            { text: "ooh", sep: " ", begin: 4, end: 4.5 },
            { text: "ahh", begin: 4.5, end: 5 },
          ]),
        }),
      ],
    });
    const { result, act, getSyncState } = await mountSyncHandlers();
    const before = getSyncState().position;

    await act(() => result.current.handleJumpToBgWord(0, 1));

    expect(getSyncState().position).toEqual(before);
  });

  it("ignores a background word that has no timing", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [createLine({ id: "l0", text: "Main", words: [createWord({ text: "Main", begin: 0, end: 1 })] })],
    });
    useAudioStore.getState().seekTo(2.5);
    const { result, act } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToBgWord(0, 0));

    expect(useAudioStore.getState().currentTime).toBe(2.5);
  });
});

describe("useSyncHandlers.handleStartSync (start at cursor)", () => {
  function twoSyncedLines() {
    return [
      createLine({
        id: "l0",
        text: "Hello world",
        words: createWords([
          { text: "Hello", sep: " ", begin: 0, end: 0.5 },
          { text: "world", begin: 0.5, end: 1 },
        ]),
      }),
      createLine({
        id: "l1",
        text: "Second line",
        words: createWords([
          { text: "Second", sep: " ", begin: 3, end: 3.5 },
          { text: "line", begin: 3.5, end: 4 },
        ]),
      }),
    ];
  }

  it("regression: starts at the navigated line instead of resetting to the top", async () => {
    useProjectStore.getState().restoreLyrics({ lines: twoSyncedLines() });
    const { result, act, getSyncState } = await mountSyncHandlers({
      initialSyncState: { position: at(1, 0), isActive: false },
    });

    await act(() => result.current.handleStartSync());

    expect(positionOf(getSyncState()).lineIndex).toBe(1);
    expect(getSyncState().isActive).toBe(true);
    expect(useAudioStore.getState().isPlaying).toBe(true);
  });

  it("preserves the navigated word index when starting", async () => {
    useProjectStore.getState().restoreLyrics({ lines: twoSyncedLines() });
    const { result, act, getSyncState } = await mountSyncHandlers({
      initialSyncState: { position: at(1, 1), isActive: false },
    });

    await act(() => result.current.handleStartSync());

    expect(positionOf(getSyncState())).toEqual({ lineIndex: 1, wordIndex: 1 });
  });

  it("falls back to the first syncable line when the cursor sits on a non-syncable line", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({ id: "l0", text: "" }),
        createLine({
          id: "l1",
          text: "Real line",
          words: [createWord({ text: "Real", sep: " ", begin: 2, end: 2.5 })],
        }),
      ],
    });
    const { result, act, getSyncState } = await mountSyncHandlers({
      initialSyncState: { position: at(0, 0), isActive: false },
    });

    await act(() => result.current.handleStartSync());

    expect(positionOf(getSyncState())).toEqual({ lineIndex: 1, wordIndex: 0 });
  });
});

describe("sync-panel bg-init contract", () => {
  it("shows only stored background timing and never writes the store on render", async () => {
    const BG_TEXT = "ooh ahh";
    const ORIGINAL_LINE_TEXT = "Lead vocal melody line";
    useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 60, isPlaying: false });
    useProjectStore.getState().restoreLyrics({
      lines: [
        createLine({
          id: "l0",
          text: ORIGINAL_LINE_TEXT,
          backgroundText: BG_TEXT,
          words: createWords([
            { text: "Lead", sep: " ", begin: 0, end: 0.5 },
            { text: "vocal", begin: 0.5, end: 1.0 },
          ]),
        }),
      ],
    });

    const screen = await render(<SyncPanel />);

    expect(screen.container.querySelector('button[title="Jump to this word"]')).toBeNull();

    expect(backgroundText(useProjectStore.getState().lines[0])).toBe(BG_TEXT);
    expect(lineText(useProjectStore.getState().lines[0])).toBe(ORIGINAL_LINE_TEXT);
    expect(useProjectStore.getState().lines[0].backgroundWords).toBeUndefined();
  });
});

describe("useSyncHandlers with shared timing", () => {
  function seedSharedChorus(sharesTiming: boolean): void {
    const chorus = (id: string, instanceIdx: number, begin: number) =>
      createLine({ id, text: "chorus", groupId: "g1", instanceIdx, templateLineIdx: 0, begin, end: begin + 2 });
    useProjectStore.setState({
      lines: [chorus("c0", 0, 3), createLine({ id: "x", text: "verse", begin: 6, end: 7 }), chorus("c1", 1, 10)],
      groups: [createGroup({ id: "g1", ...(sharesTiming ? { sharesTiming: true } : {}) })],
    });
  }

  const lineById = (id: string) => useProjectStore.getState().lines.find((line) => line.id === id);

  it("stops a nudge of the last synced line where the earliest instance reaches zero", async () => {
    seedSharedChorus(true);
    const { result, act } = await mountSyncHandlers({
      granularity: "line",
      initialSyncState: { position: at(3, 0), isActive: true },
    });

    await act(() => {
      result.current.handleNudgeLastSynced(-5);
    });

    expect(lineById("c1")).toMatchObject({ begin: 7, end: 9 });
    expect(lineById("c0")).toMatchObject({ begin: 0, end: 2 });
  });

  it("stops a first word nudge where the earliest instance reaches zero", async () => {
    useProjectStore.setState({
      lines: [
        createLine({
          id: "c0",
          text: "go",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [createWord({ text: "go", begin: 3, end: 4 })],
        }),
        createLine({
          id: "c1",
          text: "go",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [createWord({ text: "go", begin: 10, end: 11 })],
        }),
      ],
      groups: [createGroup({ id: "g1", sharesTiming: true })],
    });
    const { result, act } = await mountSyncHandlers();

    await act(() => {
      result.current.handleNudgeWord(1, 0, -5);
    });

    expect(timedSyllables(mainTrack(lineById("c1")!))[0].begin).toBe(7);
    expect(timedSyllables(mainTrack(lineById("c0")!))[0].begin).toBe(0);
  });

  it("stops a word end nudge where the latest instance reaches the song end", async () => {
    useAudioStore.setState({ duration: 12 });
    useProjectStore.setState({
      lines: [
        createLine({
          id: "c0",
          text: "go",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [createWord({ text: "go", begin: 3, end: 4 })],
        }),
        createLine({
          id: "c1",
          text: "go",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [createWord({ text: "go", begin: 10, end: 11 })],
        }),
      ],
      groups: [createGroup({ id: "g1", sharesTiming: true })],
    });
    const { result, act } = await mountSyncHandlers();

    await act(() => {
      result.current.handleNudgeWordEnd(0, 0, 5);
    });

    expect(timedSyllables(mainTrack(lineById("c1")!))[0].end).toBe(12);
    expect(timedSyllables(mainTrack(lineById("c0")!))[0].end).toBe(5);
  });

  it("regression: nudges a line of an old group by the whole delta", async () => {
    seedSharedChorus(false);
    const { result, act } = await mountSyncHandlers({
      granularity: "line",
      initialSyncState: { position: at(3, 0), isActive: true },
    });

    await act(() => {
      result.current.handleNudgeLastSynced(-5);
    });

    expect(lineById("c1")).toMatchObject({ begin: 5, end: 7 });
    expect(lineById("c0")).toMatchObject({ begin: 3, end: 5 });
  });
});
