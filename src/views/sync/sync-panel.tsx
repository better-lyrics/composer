import { useSyncHandlers } from "@/hooks/useSyncHandlers";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import type { SyncMethod } from "@/stores/project";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { Button } from "@/ui/button";
import { findMatchingShortcut } from "@/utils/shortcut-matcher";
import {
  shimmerTransition,
  shimmerVariants,
  syncCarouselTransition,
  syncPulseVariants,
} from "@/utils/animationVariants";
import {
  getNudgeAmount,
  type SyncState,
  convertLineToWord,
  createInitialBgWords,
  getLineTiming,
  getSyncedLineCount,
  getSyncedWordCount,
  getTotalWords,
  hasLineTiming,
} from "@/utils/sync-helpers";
import { ScrollableLine } from "@/views/sync/scrollable-line";
import { SyncCarousel } from "@/views/sync/sync-carousel";
import { TimingDisplay } from "@/views/sync/timing-display";
import { IconLock, IconLockOpen, IconPlayerPlayFilled, IconRefresh } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// -- Components ---------------------------------------------------------------

const EmptyState: React.FC<{ message: string; hint: string }> = ({ message, hint }) => (
  <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
    <p className="text-lg text-composer-text-secondary">{message}</p>
    <p className="text-sm text-composer-text-muted">{hint}</p>
  </div>
);

const SyncPanel: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const setLines = useProjectStore((s) => s.setLines);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const activeTab = useProjectStore((s) => s.activeTab);
  const granularity = useProjectStore((s) => s.granularity);
  const setGranularity = useProjectStore((s) => s.setGranularity);
  const syncMethod = useProjectStore((s) => s.syncMethod);
  const setSyncMethod = useProjectStore((s) => s.setSyncMethod);
  const source = useAudioStore((s) => s.source);
  const currentTime = useAudioStore((s) => s.currentTime);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);

  const [syncState, setSyncState] = useState<SyncState>({
    position: { lineIndex: 0, wordIndex: 0 },
    isActive: false,
  });
  const [showPulse, setShowPulse] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const heldKeyCodeRef = useRef<string | null>(null);

  const {
    handleTap,
    handleHoldStart,
    handleHoldEnd,
    handleReset,
    handleStartSync,
    handleJumpToLine,
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

  const updateLine = useProjectStore((s) => s.updateLine);

  // Auto-initialize BG word timing for lines that have BG text and line timing but no BG words
  useEffect(() => {
    for (const line of lines) {
      if (line.backgroundText && !line.backgroundWords?.length) {
        const timing = getLineTiming(line);
        if (timing) {
          updateLine(line.id, {
            backgroundWords: createInitialBgWords(line.backgroundText, timing.begin),
          });
        }
      }
    }
  }, [lines, updateLine]);

  // RAF animation loop for smooth word progress updates (reads audioElement.currentTime directly)
  useEffect(() => {
    if (!editMode) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const update = () => {
      const container = scrollContainerRef.current;
      if (!container) {
        rafRef.current = requestAnimationFrame(update);
        return;
      }

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

      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [editMode]);

  const totalWords = useMemo(() => getTotalWords(lines), [lines]);
  const syncedWords = useMemo(() => getSyncedWordCount(lines), [lines]);
  const syncedLines = useMemo(() => getSyncedLineCount(lines), [lines]);

  const progressText = granularity === "word" ? `${syncedWords}/${totalWords}` : `${syncedLines}/${lines.length}`;

  const handleGranularityChange = useCallback(
    (newGranularity: "line" | "word") => {
      if (newGranularity === granularity) return;

      if (newGranularity === "word" && hasLineTiming(lines)) {
        const convertedLines = lines.map((line) => convertLineToWord(line));
        setLines(convertedLines);
      }

      setGranularity(newGranularity);
    },
    [granularity, lines, setLines, setGranularity],
  );

  const handleSyncMethodChange = useCallback(
    (method: SyncMethod) => {
      if (method === syncMethod) return;
      setIsHolding(false);
      setSyncMethod(method);
    },
    [syncMethod, setSyncMethod],
  );

  const playingLineIndex = useMemo(() => {
    for (let i = 0; i < lines.length; i++) {
      const timing = getLineTiming(lines[i]);
      if (timing && currentTime >= timing.begin && currentTime < timing.end) {
        return i;
      }
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const timing = getLineTiming(lines[i]);
      if (timing && currentTime >= timing.end) {
        return i;
      }
    }
    for (let i = 0; i < lines.length; i++) {
      const timing = getLineTiming(lines[i]);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== "sync") return;

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
          if (editMode || syncMethod === "hold") return;
          if (!syncState.isActive && lines.length > 0) {
            handleStartSync();
          } else if (isPlaying) {
            handleTap();
          }
          break;
        case "sync.holdSync":
          e.preventDefault();
          if (editMode || syncMethod === "tap") return;
          heldKeyCodeRef.current = e.code;
          if (!syncState.isActive && lines.length > 0) {
            handleStartSync();
            handleHoldStart();
            setIsHolding(true);
          } else if (isPlaying) {
            handleHoldStart();
            setIsHolding(true);
          }
          break;
        case "sync.nudgeLeft":
          e.preventDefault();
          handleNudgeLastSynced(-getNudgeAmount());
          break;
        case "sync.nudgeRight":
          e.preventDefault();
          handleNudgeLastSynced(getNudgeAmount());
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (activeTab !== "sync" || syncMethod !== "hold" || !isHolding) return;

      if (e.code === heldKeyCodeRef.current) {
        e.preventDefault();
        heldKeyCodeRef.current = null;
        handleHoldEnd();
        setIsHolding(false);
      }
    };

    const handleBlur = () => {
      if (isHolding) {
        heldKeyCodeRef.current = null;
        handleHoldEnd();
        setIsHolding(false);
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
  }, [
    activeTab,
    syncState.isActive,
    lines.length,
    handleStartSync,
    handleTap,
    handleHoldStart,
    handleHoldEnd,
    isPlaying,
    undo,
    redo,
    handleNudgeLastSynced,
    editMode,
    syncMethod,
    isHolding,
  ]);

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

  return (
    <div data-tour="sync-panel" className="flex flex-col flex-1 overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-composer-border">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-medium">Sync</h2>
          <span className="font-mono text-sm text-composer-text-muted tabular-nums">{progressText}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 rounded-lg bg-composer-bg-elevated p-0.5">
            <button
              type="button"
              onClick={() => handleGranularityChange("line")}
              className={`px-3 text-sm rounded-md transition-colors cursor-pointer ${
                granularity === "line"
                  ? "bg-composer-button text-composer-text"
                  : "text-composer-text-muted hover:text-composer-text"
              }`}
            >
              Line
            </button>
            <button
              type="button"
              onClick={() => handleGranularityChange("word")}
              className={`px-3 text-sm rounded-md transition-colors cursor-pointer ${
                granularity === "word"
                  ? "bg-composer-button text-composer-text"
                  : "text-composer-text-muted hover:text-composer-text"
              }`}
            >
              Word
            </button>
          </div>
          <div className="flex h-8 rounded-lg bg-composer-bg-elevated p-0.5">
            <button
              type="button"
              onClick={() => handleSyncMethodChange("tap")}
              className={`px-3 text-sm rounded-md transition-colors cursor-pointer ${
                syncMethod === "tap"
                  ? "bg-composer-button text-composer-text"
                  : "text-composer-text-muted hover:text-composer-text"
              }`}
            >
              Tap
            </button>
            <button
              type="button"
              onClick={() => handleSyncMethodChange("hold")}
              className={`px-3 text-sm rounded-md transition-colors cursor-pointer ${
                syncMethod === "hold"
                  ? "bg-composer-button text-composer-text"
                  : "text-composer-text-muted hover:text-composer-text"
              }`}
            >
              Hold
            </button>
          </div>
          <Button
            hasIcon
            variant={editMode ? "primary" : "secondary"}
            onClick={() => setEditMode(!editMode)}
            title={editMode ? "Unlock sync mode" : "Lock to edit mode"}
          >
            {editMode ? <IconLock className="w-4 h-4" /> : <IconLockOpen className="w-4 h-4" />}
            Edit
          </Button>
          {syncState.isActive && !editMode && (
            <Button hasIcon onClick={handleReset}>
              <IconRefresh className="w-4 h-4" />
              Reset
            </Button>
          )}
          {!syncState.isActive && !editMode && (
            <Button hasIcon variant="primary" onClick={handleStartSync}>
              <IconPlayerPlayFilled className="w-4 h-4" />
              Start
            </Button>
          )}
        </div>
      </div>

      {/* Main sync area */}
      {showScrollableView ? (
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          <div className="py-2">
            {lines.map((line, index) => {
              const timing = getLineTiming(line);
              return (
                <ScrollableLine
                  key={line.id}
                  text={line.text}
                  lineNumber={index + 1}
                  isCurrent={editMode ? index === playingLineIndex : index === lineIndex}
                  agentId={line.agentId}
                  backgroundText={line.backgroundText}
                  backgroundWords={line.backgroundWords}
                  words={line.words}
                  lineBegin={timing?.begin}
                  lineEnd={timing?.end}
                  granularity={granularity}
                  currentTime={currentTime}
                  editMode={editMode}
                  onClick={() => handleJumpToLine(index)}
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
              <motion.div
                className="mb-2 text-2xl font-medium"
                variants={shimmerVariants}
                initial="initial"
                animate="animate"
                transition={shimmerTransition}
                style={{
                  background:
                    "linear-gradient(45deg, rgb(165, 180, 252) 0%, rgb(165, 180, 252) 40%, rgb(237, 240, 255) 50%, rgb(165, 180, 252) 60%, rgb(165, 180, 252) 100%)",
                  backgroundSize: "200% 100%",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  color: "transparent",
                }}
              >
                Sync complete!
              </motion.div>
              <div className="text-composer-text-muted">Proceed to Preview to review your work</div>
            </div>
          ) : (
            <SyncCarousel
              lines={lines}
              lineIndex={lineIndex}
              wordIndex={wordIndex}
              granularity={granularity}
              syncMethod={syncMethod}
              isHolding={isHolding}
            />
          )}
        </div>
      )}

      {/* Bottom panel */}
      <div className="px-6 py-4 border-t border-composer-border bg-composer-bg-dark">
        <div className="flex items-center justify-between h-14">
          <TimingDisplay lastSyncedTime={lastSyncedTime} />

          {!isComplete && isPlaying && (
            <div className="flex items-center gap-4">
              {currentWord && <span className="text-xl font-medium text-composer-text">{currentWord}</span>}
              <motion.div
                variants={syncPulseVariants}
                initial={false}
                animate={showPulse || (syncMethod === "hold" && isHolding) ? "pulse" : "idle"}
                transition={syncCarouselTransition}
                className={`flex items-center justify-center border-2 rounded-full w-14 h-14 ${
                  syncMethod === "hold" && isHolding
                    ? "bg-composer-accent/20 border-composer-accent"
                    : "bg-composer-bg-elevated"
                }`}
              >
                <span className="text-xs font-medium text-composer-text-muted">
                  {getEffectiveKeysArray(syncMethod === "hold" ? "sync.holdSync" : "sync.tap")
                    .map((k) => k.toUpperCase())
                    .join(" ")}
                </span>
              </motion.div>
            </div>
          )}

          {!isComplete && !isPlaying && syncState.isActive && (
            <div className="text-sm text-composer-text-muted">Paused ・ Click a line to jump, or play to continue</div>
          )}
        </div>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { SyncPanel };
