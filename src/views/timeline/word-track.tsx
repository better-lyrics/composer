import { timedTransliterationSlice } from "@/domain/language/transliteration-format";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import { isWordSelected } from "@/domain/selection/identity";
import { overlapsLoopRegion } from "@/domain/selection/loop-region";
import { type BoundaryEdge, clampBoundaryTime, shouldRollNeighbour } from "@/domain/word/boundary";
import { mergeWordsIntoTrack } from "@/domain/word/merge-track";
import { boundsOverlap } from "@/domain/word/overlap";
import { computeSyllableGroups, getSyllablePositions } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { noteGuideSignal } from "@/lib/guide-signals";
import { swallowTrailingClick } from "@/lib/swallow-trailing-click";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { findInsertionSlot } from "@/utils/word-spaces";
import { useAltHeld } from "@/views/timeline/alt-key-held";
import { DRAG_THRESHOLD_PX } from "@/views/timeline/drag-threshold";
import { settleLoupe, showLoupeEdit } from "@/views/timeline/loupe/loupe-target";
import { setLiveWordEdit } from "@/views/timeline/pitch/live-word-edit";
import { pointerTravelSeconds } from "@/views/timeline/pointer-travel";
import { resizeGestureSelfIds } from "@/views/timeline/resize-self-ids";
import { selfKey } from "@/views/timeline/snap";
import { useStepTrack } from "@/views/timeline/step-timing/use-step-track";
import { storedLineTimeRange } from "@/views/timeline/stored-line-range";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useTrackSelection } from "@/views/timeline/track-selection";
import { noteWordDragShift } from "@/views/timeline/tiny-drag-signal";
import { useGestureInputReplay } from "@/views/timeline/use-gesture-input-replay";
import { useSelectionStretchDrag } from "@/views/timeline/use-selection-stretch";
import { useTimelineSnap } from "@/views/timeline/use-timeline-snap";
import { type DragState, displayedBounds, liveWordBounds, resizeChangedTiming } from "@/views/timeline/word-resize-state";
import { WordBlock } from "@/views/timeline/word-block";
import { beginBoundaryDrag, endBoundaryDrag } from "@/views/timeline/boundary-chip-store";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface WordTrackProps {
  lineId: string;
  lineIndex: number;
  words: WordTiming[];
  color: string;
  trackType: "word" | "bg";
  duration: number;
  height: number;
  onUpdateWord: (
    index: number,
    updates: Partial<WordTiming>,
    adjacentIndex?: number,
    adjacentUpdates?: Partial<WordTiming>,
  ) => void;
}

// -- Constants -----------------------------------------------------------------

const STRETCH_DRAG_OPTIONS = {
  onDragEnd: (dragged: boolean) => {
    if (dragged) swallowTrailingClick();
  },
};

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

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredBoundary, setHoveredBoundary] = useState<number | null>(null);
  const altPressed = useAltHeld();
  // react-doctor-disable-next-line react-doctor/rerender-state-only-in-handlers
  const [resizing, setResizing] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const draggedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const lastPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const conjoinedRef = useRef<{ active: boolean; adjacentWordIndex: number | null }>({
    active: false,
    adjacentWordIndex: null,
  });

  const { beginGesture, computeShiftPx, endGesture } = useTimelineSnap();
  const getLastPointer = useCallback(() => lastPointerRef.current, []);
  useGestureInputReplay({ active: resizing, getLastPointer });

  // Multi-block selections: dragging the selection's boundary edge becomes a
  // proportional stretch (anchored at the opposite side) instead of a resize.
  // Destructure the stable callback: the hook returns a fresh object every
  // render, and an object dep would needlessly invalidate this component's
  // memoized handlers.
  const { tryStart: tryStartStretch } = useSelectionStretchDrag(STRETCH_DRAG_OPTIONS);

  // react-doctor-disable-next-line react-doctor/exhaustive-deps
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const handleResizeStart = useCallback(
    (edge: "left" | "right", startX: number, wordIndex: number) => {
      const track = trackRef.current;
      if (!track) return;
      if (tryStartStretch({ lineId, type: trackType, wordIndex, edge, startX, track })) return;
      const word = words[wordIndex];
      const initialState: DragState = { wordIndex, edge, begin: word.begin, end: word.end };
      dragStateRef.current = initialState;
      setDragState(initialState);

      const syllablesFollowRollingAtStart = useSettingsStore.getState().syllablesFollowRolling;
      const minWordDuration = useSettingsStore.getState().minWordDuration;
      const boundaryEdge: BoundaryEdge = edge === "left" ? "begin" : "end";
      const range = storedLineTimeRange(lineId, duration);

      const edgeKey = `${lineId}:${trackType}:${edge === "left" ? wordIndex - 1 : wordIndex}`;
      const teachesAltGap = shouldRollNeighbour({
        words,
        wordIndex,
        edge: boundaryEdge,
        rollingEdit: useSettingsStore.getState().rollingEdit,
        syllablesFollowRolling: syllablesFollowRollingAtStart,
        syllablePositions,
        altHeld: false,
      });
      if (teachesAltGap) beginBoundaryDrag(track, startX, edgeKey);

      setResizing(true);
      lastPointerRef.current = { clientX: startX, clientY: 0 };
      conjoinedRef.current = { active: false, adjacentWordIndex: null };
      draggedRef.current = false;
      beginGesture({
        selfIds: resizeGestureSelfIds(lineId, wordIndex, edge, words.length, trackType),
        leaderKey: selfKey(lineId, wordIndex, trackType),
        overlapCheck: (shift) => {
          const w = words[wordIndex];
          const newBegin = edge === "left" ? w.begin + shift : w.begin;
          const newEnd = edge === "right" ? w.end + shift : w.end;
          const adj = conjoinedRef.current.adjacentWordIndex;
          return !words.some((other, i) => {
            if (i === wordIndex) return false;
            if (conjoinedRef.current.active && i === adj) return false;
            return boundsOverlap({ begin: newBegin, end: newEnd }, other);
          });
        },
      });

      const travelSeconds = pointerTravelSeconds(track, startX);

      const handleMouseMove = (e: PointerEvent) => {
        const zoom = useTimelineStore.getState().zoom;
        const rawDeltaPx = travelSeconds(e.clientX) * zoom;
        if (Math.abs(rawDeltaPx) >= DRAG_THRESHOLD_PX) draggedRef.current = true;
        lastPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
        if (!draggedRef.current) return;
        const originalWord = words[wordIndex];
        const conjoined = shouldRollNeighbour({
          words,
          wordIndex,
          edge: boundaryEdge,
          rollingEdit: useSettingsStore.getState().rollingEdit,
          syllablesFollowRolling: syllablesFollowRollingAtStart,
          syllablePositions,
          altHeld: e.altKey,
        });

        const adjacentWordIndex = conjoined ? (edge === "left" ? wordIndex - 1 : wordIndex + 1) : null;
        conjoinedRef.current = { active: adjacentWordIndex !== null, adjacentWordIndex };

        const edgeAtStart = edge === "left" ? originalWord.begin : originalWord.end;
        const snapShiftPx = computeShiftPx(rawDeltaPx, [edgeAtStart]);
        const clamped = clampBoundaryTime({
          words,
          wordIndex,
          edge: boundaryEdge,
          time: edgeAtStart + (rawDeltaPx + snapShiftPx) / zoom,
          minDuration: minWordDuration,
          rollNeighbour: adjacentWordIndex !== null,
          range,
        });

        const adjacent =
          adjacentWordIndex === null
            ? null
            : {
                adjacentWordIndex,
                adjacentBegin: edge === "left" ? words[adjacentWordIndex].begin : clamped,
                adjacentEnd: edge === "left" ? clamped : words[adjacentWordIndex].end,
              };
        const newState: DragState =
          edge === "left"
            ? { wordIndex, edge, begin: clamped, end: originalWord.end, ...adjacent }
            : { wordIndex, edge, begin: originalWord.begin, end: clamped, ...adjacent };

        dragStateRef.current = newState;
        setDragState(newState);
        setLiveWordEdit({ lineId, kind: trackType, words: liveWordBounds(newState) });
        showLoupeEdit(
          { lineId, track: trackType, wordIndex, edge: boundaryEdge, startTime: edgeAtStart, time: clamped },
          false,
        );
      };

      const handleMouseUp = () => {
        setResizing(false);
        endGesture();

        const finalState = dragStateRef.current;
        const dragged = draggedRef.current;
        dragStateRef.current = null;
        setDragState(null);
        setLiveWordEdit(null);

        if (dragged) {
          swallowTrailingClick();
          settleLoupe();
        }
        const changedTiming = dragged && finalState !== null && resizeChangedTiming(initialState, finalState, words);
        if (teachesAltGap) {
          endBoundaryDrag(changedTiming ? { edgeKey, gapOpen: finalState?.adjacentWordIndex === undefined } : null);
        }

        if (changedTiming && finalState) {
          noteGuideSignal("timeline.resize");
          if (finalState.adjacentWordIndex !== undefined && useSettingsStore.getState().rollingEdit)
            noteGuideSignal("timeline.rolling");
          const edgeShift = edge === "left" ? finalState.begin - initialState.begin : finalState.end - initialState.end;
          noteWordDragShift(lineId, trackType, wordIndex, edgeShift);
          if (finalState.adjacentWordIndex !== undefined) {
            const mainUpdate = edge === "left" ? { begin: finalState.begin } : { end: finalState.end };
            const adjUpdate = edge === "left" ? { end: finalState.adjacentEnd! } : { begin: finalState.adjacentBegin! };
            onUpdateWord(wordIndex, mainUpdate, finalState.adjacentWordIndex, adjUpdate);
          } else if (edge === "left") {
            onUpdateWord(wordIndex, { begin: finalState.begin });
          } else {
            onUpdateWord(wordIndex, { end: finalState.end });
          }
        }

        cleanupRef.current = null;
        document.removeEventListener("pointermove", handleMouseMove);
        document.removeEventListener("pointerup", handleMouseUp);
      };

      cleanupRef.current = () => {
        endBoundaryDrag(null);
        setResizing(false);
        setLiveWordEdit(null);
        endGesture();
        settleLoupe();
        document.removeEventListener("pointermove", handleMouseMove);
        document.removeEventListener("pointerup", handleMouseUp);
      };

      document.addEventListener("pointermove", handleMouseMove);
      document.addEventListener("pointerup", handleMouseUp);
    },
    [
      words,
      duration,
      onUpdateWord,
      syllablePositions,
      beginGesture,
      computeShiftPx,
      endGesture,
      lineId,
      trackType,
      tryStartStretch,
    ],
  );

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

  const displays = useMemo(
    () => words.map((_, wordIndex) => displayedBounds(words, wordIndex, dragState)),
    [words, dragState],
  );

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
    if (step.stepTiming) return step.toggleLane(lineIndex, words.length);
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
            isStepNext={step.isNext(wordIndex)}
            isStepQueued={step.isQueued(wordIndex)}
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
