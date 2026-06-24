import { REDO_PREROLL_SECONDS, useSyncHandlers } from "@/hooks/useSyncHandlers";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
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

  it("preserves text when re-syncing mid-line over an existing word array", async () => {
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
    });

    await act(() => {
      result.current.handleTap();
    });

    expect(useProjectStore.getState().lines[0].text).toBe(ORIGINAL_TEXT);
    expect(useProjectStore.getState().lines[0].words?.length).toBe(2);
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

  it("seeks to a pre-roll before the line, moves the cursor, and resumes playback", async () => {
    useProjectStore.getState().setLines(twoSyncedLines());
    const { result, act, getSyncState, playingCalls } = await mountSyncHandlers();

    await act(() => result.current.handleJumpToLine(1));

    expect(getSyncState().position).toEqual({ lineIndex: 1, wordIndex: 0 });
    expect(useAudioStore.getState().currentTime).toBe(3 - REDO_PREROLL_SECONDS);
    expect(playingCalls.at(-1)).toBe(true);
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

  it("in edit mode scrubs to the line begin without a pre-roll, cursor move, or playback", async () => {
    useProjectStore.getState().setLines(twoSyncedLines());
    const { result, act, getSyncState, playingCalls } = await mountSyncHandlers({ editMode: true });

    await act(() => result.current.handleJumpToLine(1));

    expect(useAudioStore.getState().currentTime).toBe(3);
    expect(getSyncState().position).toEqual({ lineIndex: 0, wordIndex: 0 });
    expect(playingCalls).toHaveLength(0);
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
