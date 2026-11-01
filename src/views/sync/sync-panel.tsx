import { getLanguageDisplayLine } from "@/domain/language/display";
import { hasTransliteration } from "@/domain/language/has-transliteration";
import { effectiveBounds } from "@/domain/line/bounds";
import { isSyncComplete, syncProgress } from "@/domain/line/sync-progress";
import { previousSlot, slotBounds } from "@/domain/sync/cursor";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { useSyncHandlers } from "@/hooks/useSyncHandlers";
import { cancelCountIn, isCountingIn } from "@/lib/sync-count-in";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { isAnyModalOpen } from "@/stores/escape-layer-stack";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { setSyncEditMode, useSyncEditModeStore } from "@/stores/sync-edit-mode";
import { EmptyState } from "@/ui/empty-state";
import { shimmerTransition, shimmerVariants } from "@/utils/animationVariants";
import { runHistoryShortcut } from "@/utils/history-shortcut";
import { findMatchingShortcut } from "@/utils/shortcut-matcher";
import { type SyncState, getNudgeAmount } from "@/utils/sync-helpers";
import { readToken } from "@/utils/theme/read-token";
import { isTypingTarget } from "@/utils/typing-target";
import type { LaneClickTarget } from "@/views/sync/lane-click-target";
import { buildLaneRows } from "@/views/sync/lane-rows";
import { showFirstPauseToastOnce } from "@/views/sync/first-pause-toast";
import { SyncEditList } from "@/views/sync/sync-edit-list";
import { SyncFooter, SyncGestureControls } from "@/views/sync/sync-footer";
import { SyncHeader } from "@/views/sync/sync-header";
import { type RippleTarget, SyncLane } from "@/views/sync/sync-lane";
import { usePlacementPreroll } from "@/views/sync/use-placement-preroll";
import { useSharedSyncView } from "@/views/sync/use-shared-sync-view";
import { useSyncCountIn } from "@/views/sync/use-sync-count-in";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { m } from "motion/react";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

// -- Components ---------------------------------------------------------------

const SyncPanel: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const groups = useProjectStore((s) => s.groups);
  const agents = useProjectStore((s) => s.agents);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const activeTab = useProjectStore((s) => s.activeTab);
  const granularity = useProjectStore((s) => s.granularity);
  const setGranularity = useProjectStore((s) => s.setGranularity);
  const source = useAudioStore((s) => s.source);
  const currentTime = useAudioStore((s) => s.currentTime);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const placementPreroll = usePlacementPreroll();
  const clearPlacementPreroll = placementPreroll.clear;
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);
  const audioElement = useAudioStore((s) => s.audioElement);
  const seekTo = useAudioStore((s) => s.seekTo);
  const textVariant = useTimelineStore((s) => s.textVariant);
  const toggleTextVariant = useTimelineStore((s) => s.toggleTextVariant);
  const linesHaveTransliteration = useMemo(() => hasTransliteration(lines), [lines]);
  const displayLines = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        ...getLanguageDisplayLine(line, textVariant),
      })),
    [lines, textVariant],
  );

  const [syncState, setSyncState] = useState<SyncState>({
    position: { lineIndex: 0, wordIndex: 0 },
    isActive: false,
  });
  const [showPulse, setShowPulse] = useState(false);
  const editMode = useSyncEditModeStore((s) => s.editMode);
  const [isHolding, setIsHolding] = useState(false);
  const [rippleTarget, setRippleTarget] = useState<RippleTarget | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const heldKeyCodeRef = useRef<string | null>(null);
  const holdPointerIdRef = useRef<number | null>(null);

  const syncHandlers = useSyncHandlers({
    lines,
    syncState,
    setSyncState,
    editMode,
    granularity,
    setShowPulse,
    setIsPlaying,
    onPlacementSkip: placementPreroll.show,
  });
  const {
    handleTap,
    handleHoldStart,
    handleHoldEnd: handleHoldEndRaw,
    handleHoldTap,
    handleReset,
    handleStartSync,
    handleJumpToLine,
    handleJumpToWord,
    handleNudgeLastSynced,
    cursor,
    isComplete,
    currentWord,
    skippedInstances,
  } = syncHandlers;
  const countIn = useSyncCountIn();

  const { skippedLineIds, skippedByLastLineId, groupTags, folded, placingName } = useSharedSyncView(
    lines,
    groups,
    cursor,
    skippedInstances,
  );
  const laneRows = useMemo(
    () => buildLaneRows({ lines, displayLines, agents, groupTags, folded }),
    [lines, displayLines, agents, groupTags, folded],
  );

  const stopSessionAtSongEnd = useEffectEvent(() => {
    setSyncState((prev) => ({ ...prev, isActive: false }));
    const slot = previousSlot(lines, cursor, granularity);
    const bounds = slot ? slotBounds(lines, slot) : null;
    if (bounds) seekTo(Math.max(0, bounds.begin - useSettingsStore.getState().redoPreroll));
  });

  const noticePause = useEffectEvent(() => {
    if (activeTab === "sync" && syncState.isActive && !editMode) showFirstPauseToastOnce();
  });

  useEffect(() => {
    if (!audioElement) return;
    const handleEnded = () => stopSessionAtSongEnd();
    const handlePause = () => noticePause();
    audioElement.addEventListener("ended", handleEnded);
    audioElement.addEventListener("pause", handlePause);
    return () => {
      audioElement.removeEventListener("ended", handleEnded);
      audioElement.removeEventListener("pause", handlePause);
    };
  }, [audioElement]);

  const triggerRippleAtCurrentPosition = useCallback(() => {
    const { lineIndex: committedLineIndex, wordIndex: committedWordIndex } = cursor;
    const lineId = lines[committedLineIndex]?.id;
    if (!lineId) return;
    setRippleTarget((prev) => ({
      lineId,
      wordIndex: committedWordIndex,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  }, [cursor, lines]);

  const clearRippleTarget = useCallback(() => setRippleTarget(null), []);

  const handleHoldEnd = useCallback(() => {
    triggerRippleAtCurrentPosition();
    handleHoldEndRaw();
  }, [handleHoldEndRaw, triggerRippleAtCurrentPosition]);

  useFrameLoop(
    () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const time = livePlaybackTime();

      const wordEls = container.querySelectorAll<HTMLElement>("[data-word-begin]");
      for (const el of wordEls) {
        const begin = Number.parseFloat(el.dataset.wordBegin ?? "0");
        const end = Number.parseFloat(el.dataset.wordEnd ?? "0");
        const duration = end - begin;

        const isOpen = end === begin;
        const isActive = time >= begin && (isOpen || time < end);
        const isComplete = end > begin && time >= end;

        let progress = 0;
        if (isActive && duration > 0) {
          progress = (time - begin) / duration;
        } else if (isComplete) {
          progress = 1;
        }

        el.style.width = `${progress * 100}%`;
      }
    },
    "sync-panel",
    editMode,
  );

  const progress = useMemo(() => syncProgress(lines, granularity), [lines, granularity]);
  const syncComplete = useMemo(() => isSyncComplete(lines), [lines]);

  const handleGranularityChange = useCallback(
    (newGranularity: "line" | "word") => {
      if (newGranularity === granularity) return;
      setGranularity(newGranularity);
    },
    [granularity, setGranularity],
  );

  const handleToggleEdit = useCallback(() => {
    const entering = !editMode;
    if (entering) cancelCountIn();
    setSyncEditMode(entering);
    if (entering && isPlaying) setIsPlaying(false);
  }, [editMode, isPlaying, setIsPlaying]);
  const toggleEditFromKeyboard = useEffectEvent(handleToggleEdit);

  const handleLaneJump = useCallback(
    (targetLineIndex: number, target: NonNullable<LaneClickTarget>) =>
      target.kind === "word" ? handleJumpToWord(targetLineIndex, target.wordIndex) : handleJumpToLine(targetLineIndex),
    [handleJumpToWord, handleJumpToLine],
  );

  const playingLineIndex = useMemo(() => {
    for (let i = 0; i < lines.length; i++) {
      const timing = effectiveBounds(lines[i]);
      if (timing && currentTime >= timing.begin && currentTime < timing.end) {
        return i;
      }
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const timing = effectiveBounds(lines[i]);
      if (timing && currentTime >= timing.end) {
        return i;
      }
    }
    for (let i = 0; i < lines.length; i++) {
      const timing = effectiveBounds(lines[i]);
      if (timing && currentTime < timing.begin) {
        return i;
      }
    }
    return -1;
  }, [lines, currentTime]);

  const { lineIndex, wordIndex } = cursor;

  const lastSyncedTime = useMemo(() => {
    const slot = previousSlot(lines, cursor, granularity);
    return slot ? slotBounds(lines, slot)?.begin : undefined;
  }, [lines, cursor, granularity]);

  const performTap = useCallback(() => {
    if (editMode || isCountingIn()) return;
    clearPlacementPreroll();
    if (isHolding && isPlaying) {
      handleHoldTap();
    } else if (isPlaying) {
      if (!syncState.isActive) setSyncState((prev) => ({ ...prev, isActive: true }));
      handleTap();
    } else if (lines.length > 0) {
      handleStartSync();
    }
  }, [
    editMode,
    isHolding,
    isPlaying,
    syncState.isActive,
    lines.length,
    handleHoldTap,
    handleTap,
    handleStartSync,
    clearPlacementPreroll,
  ]);

  const beginHold = useCallback(() => {
    if (editMode || isHolding || isCountingIn()) return;
    clearPlacementPreroll();
    if (!syncState.isActive && lines.length > 0) {
      if (handleStartSync() === "counting") return;
      handleHoldStart();
      setIsHolding(true);
    } else if (isPlaying) {
      handleHoldStart();
      setIsHolding(true);
    }
  }, [
    editMode,
    isHolding,
    isPlaying,
    syncState.isActive,
    lines.length,
    handleStartSync,
    handleHoldStart,
    clearPlacementPreroll,
  ]);

  const endHold = useCallback(() => {
    if (!isHolding) return;
    handleHoldEnd();
    setIsHolding(false);
  }, [isHolding, handleHoldEnd]);

  const performKeyboardTap = useEffectEvent(performTap);
  const beginKeyboardHold = useEffectEvent(beginHold);
  const endKeyboardHold = useEffectEvent(endHold);

  const handleTapPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      performTap();
    },
    [performTap],
  );

  // Only the pointer that opened the hold may close it, otherwise a second
  // finger brushing the circle would end the first finger's word early.
  const handleHoldPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (isHolding) return;
      beginHold();
      holdPointerIdRef.current = e.pointerId;
    },
    [isHolding, beginHold],
  );

  const handleHoldPointerRelease = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.pointerId !== holdPointerIdRef.current) return;
      holdPointerIdRef.current = null;
      endHold();
    },
    [endHold],
  );

  const lanePaused = !isPlaying && !countIn.countingIn;
  const showGestureCircles = !isComplete && !editMode && isPlaying;

  // The release handlers live on the hold circle, so a hold outliving that
  // element (song ends, media-session pause, sync completes) would never close
  // its word and would leave isHolding stuck true.
  useEffect(() => {
    if (!showGestureCircles && isHolding) {
      holdPointerIdRef.current = null;
      endHold();
    }
  }, [showGestureCircles, isHolding, endHold]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== "sync") return;
      if (isAnyModalOpen()) return;

      if (runHistoryShortcut(e, (action) => (action === "undo" ? undo() : redo()), { scope: "sync" })) return;

      const matched = findMatchingShortcut(e, "sync");
      if (!matched) return;

      switch (matched) {
        case "sync.tap":
          e.preventDefault();
          performKeyboardTap();
          break;
        case "sync.holdSync":
          e.preventDefault();
          if (editMode || isHolding) return;
          heldKeyCodeRef.current = e.code;
          beginKeyboardHold();
          break;
        case "sync.nudgeLeft":
          e.preventDefault();
          handleNudgeLastSynced(-getNudgeAmount());
          break;
        case "sync.nudgeRight":
          e.preventDefault();
          handleNudgeLastSynced(getNudgeAmount());
          break;
        case "sync.toggleTextVariant":
          e.preventDefault();
          toggleTextVariant();
          break;
        case "sync.toggleEdit":
          if (isTypingTarget(e.target)) return;
          e.preventDefault();
          toggleEditFromKeyboard();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (activeTab !== "sync" || !isHolding) return;
      if (isAnyModalOpen()) return;

      if (e.code === heldKeyCodeRef.current) {
        e.preventDefault();
        heldKeyCodeRef.current = null;
        endKeyboardHold();
      }
    };

    const handleBlur = () => {
      if (isHolding) {
        heldKeyCodeRef.current = null;
        endKeyboardHold();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [activeTab, undo, redo, handleNudgeLastSynced, editMode, isHolding, toggleTextVariant]);

  if (!source) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No audio loaded" hint="Import audio in the Import tab first" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No lyrics to sync" hint="Add lyrics in the Edit tab first" />
      </div>
    );
  }

  const shimmerBase = readToken("accent-text");
  const shimmerHighlight = readToken("text");
  const completeGradient = `linear-gradient(45deg, ${shimmerBase} 0%, ${shimmerBase} 40%, ${shimmerHighlight} 50%, ${shimmerBase} 60%, ${shimmerBase} 100%)`;

  return (
    <div data-tour="sync-panel" className="flex flex-col flex-1 overflow-hidden select-none">
      <SyncHeader
        progress={progress}
        textVariant={textVariant}
        hasTransliteration={linesHaveTransliteration}
        toggleTextVariant={toggleTextVariant}
        granularity={granularity}
        handleGranularityChange={handleGranularityChange}
        editMode={editMode}
        handleToggleEdit={handleToggleEdit}
        isActive={syncState.isActive}
        handleReset={handleReset}
        handleStartSync={handleStartSync}
      />

      {editMode ? (
        <SyncEditList
          lines={lines}
          displayLines={displayLines}
          groups={groups}
          granularity={granularity}
          currentTime={currentTime}
          playingLineIndex={playingLineIndex}
          isComplete={isComplete}
          skippedLineIds={skippedLineIds}
          skippedByLastLineId={skippedByLastLineId}
          handlers={syncHandlers}
          scrollContainerRef={scrollContainerRef}
        />
      ) : isComplete && !lanePaused ? (
        <div className="flex flex-col items-center justify-center flex-1 px-12 py-12">
          {syncComplete ? (
            <div className="text-center">
              {/* react-doctor-disable-next-line react-doctor/no-gradient-text */}
              <m.div
                className="mb-2 text-2xl font-medium"
                variants={shimmerVariants}
                initial="initial"
                animate="animate"
                transition={shimmerTransition}
                style={{
                  background: completeGradient,
                  backgroundSize: "200% 100%",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  color: "transparent",
                }}
              >
                Sync complete!
              </m.div>
              <div className="text-composer-text-muted">Proceed to Preview to review your work</div>
            </div>
          ) : (
            <div className="text-center">
              <div className="mb-2 text-2xl font-medium text-composer-text">End of lyrics</div>
              <div className="text-composer-text-muted">Some lines still need timing. Pause to pick one.</div>
            </div>
          )}
        </div>
      ) : (
        <SyncLane
          rows={laneRows}
          lineIndex={lineIndex}
          wordIndex={wordIndex}
          granularity={granularity}
          isHolding={isHolding}
          placingLineIndex={placingName !== null ? lineIndex : null}
          paused={lanePaused}
          ring={rippleTarget}
          onRingDone={clearRippleTarget}
          onJump={handleLaneJump}
          aboveCurrent={countIn.dots}
        />
      )}

      <SyncFooter
        lastSyncedTime={lastSyncedTime}
        isComplete={isComplete}
        editMode={editMode}
        isPlaying={isPlaying}
        isActive={syncState.isActive}
        status={
          countIn.status ??
          placementPreroll.statusFor({ isPlaying, isComplete, cursorLineIndex: lineIndex, playbackTime: currentTime })
        }
        gestureControls={
          showGestureCircles && (
            <SyncGestureControls
              currentWord={currentWord}
              displayWord={placingName ?? displayLines[lineIndex]?.wordTexts?.[wordIndex]}
              isHolding={isHolding}
              handleHoldPointerDown={handleHoldPointerDown}
              handleHoldPointerRelease={handleHoldPointerRelease}
              handleTapPointerDown={handleTapPointerDown}
              showPulse={showPulse}
            />
          )
        }
      />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { SyncPanel };
