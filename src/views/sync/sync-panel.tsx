import { isLinked } from "@/domain/instance/predicates";
import { getLanguageDisplayLine } from "@/domain/language/display";
import { effectiveBounds } from "@/domain/line/bounds";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { useSyncHandlers } from "@/hooks/useSyncHandlers";
import { useAudioStore } from "@/stores/audio";
import { isAnyModalOpen } from "@/stores/modal-stack";
import { useProjectStore } from "@/stores/project";
import { EmptyState } from "@/ui/empty-state";
import { shimmerTransition, shimmerVariants } from "@/utils/animationVariants";
import { findMatchingShortcut } from "@/utils/shortcut-matcher";
import {
  type SyncState,
  convertLineToWord,
  createBgWordsFromLine,
  getNudgeAmount,
  getSyncedLineCount,
  getSyncedWordCount,
  getTotalWords,
  hasLineTiming,
} from "@/utils/sync-helpers";
import { readToken } from "@/utils/theme/read-token";
import { ScrollableLine } from "@/views/sync/scrollable-line";
import { type RippleTarget, SyncCarousel } from "@/views/sync/sync-carousel";
import { SyncFooter, SyncGestureControls } from "@/views/sync/sync-footer";
import { SyncHeader } from "@/views/sync/sync-header";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { m } from "motion/react";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

// -- Components ---------------------------------------------------------------

const SyncPanel: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const groups = useProjectStore((s) => s.groups);
  const setLinesWithHistory = useProjectStore((s) => s.setLinesWithHistory);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const activeTab = useProjectStore((s) => s.activeTab);
  const granularity = useProjectStore((s) => s.granularity);
  const setGranularity = useProjectStore((s) => s.setGranularity);
  const source = useAudioStore((s) => s.source);
  const currentTime = useAudioStore((s) => s.currentTime);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);
  const textVariant = useTimelineStore((s) => s.textVariant);
  const toggleTextVariant = useTimelineStore((s) => s.toggleTextVariant);
  const hasTransliteration = useMemo(
    () => lines.some((line) => !!(line.transliteration?.text || line.transliteration?.backgroundText)),
    [lines],
  );
  const displayLines = useMemo(
    () => lines.map((line) => ({ ...line, ...getLanguageDisplayLine(line, textVariant) })),
    [lines, textVariant],
  );

  const instanceCountByGroup = useMemo(() => {
    const indices = new Map<string, Set<number>>();
    for (const l of lines) {
      if (isLinked(l)) {
        let set = indices.get(l.groupId);
        if (!set) {
          set = new Set();
          indices.set(l.groupId, set);
        }
        set.add(l.instanceIdx);
      }
    }
    const counts = new Map<string, number>();
    for (const [k, v] of indices) counts.set(k, v.size);
    return counts;
  }, [lines]);

  const [syncState, setSyncState] = useState<SyncState>({
    position: { lineIndex: 0, wordIndex: 0 },
    isActive: false,
  });
  const [showPulse, setShowPulse] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [rippleTarget, setRippleTarget] = useState<RippleTarget | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const heldKeyCodeRef = useRef<string | null>(null);
  const holdPointerIdRef = useRef<number | null>(null);

  const linesRef = useRef(lines);
  linesRef.current = lines;
  const syncStateRef = useRef(syncState);
  syncStateRef.current = syncState;

  const triggerRippleAtCurrentPosition = useCallback(() => {
    const { lineIndex: committedLineIndex, wordIndex: committedWordIndex } = syncStateRef.current.position;
    const lineId = linesRef.current[committedLineIndex]?.id;
    if (!lineId) return;
    setRippleTarget((prev) => ({
      lineId,
      wordIndex: committedWordIndex,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  }, []);

  const clearRippleTarget = useCallback(() => setRippleTarget(null), []);

  const {
    handleTap,
    handleHoldStart,
    handleHoldEnd: handleHoldEndRaw,
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
    isComplete,
    currentWord,
  } = useSyncHandlers({
    lines,
    syncState,
    setSyncState,
    currentTime,
    editMode,
    granularity,
    setShowPulse,
    setIsPlaying,
  });

  const handleHoldEnd = useCallback(() => {
    triggerRippleAtCurrentPosition();
    handleHoldEndRaw();
  }, [handleHoldEndRaw, triggerRippleAtCurrentPosition]);

  const updateLine = useProjectStore((s) => s.updateLine);

  useEffect(() => {
    for (const line of lines) {
      if (line.backgroundText && !line.backgroundWords?.length) {
        const bgWords = createBgWordsFromLine(line);
        if (bgWords) {
          updateLine(line.id, { backgroundWords: bgWords }, { deriveText: false });
        }
      }
    }
  }, [lines, updateLine]);

  // Smooth word progress updates (reads audioElement.currentTime directly)
  useFrameLoop(
    () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const audioEl = useAudioStore.getState().audioElement;
      const time = audioEl?.currentTime ?? useAudioStore.getState().currentTime;

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

  const totalWords = useMemo(() => getTotalWords(lines), [lines]);
  const syncedWords = useMemo(() => getSyncedWordCount(lines), [lines]);
  const syncedLines = useMemo(() => getSyncedLineCount(lines), [lines]);

  const progressText = granularity === "word" ? `${syncedWords}/${totalWords}` : `${syncedLines}/${lines.length}`;

  const handleGranularityChange = useCallback(
    (newGranularity: "line" | "word") => {
      if (newGranularity === granularity) return;

      if (newGranularity === "word" && hasLineTiming(lines)) {
        const convertedLines = lines.map((line) => convertLineToWord(line));
        setLinesWithHistory(convertedLines);
      }

      setGranularity(newGranularity);
    },
    [granularity, lines, setLinesWithHistory, setGranularity],
  );

  const handleToggleEdit = useCallback(() => {
    const entering = !editMode;
    setEditMode(entering);
    if (entering && isPlaying) setIsPlaying(false);
  }, [editMode, isPlaying, setIsPlaying]);

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

  const { lineIndex, wordIndex } = syncState.position;
  const currentLine = lines[lineIndex];
  const prevLine = lines[lineIndex - 1];

  const lastSyncedTime = useMemo(() => {
    if (granularity === "line") {
      if (prevLine?.begin !== undefined) return prevLine.begin;
      return undefined;
    }
    if (!currentLine?.words?.length) {
      if (prevLine?.words?.length) {
        return prevLine.words[prevLine.words.length - 1]?.begin;
      }
      return undefined;
    }
    return currentLine.words[currentLine.words.length - 1]?.begin;
  }, [granularity, currentLine?.words, prevLine?.words, prevLine?.begin]);

  const performTap = useCallback(() => {
    if (editMode) return;
    if (isHolding && isPlaying) {
      handleHoldTap();
    } else if (isPlaying) {
      if (!syncState.isActive) setSyncState((prev) => ({ ...prev, isActive: true }));
      handleTap();
    } else if (lines.length > 0) {
      handleStartSync();
    }
  }, [editMode, isHolding, isPlaying, syncState.isActive, lines.length, handleHoldTap, handleTap, handleStartSync]);

  const beginHold = useCallback(() => {
    if (editMode || isHolding) return;
    if (!syncState.isActive && lines.length > 0) {
      handleStartSync();
      handleHoldStart();
      setIsHolding(true);
    } else if (isPlaying) {
      handleHoldStart();
      setIsHolding(true);
    }
  }, [editMode, isHolding, isPlaying, syncState.isActive, lines.length, handleStartSync, handleHoldStart]);

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: Effect Events always read current state and must not be dependencies.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== "sync") return;
      if (isAnyModalOpen()) return;

      if (e.code === "KeyZ" && (e.metaKey || e.ctrlKey) && !e.repeat) {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (e.repeat) return;

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
          if (hasTransliteration) toggleTextVariant();
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
  }, [activeTab, undo, redo, handleNudgeLastSynced, editMode, isHolding, hasTransliteration, toggleTextVariant]);

  const showScrollableView = !isPlaying || editMode;

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
        progressText={progressText}
        textVariant={textVariant}
        hasTransliteration={hasTransliteration}
        toggleTextVariant={toggleTextVariant}
        granularity={granularity}
        handleGranularityChange={handleGranularityChange}
        editMode={editMode}
        handleToggleEdit={handleToggleEdit}
        isActive={syncState.isActive}
        handleReset={handleReset}
        handleStartSync={handleStartSync}
      />

      {/* Main sync area */}
      {showScrollableView ? (
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          <div className="py-2">
            {lines.map((line, index) => {
              const displayLine = displayLines[index];
              const timing = effectiveBounds(line);
              const linkedGroup = line.groupId ? groups.find((g) => g.id === line.groupId) : undefined;
              const totalInstances = linkedGroup ? (instanceCountByGroup.get(linkedGroup.id) ?? 0) : 0;
              const linkInfo =
                linkedGroup && line.instanceIdx !== undefined
                  ? {
                      color: linkedGroup.color,
                      label: linkedGroup.label,
                      instanceIdx: line.instanceIdx,
                      totalInstances,
                    }
                  : undefined;
              return (
                <ScrollableLine
                  key={line.id}
                  lineId={line.id}
                  lineNumber={index + 1}
                  text={line.text}
                  displayText={displayLine.text}
                  displayWordTexts={displayLine.wordTexts}
                  isCurrent={editMode ? index === playingLineIndex : index === lineIndex}
                  agentId={line.agentId}
                  backgroundText={line.backgroundText}
                  displayBackgroundText={displayLine.backgroundText}
                  displayBackgroundWordTexts={displayLine.backgroundWordTexts}
                  backgroundWords={displayLine.backgroundWords ?? line.backgroundWords}
                  words={displayLine.words ?? line.words}
                  lineBegin={timing?.begin}
                  lineEnd={timing?.end}
                  granularity={granularity}
                  currentTime={currentTime}
                  editMode={editMode}
                  linkInfo={linkInfo}
                  onClick={() => handleJumpToLine(index)}
                  onClickWord={(wordIdx) => handleJumpToWord(index, wordIdx)}
                  onClickBgWord={(wordIdx) => handleJumpToBgWord(index, wordIdx)}
                  onNudgeWord={(wordIdx, delta) => handleNudgeWord(index, wordIdx, delta)}
                  onSetWordTime={(wordIdx, newBegin) => handleSetWordTime(index, wordIdx, newBegin)}
                  onNudgeWordEnd={(wordIdx, delta) => handleNudgeWordEnd(index, wordIdx, delta)}
                  onSetWordEndTime={(wordIdx, newEnd) => handleSetWordEndTime(index, wordIdx, newEnd)}
                  onNudgeLine={(delta) => handleNudgeLine(index, delta)}
                  onSetLineTime={(newBegin) => handleSetLineTime(index, newBegin)}
                  onSplitWord={(wordIdx, newWords) => handleSplitWord(index, wordIdx, newWords)}
                  onNudgeBgWord={(wordIdx, delta) => handleNudgeBgWord(index, wordIdx, delta)}
                  onSetBgWordTime={(wordIdx, newBegin) => handleSetBgWordTime(index, wordIdx, newBegin)}
                  onNudgeBgWordEnd={(wordIdx, delta) => handleNudgeBgWordEnd(index, wordIdx, delta)}
                  onSetBgWordEndTime={(wordIdx, newEnd) => handleSetBgWordEndTime(index, wordIdx, newEnd)}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 px-8 py-12">
          {isComplete ? (
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
            <SyncCarousel
              lines={displayLines}
              lineIndex={lineIndex}
              wordIndex={wordIndex}
              granularity={granularity}
              isHolding={isHolding}
              rippleTarget={rippleTarget}
              onRippleComplete={clearRippleTarget}
            />
          )}
        </div>
      )}

      <SyncFooter
        lastSyncedTime={lastSyncedTime}
        isComplete={isComplete}
        editMode={editMode}
        isPlaying={isPlaying}
        isActive={syncState.isActive}
        gestureControls={
          showGestureCircles && (
            <SyncGestureControls
              currentWord={currentWord}
              displayWord={displayLines[lineIndex]?.wordTexts?.[wordIndex]}
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
