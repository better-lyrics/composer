import { resetSync, retimeSyncWord, shiftSyncLine, splitSyncWord, syncGesture } from "@/domain/commands/sync";
import type { WordTrack } from "@/domain/line/tracks";
import type { BoundaryEdge } from "@/domain/word/boundary";
import type { RetimeChange } from "@/utils/timing/word-timing-ops";
import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { hasAnyTiming } from "@/domain/line/predicates";
import { isSyncableLine } from "@/domain/line/sync-progress";
import { SYNC_START, syncAddressAt } from "@/domain/sync/address";
import { anchorGesture } from "@/domain/sync/anchor-gesture";
import { type PlacementSkip, placementSkipTarget } from "@/domain/sync/placement-skip";
import type { GestureCommit, SyncGesture } from "@/domain/sync/commit-gesture";
import { isCursorPastEnd, nextSyncableLineIndex, previousSlot } from "@/domain/sync/cursor";
import type { WordTiming } from "@/domain/word/timing";
import { keptSyncReRecording, syncReRecordingAt, useSyncCursor } from "@/hooks/useSyncCursor";
import { noteGuideSignal } from "@/lib/guide-signals";
import { requestPlayback } from "@/lib/sync-count-in";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { showPlacementBlockedToast } from "@/utils/group-toast";
import { type SyncState, formatTimeMs, splitIntoWords } from "@/utils/sync-helpers";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

interface UseSyncHandlersProps {
  lines: LyricLine[];
  syncState: SyncState;
  setSyncState: React.Dispatch<React.SetStateAction<SyncState>>;
  editMode: boolean;
  granularity: "line" | "word";
  setShowPulse: (show: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  onPlacementSkip?: (skip: PlacementSkip, lineIndex: number) => void;
}

// -- Constants ------------------------------------------------------------------

const EARLY_TAP_TOAST_ID = "sync-early-tap";

// -- Helpers --------------------------------------------------------------------

function toastEarlyTap(clampedTo: number | null): void {
  if (clampedTo === null) return;
  toast(`Early tap snapped to ${formatTimeMs(clampedTo)}`, { id: EARLY_TAP_TOAST_ID });
  noteGuideSignal("sync.earlyTap");
}

function triggerPulse(setShowPulse: (show: boolean) => void): void {
  setShowPulse(true);
  setTimeout(() => setShowPulse(false), 100);
}

// Each word edge handler commits one retime; they change only when the lines do.
function syncWordTimingHandlers(lines: readonly LyricLine[]) {
  const retime = (track: WordTrack, edge: BoundaryEdge) => (lineIdx: number, wordIdx: number, change: RetimeChange) => {
    const lineId = lines[lineIdx]?.id;
    if (!lineId) return;
    const duration = useAudioStore.getState().duration;
    useProjectStore.getState().commit(retimeSyncWord({ lineId, track, wordIndex: wordIdx }, edge, change, duration));
  };
  const [mainBegin, mainEnd, bgBegin, bgEnd] = [
    retime("word", "begin"),
    retime("word", "end"),
    retime("bg", "begin"),
    retime("bg", "end"),
  ];
  return {
    handleNudgeWord: (lineIdx: number, wordIdx: number, delta: number) => mainBegin(lineIdx, wordIdx, { by: delta }),
    handleSetWordTime: (lineIdx: number, wordIdx: number, time: number) => mainBegin(lineIdx, wordIdx, { to: time }),
    handleNudgeWordEnd: (lineIdx: number, wordIdx: number, delta: number) => mainEnd(lineIdx, wordIdx, { by: delta }),
    handleSetWordEndTime: (lineIdx: number, wordIdx: number, time: number) => mainEnd(lineIdx, wordIdx, { to: time }),
    handleNudgeBgWord: (lineIdx: number, wordIdx: number, delta: number) => bgBegin(lineIdx, wordIdx, { by: delta }),
    handleSetBgWordTime: (lineIdx: number, wordIdx: number, time: number) => bgBegin(lineIdx, wordIdx, { to: time }),
    handleNudgeBgWordEnd: (lineIdx: number, wordIdx: number, delta: number) => bgEnd(lineIdx, wordIdx, { by: delta }),
    handleSetBgWordEndTime: (lineIdx: number, wordIdx: number, time: number) => bgEnd(lineIdx, wordIdx, { to: time }),
  };
}

// -- Hook ---------------------------------------------------------------------

function useSyncHandlers({
  lines,
  syncState,
  setSyncState,
  editMode,
  granularity,
  setShowPulse,
  setIsPlaying,
  onPlacementSkip,
}: UseSyncHandlersProps) {
  const seekTo = useAudioStore((s) => s.seekTo);
  const confirm = useConfirm();

  const ignoreNextHoldEndRef = useRef(false);
  const { cursor, jumped, skippedInstances } = useSyncCursor(lines, syncState, granularity);
  const { lineIndex, wordIndex } = cursor;
  const currentLine = lines[lineIndex];
  const isComplete = isCursorPastEnd(lines, cursor);

  const runGesture = useCallback(
    (gesture: SyncGesture): boolean => {
      const ctx = {
        cursor,
        jumped,
        time: livePlaybackTime(),
        defaultWordDuration: useSettingsStore.getState().defaultWordDuration,
        skippedInstances,
      };
      const anchor = anchorGesture(lines, gesture, { ...ctx, groups: useProjectStore.getState().groups });
      const { placeInstance } = useProjectStore.getState();
      const duration = useAudioStore.getState().duration;
      if (
        anchor &&
        !placeInstance(anchor.groupId, anchor.instanceIdx, anchor.start, duration, anchor.precedingUpdates)
      ) {
        showPlacementBlockedToast();
        return false;
      }
      if (anchor) {
        const placed = useProjectStore.getState();
        const { redoPreroll } = useSettingsStore.getState();
        const skip = placementSkipTarget(placed.lines, anchor.groupId, anchor.instanceIdx, ctx.time, redoPreroll);
        if (skip) {
          seekTo(skip.seekTo);
          onPlacementSkip?.(skip, anchor.resumeCursor.lineIndex);
        }
        const resume = syncAddressAt(placed.lines, anchor.resumeCursor);
        const anchorUndo = {
          resume,
          anchor: syncAddressAt(lines, anchor.anchorCursor),
          jumped,
          placedEntry: placed.history[placed.historyIndex],
          previousEntry: placed.history[placed.historyIndex - 1],
        };
        // Jumped, so the next tap trims an overlap with the placed instance instead of stretching its shared last word.
        setSyncState((prev) => ({
          ...prev,
          position: resume,
          jumpedToPosition: true,
          anchorUndo,
          reRecording: keptSyncReRecording(prev.reRecording, lines, anchor.resumeCursor),
        }));
        ignoreNextHoldEndRef.current = gesture === "hold-start";
        toastEarlyTap(anchor.clampedTo);
        return true;
      }
      const planned: { commit: GestureCommit | null } = { commit: null };
      useProjectStore.getState().commit(
        syncGesture(gesture, ctx, (commit) => {
          planned.commit = commit;
        }),
      );
      const { commit } = planned;
      if (!commit) return false;
      const position = syncAddressAt(useProjectStore.getState().lines, commit.nextCursor);
      setSyncState((prev) => ({
        ...prev,
        position,
        jumpedToPosition: commit.nextJumped,
        reRecording: keptSyncReRecording(prev.reRecording, lines, commit.nextCursor),
      }));
      toastEarlyTap(commit.clampedTo);
      return true;
    },
    [lines, cursor, jumped, skippedInstances, setSyncState, seekTo, onPlacementSkip],
  );

  const handleTap = useCallback(() => {
    if (!runGesture(granularity === "word" ? "tap-word" : "tap-line")) return;
    triggerPulse(setShowPulse);
    noteGuideSignal("sync.tap");
  }, [runGesture, granularity, setShowPulse]);

  const handleHoldStart = useCallback(() => {
    ignoreNextHoldEndRef.current = false;
    if (runGesture("hold-start")) noteGuideSignal("sync.hold");
  }, [runGesture]);

  const handleHoldEnd = useCallback(() => {
    if (ignoreNextHoldEndRef.current) {
      ignoreNextHoldEndRef.current = false;
      return;
    }
    if (runGesture("hold-end")) triggerPulse(setShowPulse);
  }, [runGesture, setShowPulse]);

  const handleHoldTap = useCallback(() => {
    if (!runGesture("hold-tap")) return;
    triggerPulse(setShowPulse);
    noteGuideSignal("sync.holdTap");
  }, [runGesture, setShowPulse]);

  const handleReset = useCallback(async () => {
    ignoreNextHoldEndRef.current = false;
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

    useProjectStore.getState().commit(resetSync());
    setSyncState({ position: SYNC_START, isActive: false });
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
      position: syncAddressAt(lines, { lineIndex: startLine, wordIndex: startWord }),
      isActive: true,
      jumpedToPosition: startLine === cursorLine ? jumped : false,
    }));
    return requestPlayback();
  }, [lines, cursor, jumped, setSyncState]);

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
        position: syncAddressAt(lines, { lineIndex: index, wordIndex: 0 }),
        jumpedToPosition: true,
        reRecording: syncReRecordingAt(skippedInstances, lines, index),
      }));
      noteGuideSignal("sync.resync");
      const bounds = effectiveBounds(lines[index]);
      if (!bounds) return;
      seekForRedo(bounds.begin);
    },
    [lines, skippedInstances, seekForRedo, setSyncState],
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
        position: syncAddressAt(lines, { lineIndex: lineIdx, wordIndex: wordIdx }),
        jumpedToPosition: true,
        reRecording: syncReRecordingAt(skippedInstances, lines, lineIdx),
      }));
      noteGuideSignal("sync.resync");
      seekForRedo(word.begin);
    },
    [lines, skippedInstances, seekForRedo, setSyncState],
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

  const shiftLine = useCallback(
    (lineIdx: number, change: RetimeChange) => {
      const lineId = lines[lineIdx]?.id;
      if (!lineId) return;
      useProjectStore.getState().commit(shiftSyncLine(lineId, change, useAudioStore.getState().duration));
    },
    [lines],
  );
  const wordTiming = useMemo(() => syncWordTimingHandlers(lines), [lines]);
  const { handleNudgeWord } = wordTiming;
  const handleNudgeLine = useCallback(
    (lineIdx: number, delta: number) => shiftLine(lineIdx, { by: delta }),
    [shiftLine],
  );
  const handleSetLineTime = useCallback(
    (lineIdx: number, newBegin: number) => shiftLine(lineIdx, { to: newBegin }),
    [shiftLine],
  );

  const handleNudgeLastSynced = useCallback(
    (delta: number) => {
      const slot = previousSlot(lines, cursor, granularity);
      if (!slot) return;
      noteGuideSignal("sync.fixTap");
      if (slot.wordIndex !== null) {
        handleNudgeWord(slot.lineIndex, slot.wordIndex, delta);
        return;
      }
      shiftLine(slot.lineIndex, { by: delta });
    },
    [lines, cursor, granularity, handleNudgeWord, shiftLine],
  );

  const handleSplitWord = useCallback(
    (lineIdx: number, wordIdx: number, newWords: WordTiming[]) => {
      const lineId = lines[lineIdx]?.id;
      if (lineId) useProjectStore.getState().commit(splitSyncWord(lineId, wordIdx, newWords));
    },
    [lines],
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
    ...wordTiming,
    handleNudgeLine,
    handleSetLineTime,
    handleNudgeLastSynced,
    handleSplitWord,
    cursor,
    isComplete,
    currentLine,
    skippedInstances,
    currentWord: currentLine?.text ? splitIntoWords(currentLine.text)[wordIndex] : undefined,
  };
}

// -- Exports ------------------------------------------------------------------

export { useSyncHandlers };
