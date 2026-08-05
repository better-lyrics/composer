import { useSyncHandlers } from "@/hooks/useSyncHandlers";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { DEFAULTS, useSettingsStore } from "@/stores/settings";
import { createLine, createWord } from "@/test/factories";
import { createBgWordsFromLine, type SyncState } from "@/utils/sync-helpers";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

const ORIGINAL_TEXT = "Hello world how are you";

interface HookProps {
  syncState: SyncState;
  currentTime: number;
}

function noopBool(_value: boolean): void {}

interface MountOptions {
  initialSyncState?: SyncState;
  initialCurrentTime?: number;
  granularity?: "word" | "line";
  editMode?: boolean;
}

async function mountSyncHandlers(opts: MountOptions = {}) {
  let syncState: SyncState = opts.initialSyncState ?? { position: { lineIndex: 0, wordIndex: 0 }, isActive: true };
  const setSyncState = (next: SyncState | ((prev: SyncState) => SyncState)) => {
    syncState = typeof next === "function" ? next(syncState) : next;
  };
  const getSyncState = () => syncState;
  const startTime = opts.initialCurrentTime ?? 0;
  const playingCalls: boolean[] = [];

  const { result, rerender, act } = await renderHook(
    (props?: HookProps) =>
      useSyncHandlers({
        lines: useProjectStore.getState().lines,
        syncState: props?.syncState ?? syncState,
        setSyncState,
        currentTime: props?.currentTime ?? startTime,
        editMode: opts.editMode ?? false,
        granularity: opts.granularity ?? "word",
        setShowPulse: noopBool,
        setIsPlaying: (value) => playingCalls.push(value),
      }),
    { initialProps: { syncState, currentTime: startTime } },
  );

  return { result, rerender, act, getSyncState, playingCalls };
}

describe("useSyncHandlers.handleTap (word granularity)", () => {
  it("preserves line.text across a full word-by-word tap sequence", async () => {
    useProjectStore.getState().setLines([createLine({ id: "l0", text: ORIGINAL_TEXT })]);

    const { result, rerender, act, getSyncState } = await mountSyncHandlers();

    for (let tap = 0; tap < 5; tap++) {
      const currentTime = tap * 0.5;
      await act(() => {
        result.current.handleTap();
      });
      expect(useProjectStore.getState().lines[0].text).toBe(ORIGINAL_TEXT);
      await rerender({ syncState: getSyncState(), currentTime: currentTime + 0.5 });
    }

    expect(useProjectStore.getState().lines[0].words?.length).toBe(5);
    expect(useProjectStore.getState().lines[0].text).toBe(ORIGINAL_TEXT);
  });

  it("preserves both lines' text across a cross-line tap transition", async () => {
    useProjectStore
      .getState()
      .setLines([createLine({ id: "l0", text: "Hello world" }), createLine({ id: "l1", text: "Foo bar" })]);

    const { result, rerender, act, getSyncState } = await mountSyncHandlers();

    for (let tap = 0; tap < 5; tap++) {
      const currentTime = tap * 0.5;
      await act(() => {
        result.current.handleTap();
      });
      expect(useProjectStore.getState().lines[0].text).toBe("Hello world");
      expect(useProjectStore.getState().lines[1].text).toBe("Foo bar");
      await rerender({ syncState: getSyncState(), currentTime: currentTime + 0.5 });
    }

    expect(useProjectStore.getState().lines[0].words?.length).toBe(2);
    expect(useProjectStore.getState().lines[1].words?.length).toBe(2);
    expect(useProjectStore.getState().lines[0].text).toBe("Hello world");
    expect(useProjectStore.getState().lines[1].text).toBe("Foo bar");
  });

  it("re-syncing mid-line overwrites in place and preserves the line's later words", async () => {
    useProjectStore.getState().setLines([
      createLine({
        id: "l0",
        text: ORIGINAL_TEXT,
        words: [
          { text: "Hello ", begin: 0, end: 0.4 },
          { text: "world ", begin: 0.4, end: 0.8 },
          { text: "how ", begin: 0.8, end: 1.2 },
          { text: "are ", begin: 1.2, end: 1.6 },
          { text: "you", begin: 1.6, end: 2.0 },
        ],
      }),
    ]);

    const { result, act } = await mountSyncHandlers({
      initialSyncState: { position: { lineIndex: 0, wordIndex: 1 }, isActive: true },
      initialCurrentTime: 5.0,
    });

    await act(() => {
      result.current.handleTap();
    });

    const words = useProjectStore.getState().lines[0].words;
    expect(useProjectStore.getState().lines[0].text).toBe(ORIGINAL_TEXT);
    expect(words?.length).toBe(5);
    expect(words?.[1].begin).toBe(5.0);
    expect(words?.[0].end).toBe(5.0);
    expect(words?.map((w) => w.text)).toEqual(["Hello ", "world ", "how ", "are ", "you"]);
    for (let i = 0; i < (words?.length ?? 0); i++) {
      const word = words?.[i];
      if (!word) continue;
      expect(word.end).toBeGreaterThanOrEqual(word.begin);
      if (i > 0) expect(word.begin).toBeGreaterThanOrEqual(words![i - 1].end);
    }
  });

  it("regression: a redo past the line's later words never exports a line ending before it begins", async () => {
    useProjectStore.getState().setLines([
      createLine({
        id: "l0",
        text: ORIGINAL_TEXT,
        words: [
          { text: "Hello ", begin: 0, end: 0.4 },
          { text: "world ", begin: 0.4, end: 0.8 },
          { text: "how ", begin: 0.8, end: 1.2 },
          { text: "are ", begin: 1.2, end: 1.6 },
          { text: "you", begin: 1.6, end: 2.0 },
        ],
      }),
    ]);

    const { result, act } = await mountSyncHandlers({
      initialSyncState: { position: { lineIndex: 0, wordIndex: 0 }, isActive: true },
      initialCurrentTime: 5.0,
    });

    await act(() => {
      result.current.handleTap();
    });

    const words = useProjectStore.getState().lines[0].words ?? [];
    expect(words).toHaveLength(5);
    expect(words[0].begin).toBeLessThanOrEqual(words[words.length - 1].end);
  });

  it("regression: skips an empty line and still patches the word before it (issue #114)", async () => {
    useProjectStore
      .getState()
      .setLines([
        createLine({ id: "l0", text: "Hello world" }),
        createLine({ id: "lblank", text: "" }),
        createLine({ id: "l2", text: "Foo bar" }),
      ]);

    const { result, rerender, act, getSyncState } = await mountSyncHandlers();

    await act(() => result.current.handleTap());
    await rerender({ syncState: getSyncState(), currentTime: 0.5 });
    await act(() => result.current.handleTap());

    expect(getSyncState().position.lineIndex).toBe(2);

    await rerender({ syncState: getSyncState(), currentTime: 1.25 });
    await act(() => result.current.handleTap());

    const lines = useProjectStore.getState().lines;
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words?.[1].end).toBe(1.25);
    expect(lines[1].text).toBe("");
    expect(lines[1].words).toBeUndefined();
    expect(lines[2].text).toBe("Foo bar");
    expect(lines[2].words).toHaveLength(1);
  });

  it("preserves prev-line text when patching a partially synced previous line on cross-line tap", async () => {
    useProjectStore.getState().setLines([
      createLine({
        id: "l0",
        text: ORIGINAL_TEXT,
        words: [createWord({ text: "Hello ", begin: 0, end: 0.5 })],
      }),
      createLine({ id: "l1", text: "Next line" }),
    ]);

    const TAP_TIME = 1.25;
    const { result, act } = await mountSyncHandlers({
      initialSyncState: { position: { lineIndex: 1, wordIndex: 0 }, isActive: true },
      initialCurrentTime: TAP_TIME,
    });

    await act(() => {
      result.current.handleTap();
    });

    const lines = useProjectStore.getState().lines;
    expect(lines[0].text).toBe(ORIGINAL_TEXT);
    expect(lines[0].words).toHaveLength(1);
    expect(lines[0].words?.[0].end).toBe(TAP_TIME);
    expect(lines[1].text).toBe("Next line");
    expect(lines[1].words).toHaveLength(1);
  });
});

describe("useSyncHandlers.handleTap (line granularity)", () => {
  it("preserves text on both lines across line-granularity taps", async () => {
    useProjectStore
      .getState()
      .setLines([createLine({ id: "l0", text: "Verse start" }), createLine({ id: "l1", text: "Verse two" })]);

    const { result, rerender, act, getSyncState } = await mountSyncHandlers({ granularity: "line" });

    await act(() => {
      result.current.handleTap();
    });
    expect(useProjectStore.getState().lines[0].text).toBe("Verse start");
    expect(useProjectStore.getState().lines[1].text).toBe("Verse two");
    expect(useProjectStore.getState().lines[0].begin).toBe(0);
    await rerender({ syncState: getSyncState(), currentTime: 1.0 });

    await act(() => {
      result.current.handleTap();
    });
    expect(useProjectStore.getState().lines[0].text).toBe("Verse start");
    expect(useProjectStore.getState().lines[1].text).toBe("Verse two");
    expect(useProjectStore.getState().lines[1].begin).toBe(1.0);
  });
});

describe("useSyncHandlers.handleHold (word granularity)", () => {
  it("preserves text across handleHoldStart followed by handleHoldEnd", async () => {
    const HOLD_TEXT = "Hold this line";
    useProjectStore.getState().setLines([createLine({ id: "l0", text: HOLD_TEXT })]);

    const { result, rerender, act, getSyncState } = await mountSyncHandlers();

    await act(() => {
      result.current.handleHoldStart();
    });
    expect(useProjectStore.getState().lines[0].text).toBe(HOLD_TEXT);
    await rerender({ syncState: getSyncState(), currentTime: 0.5 });

    await act(() => {
      result.current.handleHoldEnd();
    });
    expect(useProjectStore.getState().lines[0].text).toBe(HOLD_TEXT);
    expect(useProjectStore.getState().lines[0].words?.length).toBe(1);
  });

  it("preserves text across a handleHoldTap sequence", async () => {
    const HOLD_TAP_TEXT = "Hold tap test";
    useProjectStore.getState().setLines([createLine({ id: "l0", text: HOLD_TAP_TEXT })]);

    const { result, rerender, act, getSyncState } = await mountSyncHandlers();

    await act(() => {
      result.current.handleHoldStart();
    });
    expect(useProjectStore.getState().lines[0].text).toBe(HOLD_TAP_TEXT);
    await rerender({ syncState: getSyncState(), currentTime: 0.4 });

    await act(() => {
      result.current.handleHoldTap();
    });
    expect(useProjectStore.getState().lines[0].text).toBe(HOLD_TAP_TEXT);
    await rerender({ syncState: getSyncState(), currentTime: 0.8 });

    await act(() => {
      result.current.handleHoldTap();
    });
    expect(useProjectStore.getState().lines[0].text).toBe(HOLD_TAP_TEXT);
  });

  it("preserves text when handleHoldStart re-enters a line that already has words", async () => {
    const TEXT = "Hold this line";
    useProjectStore.getState().setLines([
      createLine({
        id: "l0",
        text: TEXT,
        words: [createWord({ text: "Hold ", begin: 0, end: 0.5 })],
      }),
    ]);

    const { result, act } = await mountSyncHandlers({
      initialSyncState: { position: { lineIndex: 0, wordIndex: 1 }, isActive: true },
      initialCurrentTime: 1.0,
    });

    await act(() => {
      result.current.handleHoldStart();
    });

    const line = useProjectStore.getState().lines[0];
    expect(line.text).toBe(TEXT);
    expect(line.words).toHaveLength(2);
  });

  it("preserves text when handleHoldEnd closes an open trailing word", async () => {
    const TEXT = "End me now";
    useProjectStore.getState().setLines([
      createLine({
        id: "l0",
        text: TEXT,
        words: [createWord({ text: "End ", begin: 0, end: 0 }), createWord({ text: "me ", begin: 1, end: 1 })],
      }),
    ]);

    const END_TIME = 2.0;
    const { result, act } = await mountSyncHandlers({
      initialSyncState: { position: { lineIndex: 0, wordIndex: 1 }, isActive: true },
      initialCurrentTime: END_TIME,
    });

    await act(() => {
      result.current.handleHoldEnd();
    });

    const line = useProjectStore.getState().lines[0];
    expect(line.text).toBe(TEXT);
    expect(line.words?.[1].end).toBe(END_TIME);
  });
});

// -- Mid-line hold redo -------------------------------------------------------

describe("useSyncHandlers.handleHold (mid-line redo)", () => {
  const REDO_TEXT = "one two three";

  function seedFullyTimedLine() {
    useProjectStore.getState().setLines([
      createLine({
        id: "l0",
        text: REDO_TEXT,
        words: [
          createWord({ text: "one ", begin: 0, end: 1 }),
          createWord({ text: "two ", begin: 1, end: 2 }),
          createWord({ text: "three", begin: 2, end: 3 }),
        ],
      }),
    ]);
  }

  it("regression: handleHoldEnd closes the held word, not the last word of the line", async () => {
    seedFullyTimedLine();

    const { result, rerender, act } = await mountSyncHandlers({
      initialSyncState: { position: { lineIndex: 0, wordIndex: 1 }, isActive: true },
      initialCurrentTime: 5,
    });

    await act(() => {
      result.current.handleHoldStart();
    });
    await rerender({ syncState: { position: { lineIndex: 0, wordIndex: 1 }, isActive: true }, currentTime: 6 });
    await act(() => {
      result.current.handleHoldEnd();
    });

    const words = useProjectStore.getState().lines[0].words ?? [];
    expect(words[1]).toMatchObject({ begin: 5, end: 6 });
    expect(words).toHaveLength(3);
    expect(words[2].begin).toBeGreaterThanOrEqual(words[1].end);
  });

  it("regression: handleHoldEnd never leaves a word ending before it begins", async () => {
    useProjectStore.getState().setLines([
      createLine({
        id: "l0",
        text: REDO_TEXT,
        words: [
          createWord({ text: "one ", begin: 0, end: 1 }),
          createWord({ text: "two ", begin: 1, end: 2 }),
          createWord({ text: "three", begin: 10, end: 11 }),
        ],
      }),
    ]);

    const { result, rerender, act } = await mountSyncHandlers({
      initialSyncState: { position: { lineIndex: 0, wordIndex: 1 }, isActive: true },
      initialCurrentTime: 5,
    });

    await act(() => {
      result.current.handleHoldStart();
    });
    await rerender({ syncState: { position: { lineIndex: 0, wordIndex: 1 }, isActive: true }, currentTime: 6 });
    await act(() => {
      result.current.handleHoldEnd();
    });

    for (const word of useProjectStore.getState().lines[0].words ?? []) {
      expect(word.end).toBeGreaterThanOrEqual(word.begin);
    }
  });

  it("regression: handleHoldTap keeps one timing per word instead of appending a duplicate", async () => {
    seedFullyTimedLine();

    const { result, rerender, act } = await mountSyncHandlers({
      initialSyncState: { position: { lineIndex: 0, wordIndex: 1 }, isActive: true },
      initialCurrentTime: 5,
    });

    await act(() => {
      result.current.handleHoldStart();
    });
    await rerender({ syncState: { position: { lineIndex: 0, wordIndex: 1 }, isActive: true }, currentTime: 6 });
    await act(() => {
      result.current.handleHoldTap();
    });

    const line = useProjectStore.getState().lines[0];
    expect(line.text).toBe(REDO_TEXT);
    expect(line.words).toHaveLength(3);
    expect(line.words?.filter((word) => word.text.trim() === "three")).toHaveLength(1);
  });

  it("handleHoldTap opens the next word in place and moves the cursor onto it", async () => {
    seedFullyTimedLine();

    const { result, rerender, act, getSyncState } = await mountSyncHandlers({
      initialSyncState: { position: { lineIndex: 0, wordIndex: 1 }, isActive: true },
      initialCurrentTime: 5,
    });

    await act(() => {
      result.current.handleHoldStart();
    });
    await rerender({ syncState: { position: { lineIndex: 0, wordIndex: 1 }, isActive: true }, currentTime: 6 });
    await act(() => {
      result.current.handleHoldTap();
    });

    const words = useProjectStore.getState().lines[0].words ?? [];
    expect(words[1]).toMatchObject({ begin: 5, end: 6 });
    expect(words[2]).toMatchObject({ text: "three", begin: 6, end: 6 });
    expect(getSyncState().position.wordIndex).toBe(2);
  });

  it("preserves explicit and syllableGroupId when re-holding a mid-line word", async () => {
    useProjectStore.getState().setLines([
      createLine({
        id: "l0",
        text: REDO_TEXT,
        words: [
          createWord({ text: "one ", begin: 0, end: 1 }),
          createWord({ text: "two ", begin: 1, end: 2, explicit: true, syllableGroupId: "g1" }),
          createWord({ text: "three", begin: 2, end: 3 }),
        ],
      }),
    ]);

    const { result, act } = await mountSyncHandlers({
      initialSyncState: { position: { lineIndex: 0, wordIndex: 1 }, isActive: true },
      initialCurrentTime: 5,
    });

    await act(() => {
      result.current.handleHoldStart();
    });

    const words = useProjectStore.getState().lines[0].words ?? [];
    expect(words[1].explicit).toBe(true);
    expect(words[1].syllableGroupId).toBe("g1");
  });
});

describe("useSyncHandlers.handleJumpToLine (smart line redo)", () => {
  function twoSyncedLines() {
    return [
      createLine({
        id: "l0",
        text: "Hello world",
        words: [
          createWord({ text: "Hello ", begin: 0, end: 0.5 }),
          createWord({ text: "world", begin: 0.5, end: 1.0 }),
        ],
      }),
      createLine({
        id: "l1",
        text: "Second line",
        words: [createWord({ text: "Second ", begin: 3, end: 3.5 }), createWord({ text: "line", begin: 3.5, end: 4 })],
      }),
    ];
  }

  it("seeks to a pre-roll before the line and moves the cursor, but stays paused", async () => {
    useProjectStore.getState().setLines(twoSyncedLines());
    const { result, act, getSyncState, playingCalls } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToLine(1));

    expect(getSyncState().position).toEqual({ lineIndex: 1, wordIndex: 0 });
    expect(useAudioStore.getState().currentTime).toBe(3 - DEFAULTS.redoPreroll);
    expect(playingCalls).not.toContain(true);
  });

  it("uses the configured pre-roll instead of the default", async () => {
    useSettingsStore.setState({ redoPreroll: 0.5 });
    useProjectStore.getState().setLines(twoSyncedLines());
    const { result, act } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToLine(1));

    expect(useAudioStore.getState().currentTime).toBe(3 - 0.5);
  });

  it("seeks exactly to the line begin when the pre-roll is zero", async () => {
    useSettingsStore.setState({ redoPreroll: 0 });
    useProjectStore.getState().setLines(twoSyncedLines());
    const { result, act } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToLine(1));

    expect(useAudioStore.getState().currentTime).toBe(3);
  });

  it("clamps the pre-roll seek to zero when the line begins inside the pre-roll window", async () => {
    useProjectStore.getState().setLines([
      createLine({
        id: "l0",
        text: "Early line",
        words: [
          createWord({ text: "Early ", begin: 0.4, end: 0.8 }),
          createWord({ text: "line", begin: 0.8, end: 1.2 }),
        ],
      }),
    ]);
    const { result, act } = await mountSyncHandlers({
      initialSyncState: { position: { lineIndex: 5, wordIndex: 2 }, isActive: true },
    });

    await act(() => result.current.handleJumpToLine(0));

    expect(useAudioStore.getState().currentTime).toBe(0);
  });

  it("only moves the cursor for an unsynced line, without seeking or resuming playback", async () => {
    useProjectStore
      .getState()
      .setLines([
        createLine({ id: "l0", text: "Synced", words: [createWord({ text: "Synced", begin: 0, end: 1 })] }),
        createLine({ id: "l1", text: "Not synced yet" }),
      ]);
    useAudioStore.getState().seekTo(2.5);
    const { result, act, getSyncState, playingCalls } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToLine(1));

    expect(getSyncState().position).toEqual({ lineIndex: 1, wordIndex: 0 });
    expect(useAudioStore.getState().currentTime).toBe(2.5);
    expect(playingCalls).toHaveLength(0);
  });

  it("in edit mode scrubs exactly to the line begin (no pre-roll), moves the cursor, and stays paused", async () => {
    useProjectStore.getState().setLines(twoSyncedLines());
    const { result, act, getSyncState, playingCalls } = await mountSyncHandlers({ editMode: true });

    await act(() => result.current.handleJumpToLine(1));

    expect(useAudioStore.getState().currentTime).toBe(3);
    expect(getSyncState().position).toEqual({ lineIndex: 1, wordIndex: 0 });
    expect(playingCalls).not.toContain(true);
  });

  it("invariant: a redo re-tap commits to the store immediately so it survives a later quit", async () => {
    useProjectStore.getState().setLines(twoSyncedLines());
    const { result, rerender, act, getSyncState } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToLine(1));
    await rerender({ syncState: getSyncState(), currentTime: 5.0 });
    await act(() => result.current.handleTap());

    const line = useProjectStore.getState().lines[1];
    expect(line.text).toBe("Second line");
    expect(line.words?.[0].begin).toBe(5.0);
  });
});

describe("useSyncHandlers.handleJumpToWord (smart word redo)", () => {
  function twoSyncedLines() {
    return [
      createLine({
        id: "l0",
        text: "Hello world",
        words: [
          createWord({ text: "Hello ", begin: 0, end: 0.5 }),
          createWord({ text: "world", begin: 0.5, end: 1.0 }),
        ],
      }),
      createLine({
        id: "l1",
        text: "Second line",
        words: [createWord({ text: "Second ", begin: 3, end: 3.5 }), createWord({ text: "line", begin: 3.5, end: 4 })],
      }),
    ];
  }

  it("seeks to the word's begin minus a pre-roll, moves the cursor to that word, and stays paused", async () => {
    useProjectStore.getState().setLines(twoSyncedLines());
    const { result, act, getSyncState, playingCalls } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToWord(1, 1));

    expect(getSyncState().position).toEqual({ lineIndex: 1, wordIndex: 1 });
    expect(useAudioStore.getState().currentTime).toBe(3.5 - DEFAULTS.redoPreroll);
    expect(playingCalls).not.toContain(true);
  });

  it("uses the configured pre-roll for word redo", async () => {
    useSettingsStore.setState({ redoPreroll: 0.5 });
    useProjectStore.getState().setLines(twoSyncedLines());
    const { result, act } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToWord(1, 1));

    expect(useAudioStore.getState().currentTime).toBe(3.5 - 0.5);
  });

  it("regression: ignores a word with no timing so the cursor cannot desync from the line's text", async () => {
    useProjectStore
      .getState()
      .setLines([
        createLine({ id: "l0", text: "Synced", words: [createWord({ text: "Synced", begin: 0, end: 1 })] }),
        createLine({ id: "l1", text: "Not synced yet" }),
      ]);
    useAudioStore.getState().seekTo(2.5);
    const { result, act, getSyncState } = await mountSyncHandlers();
    const before = getSyncState().position;

    await act(() => result.current.handleJumpToWord(1, 2));

    expect(getSyncState().position).toEqual(before);
    expect(useAudioStore.getState().currentTime).toBe(2.5);
  });

  it("regression: tapping after a jump writes the word at the cursor, not into slot 0", async () => {
    useProjectStore.getState().setLines([
      createLine({
        id: "l0",
        text: "one two three",
        words: [
          createWord({ text: "one ", begin: 0, end: 0.5 }),
          createWord({ text: "two ", begin: 0.5, end: 1 }),
          createWord({ text: "three", begin: 1, end: 1.5 }),
        ],
      }),
    ]);
    const { result, act, rerender, getSyncState } = await mountSyncHandlers({ initialCurrentTime: 4 });

    await act(() => result.current.handleJumpToWord(0, 2));
    expect(getSyncState().position).toEqual({ lineIndex: 0, wordIndex: 2 });

    await rerender({ syncState: { position: { lineIndex: 0, wordIndex: 2 }, isActive: true }, currentTime: 4 });
    await act(() => result.current.handleTap());

    const words = useProjectStore.getState().lines[0].words ?? [];
    expect(words).toHaveLength(3);
    expect(words.map((w) => w.text)).toEqual(["one ", "two ", "three"]);
    expect(words[2].begin).toBe(4);
  });

  it("in edit mode scrubs exactly to the word begin (no pre-roll) and moves the cursor to that word", async () => {
    useProjectStore.getState().setLines(twoSyncedLines());
    const { result, act, getSyncState } = await mountSyncHandlers({ editMode: true });

    await act(() => result.current.handleJumpToWord(1, 1));

    expect(useAudioStore.getState().currentTime).toBe(3.5);
    expect(getSyncState().position).toEqual({ lineIndex: 1, wordIndex: 1 });
  });

  it("pauses playback so a jump never leaves the transport running", async () => {
    useProjectStore.getState().setLines(twoSyncedLines());
    const { result, act, playingCalls } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToWord(1, 1));

    expect(playingCalls).toContain(false);
    expect(playingCalls).not.toContain(true);
  });

  it("regression: re-recording a jumped-to line does not stretch the line before it (issue #132)", async () => {
    useProjectStore.getState().setLines([
      createLine({
        id: "l0",
        text: "first line",
        words: [createWord({ text: "first ", begin: 0, end: 0.5 }), createWord({ text: "line", begin: 0.5, end: 1 })],
      }),
      createLine({
        id: "l1",
        text: "second line",
        words: [createWord({ text: "second ", begin: 8, end: 8.5 }), createWord({ text: "line", begin: 8.5, end: 9 })],
      }),
    ]);
    const { result, act, rerender, getSyncState } = await mountSyncHandlers({ initialCurrentTime: 7 });

    await act(() => result.current.handleJumpToWord(1, 0));
    await rerender({ syncState: getSyncState(), currentTime: 7 });
    await act(() => result.current.handleTap());

    const lines = useProjectStore.getState().lines;
    expect(lines[1].words?.[0].begin).toBe(7);
    expect(lines[0].words?.[1].end).toBe(1);
  });

  it("regression: pressing play after a jump still suppresses the previous-line close (issue #132)", async () => {
    useProjectStore.getState().setLines([
      createLine({
        id: "l0",
        text: "first line",
        words: [createWord({ text: "first ", begin: 0, end: 0.5 }), createWord({ text: "line", begin: 0.5, end: 1 })],
      }),
      createLine({
        id: "l1",
        text: "second line",
        words: [createWord({ text: "second ", begin: 8, end: 8.5 }), createWord({ text: "line", begin: 8.5, end: 9 })],
      }),
    ]);
    const { result, act, rerender, getSyncState } = await mountSyncHandlers({ initialCurrentTime: 7 });

    await act(() => result.current.handleJumpToWord(1, 0));
    await rerender({ syncState: getSyncState(), currentTime: 7 });
    await act(() => result.current.handleStartSync());
    await rerender({ syncState: getSyncState(), currentTime: 7 });
    await act(() => result.current.handleTap());

    expect(useProjectStore.getState().lines[0].words?.[1].end).toBe(1);
  });

  it("regression: a jumped-to line re-record does not stretch the previous line at line granularity", async () => {
    useProjectStore
      .getState()
      .setLines([
        createLine({ id: "l0", text: "first line", begin: 0, end: 1 }),
        createLine({ id: "l1", text: "second line", begin: 8, end: 9 }),
      ]);
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
    useProjectStore.getState().setLines([
      createLine({
        id: "l0",
        text: "one",
        words: [createWord({ text: "one", begin: 0, end: 0.5 })],
      }),
      createLine({ id: "l1", text: "two" }),
    ]);
    const { result, act, rerender, getSyncState } = await mountSyncHandlers({ initialCurrentTime: 0 });

    await act(() => result.current.handleTap());
    await rerender({ syncState: getSyncState(), currentTime: 3 });
    await act(() => result.current.handleTap());

    expect(useProjectStore.getState().lines[0].words?.[0].end).toBe(3);
  });

  it("leaves playback alone in edit mode, where a click is a scrub", async () => {
    useProjectStore.getState().setLines(twoSyncedLines());
    const { result, act, playingCalls } = await mountSyncHandlers({ editMode: true });

    await act(() => result.current.handleJumpToWord(1, 1));

    expect(playingCalls).toHaveLength(0);
    expect(useAudioStore.getState().currentTime).toBe(3.5);
  });
});

// -- Background words ---------------------------------------------------------

describe("useSyncHandlers.handleJumpToBgWord", () => {
  it("scrubs to a background word with the same pre-roll", async () => {
    useProjectStore.getState().setLines([
      createLine({
        id: "l0",
        text: "Main line",
        words: [createWord({ text: "Main ", begin: 0, end: 1 }), createWord({ text: "line", begin: 1, end: 2 })],
        backgroundText: "ooh ahh",
        backgroundWords: [
          createWord({ text: "ooh ", begin: 4, end: 4.5 }),
          createWord({ text: "ahh", begin: 4.5, end: 5 }),
        ],
      }),
    ]);
    const { result, act } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToBgWord(0, 1));

    expect(useAudioStore.getState().currentTime).toBe(4.5 - 1.5);
  });

  it("leaves the sync cursor alone, since it addresses main words only", async () => {
    useProjectStore.getState().setLines([
      createLine({
        id: "l0",
        text: "Main line",
        words: [createWord({ text: "Main ", begin: 0, end: 1 }), createWord({ text: "line", begin: 1, end: 2 })],
        backgroundText: "ooh ahh",
        backgroundWords: [
          createWord({ text: "ooh ", begin: 4, end: 4.5 }),
          createWord({ text: "ahh", begin: 4.5, end: 5 }),
        ],
      }),
    ]);
    const { result, act, getSyncState } = await mountSyncHandlers();
    const before = getSyncState().position;

    await act(() => result.current.handleJumpToBgWord(0, 1));

    expect(getSyncState().position).toEqual(before);
  });

  it("ignores a background word that has no timing", async () => {
    useProjectStore
      .getState()
      .setLines([createLine({ id: "l0", text: "Main", words: [createWord({ text: "Main", begin: 0, end: 1 })] })]);
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
        words: [createWord({ text: "Hello ", begin: 0, end: 0.5 }), createWord({ text: "world", begin: 0.5, end: 1 })],
      }),
      createLine({
        id: "l1",
        text: "Second line",
        words: [createWord({ text: "Second ", begin: 3, end: 3.5 }), createWord({ text: "line", begin: 3.5, end: 4 })],
      }),
    ];
  }

  it("regression: starts at the navigated line instead of resetting to the top", async () => {
    useProjectStore.getState().setLines(twoSyncedLines());
    const { result, act, getSyncState, playingCalls } = await mountSyncHandlers({
      initialSyncState: { position: { lineIndex: 1, wordIndex: 0 }, isActive: false },
    });

    await act(() => result.current.handleStartSync());

    expect(getSyncState().position.lineIndex).toBe(1);
    expect(getSyncState().isActive).toBe(true);
    expect(playingCalls).toContain(true);
  });

  it("preserves the navigated word index when starting", async () => {
    useProjectStore.getState().setLines(twoSyncedLines());
    const { result, act, getSyncState } = await mountSyncHandlers({
      initialSyncState: { position: { lineIndex: 1, wordIndex: 1 }, isActive: false },
    });

    await act(() => result.current.handleStartSync());

    expect(getSyncState().position).toEqual({ lineIndex: 1, wordIndex: 1 });
  });

  it("falls back to the first syncable line when the cursor sits on a non-syncable line", async () => {
    useProjectStore
      .getState()
      .setLines([
        createLine({ id: "l0", text: "" }),
        createLine({ id: "l1", text: "Real line", words: [createWord({ text: "Real ", begin: 2, end: 2.5 })] }),
      ]);
    const { result, act, getSyncState } = await mountSyncHandlers({
      initialSyncState: { position: { lineIndex: 0, wordIndex: 0 }, isActive: false },
    });

    await act(() => result.current.handleStartSync());

    expect(getSyncState().position).toEqual({ lineIndex: 1, wordIndex: 0 });
  });
});

describe("sync-panel bg-init contract", () => {
  it("preserves backgroundText and text when seeding backgroundWords on a synced line", async () => {
    const BG_TEXT = "ooh ahh";
    const ORIGINAL_LINE_TEXT = "Lead vocal melody line";
    useProjectStore.getState().setLines([
      createLine({
        id: "l0",
        text: ORIGINAL_LINE_TEXT,
        backgroundText: BG_TEXT,
        words: [createWord({ text: "Lead ", begin: 0, end: 0.5 }), createWord({ text: "vocal", begin: 0.5, end: 1.0 })],
      }),
    ]);

    const line = useProjectStore.getState().lines[0];
    const bgWords = createBgWordsFromLine(line);
    expect(bgWords).not.toBeNull();
    if (!bgWords) return;

    useProjectStore.getState().updateLine(line.id, { backgroundWords: bgWords }, { deriveText: false });

    expect(useProjectStore.getState().lines[0].backgroundText).toBe(BG_TEXT);
    expect(useProjectStore.getState().lines[0].text).toBe(ORIGINAL_LINE_TEXT);
    expect(useProjectStore.getState().lines[0].backgroundWords?.length).toBeGreaterThan(0);
  });
});
