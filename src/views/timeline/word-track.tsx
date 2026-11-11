import { timedTransliterationSlice } from "@/domain/language/transliteration-format";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import { isWordSelected } from "@/domain/selection/identity";
import { overlapsLoopRegion } from "@/domain/selection/loop-region";
import { shouldRollNeighbour } from "@/domain/word/boundary";
import { mergeWordsIntoTrack } from "@/domain/word/merge-track";
import { computeSyllableGroups, getSyllablePositions } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { noteGuideSignal } from "@/lib/guide-signals";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { findInsertionSlot } from "@/utils/word-spaces";
import { useAltHeld } from "@/views/timeline/alt-key-held";
import { toggleStepLane } from "@/views/timeline/step-timing/press-step-key";
import { useStepTrack } from "@/views/timeline/step-timing/use-step-track";
import { storedLineTimeRange } from "@/views/timeline/stored-line-range";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useTrackSelection } from "@/views/timeline/track-selection";
import { WordBlock } from "@/views/timeline/word-block";
import { type UpdateWord, useWordResizeDrag } from "@/views/timeline/word-resize-drag";
import { memo, useCallback, useMemo, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface WordTrackProps {
  lineId: string;
  lineIndex: number;
  words: WordTiming[];
  color: string;
  trackType: "word" | "bg";
  duration: number;
  height: number;
  onUpdateWord: UpdateWord;
}

// -- Component -----------------------------------------------------------------

const WordTrack: React.FC<WordTrackProps> = ({
  lineId,
  lineIndex,
  words,
  color,
  trackType,
  duration,
  height,
  onUpdateWord,
}) => {
  const zoom = useTimelineStore((s) => s.zoom);
  const { hasSelection, selectedIndices, leftGrip, rightGrip } = useTrackSelection(lineId, trackType);
  const step = useStepTrack(lineId, trackType);
  const setSelectedWords = useTimelineStore((s) => s.setSelectedWords);
  const toggleSelection = useTimelineStore((s) => s.toggleSelection);
  const rollingEdit = useSettingsStore((s) => s.rollingEdit);
  const textVariant = useTimelineStore((s) => s.textVariant);

  const syllablesFollowRolling = useSettingsStore((s) => s.syllablesFollowRolling);
  const showSyllableIndicators = useSettingsStore((s) => s.showSyllableIndicators);
  const syllablePositions = useMemo(() => getSyllablePositions(words), [words]);

  const [hoveredBoundary, setHoveredBoundary] = useState<number | null>(null);
  const altPressed = useAltHeld();
  const { trackRef, displays, handleResizeStart } = useWordResizeDrag({
    lineId,
    trackType,
    words,
    duration,
    syllablePositions,
    onUpdateWord,
  });

  const boundaryConjoined = useMemo(
    () =>
      words.map((_, boundaryIndex) =>
        shouldRollNeighbour({
          words,
          wordIndex: boundaryIndex,
          edge: "end",
          rollingEdit,
          syllablesFollowRolling,
          syllablePositions,
          altHeld: altPressed,
        }),
      ),
    [words, rollingEdit, syllablesFollowRolling, syllablePositions, altPressed],
  );

  const playingRegion = useTimelineStore((s) => (s.selectionPlayback !== null ? s.loopRegion : null));

  const handleEdgeHover = useCallback((edge: "left" | "right", hovering: boolean, wordIndex: number) => {
    if (!hovering) {
      setHoveredBoundary(null);
      return;
    }
    // Boundary index = the gap between words[i] and words[i+1]
    // Right edge of word N → boundary N
    // Left edge of word N → boundary N-1
    setHoveredBoundary(edge === "right" ? wordIndex : wordIndex - 1);
  }, []);

  const handleTrackClick = () => {
    if (step.stepTiming) return toggleStepLane(lineId, lineIndex, trackType, words.length);
    setSelectedWords([]);
  };

  const handleSelect = useCallback(
    (e: React.MouseEvent, wordIndex: number) => {
      const { stepTiming } = useTimelineStore.getState();
      noteGuideSignal("timeline.select");
      if (stepTiming && trackType === "bg" && !e.metaKey && !e.ctrlKey) noteGuideSignal("timeline.stepBackgroundWord");
      if (e.metaKey || e.ctrlKey) noteGuideSignal("timeline.selectMore");
      if (e.shiftKey) {
        const pos = syllablePositions[wordIndex];
        if (pos !== "none") {
          const groups = computeSyllableGroups(words);
          const group = groups.find((g) => wordIndex >= g.startIndex && wordIndex <= g.endIndex);
          if (group) {
            const selections = Array.from({ length: group.endIndex - group.startIndex + 1 }, (_, i) => ({
              lineId,
              lineIndex,
              wordIndex: group.startIndex + i,
              type: trackType,
            }));
            setSelectedWords(selections);
            return;
          }
        }
      }

      const selection = { lineId, lineIndex, wordIndex, type: trackType };
      if (e.metaKey || e.ctrlKey) {
        toggleSelection(selection);
      } else {
        const { selectedWords } = useTimelineStore.getState();
        const alreadySelected = isWordSelected(selectedWords, lineId, wordIndex, trackType);
        if (alreadySelected && selectedWords.length === 1 && !stepTiming) {
          setSelectedWords([]);
        } else {
          setSelectedWords([selection]);
        }
      }
    },
    [words, syllablePositions, lineId, lineIndex, trackType, setSelectedWords, toggleSelection],
  );

  const handleWordDoubleClick = useCallback(
    (_e: React.MouseEvent, wordIndex: number) => {
      useTimelineStore.getState().setEditingWord({ lineId, wordIndex, type: trackType });
      noteGuideSignal("timeline.editTextDirect");
    },
    [lineId, trackType],
  );

  const handleWordContextMenu = useCallback(
    (e: React.MouseEvent, wordIndex: number) => {
      useTimelineStore.getState().setContextMenu({
        x: e.clientX,
        y: e.clientY,
        target: { kind: "word", lineId, lineIndex, wordIndex, type: trackType },
      });
    },
    [lineId, lineIndex, trackType],
  );

  const handleTrackDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-word-block]")) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const time = clickX / zoom;

    const range = storedLineTimeRange(lineId, useAudioStore.getState().duration);
    const { defaultWordDuration, minWordDuration } = useSettingsStore.getState();
    const slot = findInsertionSlot(words, time, defaultWordDuration, range, minWordDuration);
    if (!slot) return;

    const newWord: WordTiming = { text: "... ", begin: slot.begin, end: slot.end };
    const newWords = mergeWordsIntoTrack(words, [newWord]);
    const newIndex = newWords.findIndex((w) => w.begin === newWord.begin);

    const updateLineWithHistory = useProjectStore.getState().updateLineWithHistory;
    if (trackType === "word") {
      updateLineWithHistory(lineId, { words: newWords });
    } else {
      updateLineWithHistory(lineId, manualBackgroundWordEdit(newWords));
    }

    const timeline = useTimelineStore.getState();
    timeline.clearSelection();
    timeline.setEditingWord({ lineId, wordIndex: newIndex, type: trackType });
  };

  const handleTrackContextMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-word-block]")) return;
    e.preventDefault();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const time = clickX / zoom;

    useTimelineStore.getState().setContextMenu({
      x: e.clientX,
      y: e.clientY,
      target: { kind: "track", lineId, lineIndex, time, type: trackType },
    });
  };

  return (
    <div
      ref={trackRef}
      role="presentation"
      {...step.trackAttributes}
      className="relative"
      style={{ height, width: duration * zoom }}
      onClick={handleTrackClick}
      onDoubleClick={handleTrackDoubleClick}
      onContextMenu={handleTrackContextMenu}
      onKeyDown={() => {}}
    >
      {words.map((word, wordIndex) => {
        const display = displays[wordIndex];
        const wordKey = `${lineId}-${trackType}-${wordIndex}`;
        const syllablePosition = showSyllableIndicators ? syllablePositions[wordIndex] : "none";
        const inGroup = syllablePosition !== "none";
        const gapBefore = inGroup && syllablePosition !== "first" && displays[wordIndex - 1].end < display.begin;
        const gapAfter = inGroup && syllablePosition !== "last" && displays[wordIndex + 1].begin > display.end;
        const leftConjoined = wordIndex > 0 && boundaryConjoined[wordIndex - 1];
        const rightConjoined = boundaryConjoined[wordIndex];
        const isSelected = selectedIndices.has(wordIndex);
        return (
          <WordBlock
            key={wordKey}
            id={wordKey}
            lineId={lineId}
            lineIndex={lineIndex}
            wordIndex={wordIndex}
            trackType={trackType}
            text={
              textVariant === "transliteration"
                ? timedTransliterationSlice({
                    text: word.transliteration || word.text,
                    joinerAfter: wordIndex < words.length - 1 ? word.transliterationJoinerAfter : undefined,
                  }).text
                : word.text
            }
            begin={display.begin}
            end={display.end}
            color={color}
            zoom={zoom}
            isDimmed={
              !step.stepTiming &&
              ((hasSelection && !isSelected) || (playingRegion !== null && !overlapsLoopRegion(display, playingRegion)))
            }
            isStepNext={wordIndex === step.nextWordIndex}
            isStepQueued={step.queuedIndices.has(wordIndex)}
            isSelected={isSelected}
            isExplicit={word.explicit === true}
            syllablePosition={syllablePosition}
            syllableEdgesJoin={!syllablesFollowRolling}
            gapBefore={gapBefore}
            gapAfter={gapAfter}
            leftHighlighted={hoveredBoundary === wordIndex - 1 && leftConjoined}
            rightHighlighted={hoveredBoundary === wordIndex && rightConjoined}
            leftConjoined={leftConjoined}
            rightConjoined={rightConjoined}
            showLeftGrip={wordIndex === leftGrip}
            showRightGrip={wordIndex === rightGrip}
            onClick={handleSelect}
            onResizeStart={handleResizeStart}
            onEdgeHover={handleEdgeHover}
            onDoubleClick={handleWordDoubleClick}
            onContextMenu={handleWordContextMenu}
          />
        );
      })}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

const MemoizedWordTrack = memo(WordTrack);
export { MemoizedWordTrack as WordTrack };
