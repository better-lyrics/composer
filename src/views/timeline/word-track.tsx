import { isWordSelected } from "@/domain/selection/identity";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import { useAudioStore } from "@/stores/audio";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { type BoundaryEdge, clampBoundaryTime, shouldRollNeighbour } from "@/domain/word/boundary";
import { mergeWordsIntoTrack } from "@/domain/word/merge-track";
import { boundsOverlap } from "@/domain/word/overlap";
import { computeSyllableGroups, getSyllablePositions } from "@/domain/word/syllable-groups";
import { findInsertionSlot } from "@/utils/word-spaces";
import { DRAG_THRESHOLD_PX } from "@/views/timeline/drag-threshold";
import { resizeGestureSelfIds } from "@/views/timeline/resize-self-ids";
import { selfKey } from "@/views/timeline/snap";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useSelectionStretchDrag } from "@/views/timeline/use-selection-stretch";
import { useSnapBypass } from "@/views/timeline/use-snap-bypass";
import { useTimelineSnap } from "@/views/timeline/use-timeline-snap";
import { WordBlock } from "@/views/timeline/word-block";
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

interface DragState {
  wordIndex: number;
  edge: "left" | "right";
  begin: number;
  end: number;
  adjacentWordIndex?: number;
  adjacentBegin?: number;
  adjacentEnd?: number;
}

// -- Helpers -------------------------------------------------------------------

function resizeChangedTiming(initial: DragState, final: DragState, words: WordTiming[]): boolean {
  if (final.begin !== initial.begin || final.end !== initial.end) return true;
  if (final.adjacentWordIndex === undefined) return false;
  const adjacent = words[final.adjacentWordIndex];
  return final.adjacentBegin !== adjacent.begin || final.adjacentEnd !== adjacent.end;
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
  const selectedWords = useTimelineStore((s) => s.selectedWords);
  const setSelectedWords = useTimelineStore((s) => s.setSelectedWords);
  const toggleSelection = useTimelineStore((s) => s.toggleSelection);
  const rollingEditMode = useTimelineStore((s) => s.rollingEditMode);

  const showSyllableIndicators = useSettingsStore((s) => s.showSyllableIndicators);
  const syllablePositions = useMemo(() => getSyllablePositions(words), [words]);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredBoundary, setHoveredBoundary] = useState<number | null>(null);
  const [altPressed, setAltPressed] = useState(false);
  // react-doctor-disable-next-line react-doctor/rerender-state-only-in-handlers
  const [resizing, setResizing] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const justResizedRef = useRef(false);
  const draggedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const lastPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const conjoinedRef = useRef<{ active: boolean; adjacentWordIndex: number | null }>({
    active: false,
    adjacentWordIndex: null,
  });

  const snap = useTimelineSnap();
  const getLastPointer = useCallback(() => lastPointerRef.current, []);
  useSnapBypass({ active: resizing, getLastPointer });

  // Multi-block selections: dragging the selection's boundary edge becomes a
  // proportional stretch (anchored at the opposite side) instead of a resize.
  // Destructure the stable callback: the hook returns a fresh object every
  // render, and an object dep would needlessly invalidate this component's
  // memoized handlers.
  const { tryStart: tryStartStretch } = useSelectionStretchDrag({
    onDragEnd: (dragged) => {
      if (!dragged) return;
      justResizedRef.current = true;
      requestAnimationFrame(() => {
        justResizedRef.current = false;
      });
    },
  });

  // react-doctor-disable-next-line react-doctor/exhaustive-deps
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => setAltPressed(e.altKey);
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKey);
    };
  }, []);

  const handleResizeStart = useCallback(
    (wordIndex: number, edge: "left" | "right", startX: number) => {
      if (tryStartStretch({ lineId, type: trackType, wordIndex, edge, startX })) return;
      const word = words[wordIndex];
      const initialState: DragState = { wordIndex, edge, begin: word.begin, end: word.end };
      dragStateRef.current = initialState;
      setDragState(initialState);

      const rollingEdit = useTimelineStore.getState().rollingEditMode;
      const minWordDuration = useSettingsStore.getState().minWordDuration;
      const boundaryEdge: BoundaryEdge = edge === "left" ? "begin" : "end";

      setResizing(true);
      lastPointerRef.current = { clientX: startX, clientY: 0 };
      conjoinedRef.current = { active: false, adjacentWordIndex: null };
      draggedRef.current = false;
      snap.beginGesture({
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

      const handleMouseMove = (e: PointerEvent) => {
        if (Math.abs(e.clientX - startX) >= DRAG_THRESHOLD_PX) draggedRef.current = true;
        lastPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
        if (!draggedRef.current) return;
        const originalWord = words[wordIndex];
        const rawDeltaPx = e.clientX - startX;
        const conjoined = shouldRollNeighbour({
          words,
          wordIndex,
          edge: boundaryEdge,
          rollingEdit,
          syllablePositions,
          altHeld: e.altKey,
        });

        const adjacentWordIndex = conjoined ? (edge === "left" ? wordIndex - 1 : wordIndex + 1) : null;
        conjoinedRef.current = { active: adjacentWordIndex !== null, adjacentWordIndex };

        const edgeAtStart = edge === "left" ? originalWord.begin : originalWord.end;
        const snapShiftPx = snap.computeShiftPx(rawDeltaPx, [edgeAtStart]);
        const clamped = clampBoundaryTime({
          words,
          wordIndex,
          edge: boundaryEdge,
          time: edgeAtStart + (rawDeltaPx + snapShiftPx) / zoom,
          minDuration: minWordDuration,
          rollNeighbour: adjacentWordIndex !== null,
          duration,
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
      };

      const handleMouseUp = () => {
        setResizing(false);
        snap.endGesture();

        const finalState = dragStateRef.current;
        const dragged = draggedRef.current;
        dragStateRef.current = null;
        setDragState(null);

        if (dragged) {
          justResizedRef.current = true;
          requestAnimationFrame(() => {
            justResizedRef.current = false;
          });
        }

        if (dragged && finalState && resizeChangedTiming(initialState, finalState, words)) {
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
        setResizing(false);
        snap.endGesture();
        document.removeEventListener("pointermove", handleMouseMove);
        document.removeEventListener("pointerup", handleMouseUp);
      };

      document.addEventListener("pointermove", handleMouseMove);
      document.addEventListener("pointerup", handleMouseUp);
    },
    [words, zoom, duration, onUpdateWord, syllablePositions, snap, lineId, trackType, tryStartStretch],
  );

  const isBoundaryConjoined = (boundaryIndex: number): boolean =>
    shouldRollNeighbour({
      words,
      wordIndex: boundaryIndex,
      edge: "end",
      rollingEdit: rollingEditMode,
      syllablePositions,
      altHeld: altPressed,
    });

  const hasSelection = selectedWords.length > 0;

  const getDisplay = (wordIndex: number) => {
    if (dragState) {
      if (dragState.wordIndex === wordIndex) {
        return { begin: dragState.begin, end: dragState.end };
      }
      if (dragState.adjacentWordIndex === wordIndex) {
        return { begin: dragState.adjacentBegin!, end: dragState.adjacentEnd! };
      }
    }
    const word = words[wordIndex];
    return { begin: word.begin, end: word.end };
  };

  const handleEdgeHover = useCallback((wordIndex: number, edge: "left" | "right", hovering: boolean) => {
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
    setSelectedWords([]);
  };

  const handleSelect = (wordIndex: number, e: React.MouseEvent) => {
    if (justResizedRef.current) return;
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
      const alreadySelected = isWordSelected(selectedWords, lineId, wordIndex, trackType);
      if (alreadySelected && selectedWords.length === 1) {
        setSelectedWords([]);
      } else {
        setSelectedWords([selection]);
      }
    }
  };

  const handleWordDoubleClick = (wordIndex: number) => {
    useTimelineStore.getState().setEditingWord({ lineId, wordIndex, type: trackType });
  };

  const handleWordContextMenu = (wordIndex: number, e: React.MouseEvent) => {
    useTimelineStore.getState().setContextMenu({
      x: e.clientX,
      y: e.clientY,
      target: { kind: "word", lineId, lineIndex, wordIndex, type: trackType },
    });
  };

  const handleTrackDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-word-block]")) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const time = clickX / zoom;

    const audioDuration = useAudioStore.getState().duration;
    const { defaultWordDuration, minWordDuration } = useSettingsStore.getState();
    const slot = findInsertionSlot(words, time, defaultWordDuration, audioDuration, minWordDuration);
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

    useTimelineStore.getState().setEditingWord({ lineId, wordIndex: newIndex, type: trackType });
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
      role="presentation"
      className="relative"
      style={{ height, width: duration * zoom }}
      onClick={handleTrackClick}
      onDoubleClick={handleTrackDoubleClick}
      onContextMenu={handleTrackContextMenu}
      onKeyDown={() => {}}
    >
      {words.map((word, wordIndex) => {
        const display = getDisplay(wordIndex);
        const wordKey = `${lineId}-${trackType}-${wordIndex}`;
        const syllablePosition = showSyllableIndicators ? syllablePositions[wordIndex] : "none";
        const gapBefore =
          (syllablePosition === "middle" || syllablePosition === "last") &&
          getDisplay(wordIndex - 1).end < display.begin;
        return (
          <WordBlock
            key={wordKey}
            id={wordKey}
            lineId={lineId}
            lineIndex={lineIndex}
            wordIndex={wordIndex}
            trackType={trackType}
            text={word.text}
            begin={display.begin}
            end={display.end}
            color={color}
            zoom={zoom}
            isDimmed={hasSelection && !isWordSelected(selectedWords, lineId, wordIndex, trackType)}
            isSelected={isWordSelected(selectedWords, lineId, wordIndex, trackType)}
            isExplicit={word.explicit === true}
            syllablePosition={syllablePosition}
            gapBefore={gapBefore}
            leftHighlighted={hoveredBoundary === wordIndex - 1 && isBoundaryConjoined(wordIndex - 1)}
            rightHighlighted={hoveredBoundary === wordIndex && isBoundaryConjoined(wordIndex)}
            leftConjoined={isBoundaryConjoined(wordIndex - 1)}
            rightConjoined={isBoundaryConjoined(wordIndex)}
            onClick={(e) => handleSelect(wordIndex, e)}
            onResizeStart={(edge, startX) => handleResizeStart(wordIndex, edge, startX)}
            onEdgeHover={(edge, hovering) => handleEdgeHover(wordIndex, edge, hovering)}
            onDoubleClick={() => handleWordDoubleClick(wordIndex)}
            onContextMenu={(e) => handleWordContextMenu(wordIndex, e)}
          />
        );
      })}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

const MemoizedWordTrack = memo(WordTrack);
export { MemoizedWordTrack as WordTrack };
