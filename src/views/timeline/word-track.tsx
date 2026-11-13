import { memo, useCallback, useMemo, useState } from "react";
import { timedTransliterationSlice } from "@/domain/language/transliteration-format";
import { insertWord } from "@/domain/commands/word-structure";
import { isAddressed } from "@/domain/selection/identity";
import { overlapsLoopRegion } from "@/domain/selection/loop-region";
import { addressOf } from "@/domain/selection/resolve";
import { shouldRollNeighbour } from "@/domain/word/boundary";
import { newWordId } from "@/domain/word/id";
import { computeSyllableGroups, getSyllablePositions } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { noteGuideSignal } from "@/lib/guide-signals";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { findInsertionSlot } from "@/utils/word-spaces";
import { useAltHeld } from "@/views/timeline/alt-key-held";
import { selectWordUnlessSelected } from "@/views/timeline/selection-playback";
import { toggleStepLane } from "@/views/timeline/step-timing/press-step-key";
import { useStepTrack } from "@/views/timeline/step-timing/use-step-track";
import { storedLineTimeRange } from "@/views/timeline/stored-line-range";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useTrackSelection } from "@/views/timeline/track-selection";
import { WordBlock } from "@/views/timeline/word-block";
import { wordBlockId } from "@/views/timeline/word-block-id";
import { type UpdateWord, useWordResizeDrag } from "@/views/timeline/word-resize-drag";

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
  const { hasSelection, selectedIds, leftGrip, rightGrip } = useTrackSelection(lineId, trackType);
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
    if (step.stepTiming) return toggleStepLane({ id: lineId }, trackType, words);
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
            const selections = words
              .slice(group.startIndex, group.endIndex + 1)
              .map((word) => addressOf({ id: lineId }, trackType, word));
            setSelectedWords(selections);
            return;
          }
        }
      }

      const selection = addressOf({ id: lineId }, trackType, words[wordIndex]);
      if (e.metaKey || e.ctrlKey) {
        toggleSelection(selection);
      } else {
        const { selectedWords } = useTimelineStore.getState();
        const alreadySelected = isAddressed(selectedWords, lineId, trackType, selection.syllableId);
        if (alreadySelected && selectedWords.length === 1 && !stepTiming) {
          setSelectedWords([]);
        } else {
          setSelectedWords([selection]);
        }
      }
    },
    [words, syllablePositions, lineId, trackType, setSelectedWords, toggleSelection],
  );

  const handleWordDoubleClick = useCallback(
    (_e: React.MouseEvent, wordIndex: number) => {
      useTimelineStore.getState().setEditingWord(addressOf({ id: lineId }, trackType, words[wordIndex]));
      noteGuideSignal("timeline.editTextDirect");
    },
    [words, lineId, trackType],
  );

  const handleWordContextMenu = useCallback(
    (e: React.MouseEvent, wordIndex: number) => {
      const address = addressOf({ id: lineId }, trackType, words[wordIndex]);
      selectWordUnlessSelected(address);
      useTimelineStore.getState().setContextMenu({ x: e.clientX, y: e.clientY, target: { kind: "word", ...address } });
    },
    [words, lineId, trackType],
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

    const newWord: WordTiming = { id: newWordId(), text: "...", sep: " ", begin: slot.begin, end: slot.end };
    useProjectStore.getState().commit(insertWord(lineId, trackType, newWord));

    const timeline = useTimelineStore.getState();
    timeline.clearSelection();
    timeline.setEditingWord(addressOf({ id: lineId }, trackType, newWord));
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
        const wordKey = wordBlockId(lineId, trackType, wordIndex);
        const syllablePosition = showSyllableIndicators ? syllablePositions[wordIndex] : "none";
        const inGroup = syllablePosition !== "none";
        const gapBefore = inGroup && syllablePosition !== "first" && displays[wordIndex - 1].end < display.begin;
        const gapAfter = inGroup && syllablePosition !== "last" && displays[wordIndex + 1].begin > display.end;
        const leftConjoined = wordIndex > 0 && boundaryConjoined[wordIndex - 1];
        const rightConjoined = boundaryConjoined[wordIndex];
        const isSelected = selectedIds.has(word.id);
        return (
          <WordBlock
            key={word.id}
            id={wordKey}
            lineId={lineId}
            lineIndex={lineIndex}
            wordIndex={wordIndex}
            trackType={trackType}
            text={
              textVariant === "transliteration"
                ? timedTransliterationSlice({
                    text: word.transliteration || word.text + word.sep,
                    joinerAfter: wordIndex < words.length - 1 ? word.transliterationJoinerAfter : undefined,
                  }).text
                : word.text + word.sep
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
            isStepQueued={step.queuedIds.has(word.id)}
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
            showLeftGrip={word.id === leftGrip}
            showRightGrip={word.id === rightGrip}
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
