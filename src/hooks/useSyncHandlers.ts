import { reconcileTransliterationAfterSyllableSplit } from "@/domain/language/reconcile-syllable-split";
import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { hasAnyTiming } from "@/domain/line/predicates";
import { shiftLineTiming } from "@/domain/line/shift";
import { isSyncableLine } from "@/domain/line/sync-progress";
import { commitGesture, type SyncGesture } from "@/domain/sync/commit-gesture";
import { isCursorPastEnd, nextSyncableLineIndex, previousSlot, resolveSyncCursor } from "@/domain/sync/cursor";
import type { WordTiming } from "@/domain/word/timing";
import { useAudioStore } from "@/stores/audio";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { formatTimeMs, type SyncState, splitIntoWords } from "@/utils/sync-helpers";
import { nudgeBgWordBegin, nudgeBgWordEnd, setBgWordBegin, setBgWordEnd } from "@/utils/timing/bg-word-timing";
import { nudgeLineBegin, setLineBegin } from "@/utils/timing/line-timing";
import { nudgeWordBegin, nudgeWordEnd, setWordBegin, setWordEnd } from "@/utils/timing/word-timing";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

interface UseSyncHandlersProps {
  lines: LyricLine[];
  syncState: SyncState;
  setSyncState: React.Dispatch<React.SetStateAction<SyncState>>;
  currentTime: number;
  editMode: boolean;
  granularity: "line" | "word";
  setShowPulse: (show: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
}

// -- Constants ------------------------------------------------------------------

const EARLY_TAP_TOAST_ID = "sync-early-tap";

// -- Helpers --------------------------------------------------------------------

function triggerPulse(setShowPulse: (show: boolean) => void): void {
  setShowPulse(true);
  setTimeout(() => setShowPulse(false), 100);
}

// -- Hook ---------------------------------------------------------------------

function useSyncHandlers({
  lines,
  syncState,
  setSyncState,
  currentTime,
  editMode,
  granularity,
  setShowPulse,
  setIsPlaying,
}: UseSyncHandlersProps) {
  const seekTo = useAudioStore((s) => s.seekTo);
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
  const updateLinesWithHistory = useProjectStore((s) => s.updateLinesWithHistory);
  const confirm = useConfirm();

  const cursor = useMemo(
    () => resolveSyncCursor(lines, syncState.position, !!syncState.jumpedToPosition, granularity),
    [lines, syncState.position, syncState.jumpedToPosition, granularity],
  );
  const { lineIndex, wordIndex } = cursor;
  const currentLine = lines[lineIndex];
  const isComplete = isCursorPastEnd(lines, cursor);

  // Store `currentTime` only advances on `timeupdate` (~4 Hz); read the element's
  // live clock so taps under that interval don't collide into zero-length syllables.
  const readTapTime = useCallback(
    () => useAudioStore.getState().audioElement?.currentTime ?? currentTime,
    [currentTime],
  );

  const runGesture = useCallback(
    (gesture: SyncGesture): boolean => {
      const commit = commitGesture(lines, gesture, {
        cursor,
        jumped: !!syncState.jumpedToPosition,
        time: readTapTime(),
        defaultWordDuration: useSettingsStore.getState().defaultWordDuration,
      });
      if (!commit) return false;
      updateLinesWithHistory(commit.lineUpdates, { deriveText: false, propagateToSiblings: false });
      setSyncState((prev) => ({ ...prev, position: commit.nextCursor, jumpedToPosition: commit.nextJumped }));
      if (commit.clampedTo !== null) {
        toast(`Early tap snapped to ${formatTimeMs(commit.clampedTo)}`, { id: EARLY_TAP_TOAST_ID });
      }
      return true;
    },
    [lines, cursor, syncState.jumpedToPosition, readTapTime, updateLinesWithHistory, setSyncState],
  );

  const handleTap = useCallback(() => {
    if (runGesture(granularity === "word" ? "tap-word" : "tap-line")) triggerPulse(setShowPulse);
  }, [runGesture, granularity, setShowPulse]);

  const handleHoldStart = useCallback(() => {
    runGesture("hold-start");
  }, [runGesture]);

  const handleHoldEnd = useCallback(() => {
    if (runGesture("hold-end")) triggerPulse(setShowPulse);
  }, [runGesture, setShowPulse]);

  const handleHoldTap = useCallback(() => {
    if (runGesture("hold-tap")) triggerPulse(setShowPulse);
  }, [runGesture, setShowPulse]);

  const handleReset = useCallback(async () => {
    if (lines.some(hasAnyTiming)) {
      const ok = await confirm({
        title: "Reset all sync timing?",
        description: "Clear every word and line timing in this project.",
        confirmLabel: "Reset",
        variant: "destructive",
        settingsKey: "confirmSyncReset",
        recoverable: true,
      });
      if (!ok) return;
    }

    const updates = lines.map((line) => ({
      id: line.id,
      updates: {
        words: undefined,
        begin: undefined,
        end: undefined,
        backgroundWords: undefined,
      },
    }));
    useProjectStore.getState().updateLinesWithHistory(updates, { propagateToSiblings: false });
    setSyncState({ position: { lineIndex: 0, wordIndex: 0 }, isActive: false });
  }, [lines, setSyncState, confirm]);

  const handleStartSync = useCallback(() => {
    const { lineIndex: cursorLine, wordIndex: cursorWord } = cursor;
    const startLine = isSyncableLine(lines[cursorLine]) ? cursorLine : nextSyncableLineIndex(lines, -1);
    const startWord = startLine === cursorLine ? cursorWord : 0;
    // Pressing play is how a re-record actually starts, so it has to carry the
    // jump forward. Only a cursor that had to be relocated counts as a fresh
    // forward pass.
    setSyncState((prev) => ({
      ...prev,
      position: { lineIndex: startLine, wordIndex: startWord },
      isActive: true,
      jumpedToPosition: startLine === cursorLine ? prev.jumpedToPosition : false,
    }));
    setIsPlaying(true);
  }, [lines, cursor, setIsPlaying, setSyncState]);

  // Re-recording seeks back and waits for the user to start playback. Edit mode
  // is the exception: there a click is a scrub for auditioning timings, so
  // playback is left alone.
  const seekForRedo = useCallback(
    (begin: number) => {
      if (editMode) {
        seekTo(begin);
        return;
      }
      setIsPlaying(false);
      const preroll = useSettingsStore.getState().redoPreroll;
      seekTo(Math.max(0, begin - preroll));
    },
    [editMode, seekTo, setIsPlaying],
  );

  const handleJumpToLine = useCallback(
    (index: number) => {
      setSyncState((prev) => ({
        ...prev,
        position: { lineIndex: index, wordIndex: 0 },
        jumpedToPosition: true,
      }));
      const bounds = effectiveBounds(lines[index]);
      if (!bounds) return;
      seekForRedo(bounds.begin);
    },
    [lines, seekForRedo, setSyncState],
  );

  // Only a word that already carries timing can be re-recorded: parking the
  // cursor on an untimed word would make the next tap write it into slot 0 and
  // silently drop every word before it.
  const handleJumpToWord = useCallback(
    (lineIdx: number, wordIdx: number) => {
      const word = lines[lineIdx]?.words?.[wordIdx];
      if (!word) return;
      setSyncState((prev) => ({
        ...prev,
        position: { lineIndex: lineIdx, wordIndex: wordIdx },
        jumpedToPosition: true,
      }));
      seekForRedo(word.begin);
    },
    [lines, seekForRedo, setSyncState],
  );

  // The sync cursor addresses main words only, so a background word can be
  // scrubbed to but not re-recorded from. Moving the cursor here would make the
  // next tap overwrite the main word at the same index.
  const handleJumpToBgWord = useCallback(
    (lineIdx: number, wordIdx: number) => {
      const word = lines[lineIdx]?.backgroundWords?.[wordIdx];
      if (!word) return;
      seekForRedo(word.begin);
    },
    [lines, seekForRedo],
  );

  const handleNudgeWord = useCallback(
    (lineIdx: number, wordIdx: number, delta: number) =>
      nudgeWordBegin(lines, lineIdx, wordIdx, delta, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleSetWordTime = useCallback(
    (lineIdx: number, wordIdx: number, newBegin: number) =>
      setWordBegin(lines, lineIdx, wordIdx, newBegin, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleNudgeWordEnd = useCallback(
    (lineIdx: number, wordIdx: number, delta: number) =>
      nudgeWordEnd(lines, lineIdx, wordIdx, delta, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleSetWordEndTime = useCallback(
    (lineIdx: number, wordIdx: number, newEnd: number) =>
      setWordEnd(lines, lineIdx, wordIdx, newEnd, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleNudgeLine = useCallback(
    (lineIdx: number, delta: number) => nudgeLineBegin(lines, lineIdx, delta, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleSetLineTime = useCallback(
    (lineIdx: number, newBegin: number) => setLineBegin(lines, lineIdx, newBegin, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleNudgeLastSynced = useCallback(
    (delta: number) => {
      const slot = previousSlot(lines, cursor, granularity);
      if (!slot) return;
      if (slot.wordIndex !== null) {
        handleNudgeWord(slot.lineIndex, slot.wordIndex, delta);
        return;
      }
      const line = lines[slot.lineIndex];
      updateLinesWithHistory([{ id: line.id, updates: shiftLineTiming(line, delta) }], {
        deriveText: false,
        propagateToSiblings: false,
      });
    },
    [lines, cursor, granularity, handleNudgeWord, updateLinesWithHistory],
  );

  const handleSplitWord = useCallback(
    (lineIdx: number, wordIdx: number, newWords: WordTiming[]) => {
      const line = lines[lineIdx];
      if (!line?.words) return;

      const updatedWords = [...line.words];
      updatedWords.splice(wordIdx, 1, ...newWords);
      const newLineText = updatedWords
        .map((w) => w.text)
        .join("")
        .trimEnd();
      const transliteration = reconcileTransliterationAfterSyllableSplit(line, "words", wordIdx, newWords);
      updateLineWithHistory(line.id, {
        words: updatedWords,
        text: newLineText,
        ...(transliteration ? { transliteration } : {}),
      });
    },
    [lines, updateLineWithHistory],
  );

  const handleNudgeBgWord = useCallback(
    (lineIdx: number, wordIdx: number, delta: number) =>
      nudgeBgWordBegin(lines, lineIdx, wordIdx, delta, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleSetBgWordTime = useCallback(
    (lineIdx: number, wordIdx: number, newBegin: number) =>
      setBgWordBegin(lines, lineIdx, wordIdx, newBegin, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleNudgeBgWordEnd = useCallback(
    (lineIdx: number, wordIdx: number, delta: number) =>
      nudgeBgWordEnd(lines, lineIdx, wordIdx, delta, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  const handleSetBgWordEndTime = useCallback(
    (lineIdx: number, wordIdx: number, newEnd: number) =>
      setBgWordEnd(lines, lineIdx, wordIdx, newEnd, updateLineWithHistory),
    [lines, updateLineWithHistory],
  );

  return {
    handleTap,
    handleHoldStart,
    handleHoldEnd,
    handleHoldTap,
    handleReset,
    handleStartSync,
    handleJumpToLine,
    handleJumpToWord,
    handleJumpToBgWord,
    handleNudgeWord,
    handleSetWordTime,
    handleNudgeWordEnd,
    handleSetWordEndTime,
    handleNudgeLine,
    handleSetLineTime,
    handleNudgeLastSynced,
    handleSplitWord,
    handleNudgeBgWord,
    handleSetBgWordTime,
    handleNudgeBgWordEnd,
    handleSetBgWordEndTime,
    cursor,
    isComplete,
    currentLine,
    currentWord: currentLine?.text ? splitIntoWords(currentLine.text)[wordIndex] : undefined,
  };
}

// -- Exports ------------------------------------------------------------------

export { useSyncHandlers };
