import { useAudioStore } from "@/stores/audio";
import type { WordTiming } from "@/stores/project";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { computeSyllableGroups, getSyllablePositions } from "@/utils/syllable-groups";
import { isWordSelected, useTimelineStore } from "@/views/timeline/timeline-store";
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
  onUpdateWord: (index: number, updates: Partial<WordTiming>, adjacentIndex?: number, adjacentUpdates?: Partial<WordTiming>) => void;
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

// -- Constants -----------------------------------------------------------------

const MIN_WORD_DURATION = 0.05;

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

  const showSyllableIndicators = useSettingsStore((s) => s.showSyllableIndicators);
  const syllablePositions = useMemo(() => getSyllablePositions(words), [words]);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredBoundary, setHoveredBoundary] = useState<number | null>(null);
  const [altPressed, setAltPressed] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const justResizedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { cleanupRef.current?.(); };
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
      const word = words[wordIndex];
      const initialState: DragState = { wordIndex, edge, begin: word.begin, end: word.end };
      dragStateRef.current = initialState;
      setDragState(initialState);

      const isSyllableBoundary = (idx: number, side: "left" | "right"): boolean => {
        const pos = syllablePositions[idx];
        if (side === "right") return pos === "first" || pos === "middle";
        return pos === "middle" || pos === "last";
      };

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const deltaTime = deltaX / zoom;
        const originalWord = words[wordIndex];
        const altHeld = e.altKey;

        const isSyllable = isSyllableBoundary(wordIndex, edge);
        const conjoined = altHeld ? !isSyllable : isSyllable;

        let newState: DragState;

        if (edge === "left") {
          if (conjoined && wordIndex > 0) {
            const prevWord = words[wordIndex - 1];
            const newBoundary = originalWord.begin + deltaTime;
            const min = prevWord.begin + MIN_WORD_DURATION;
            const max = originalWord.end - MIN_WORD_DURATION;
            const clamped = Math.max(min, Math.min(max, Math.max(0, newBoundary)));
            newState = {
              wordIndex, edge, begin: clamped, end: originalWord.end,
              adjacentWordIndex: wordIndex - 1, adjacentBegin: prevWord.begin, adjacentEnd: clamped,
            };
          } else {
            const newBegin = originalWord.begin + deltaTime;
            const maxBegin = originalWord.end - MIN_WORD_DURATION;
            const prevEnd = wordIndex > 0 ? words[wordIndex - 1].end : 0;
            const clampedBegin = Math.max(prevEnd, Math.min(maxBegin, Math.max(0, newBegin)));
            newState = { wordIndex, edge, begin: clampedBegin, end: originalWord.end };
          }
        } else {
          if (conjoined && wordIndex < words.length - 1) {
            const nextWord = words[wordIndex + 1];
            const newBoundary = originalWord.end + deltaTime;
            const min = originalWord.begin + MIN_WORD_DURATION;
            const max = nextWord.end - MIN_WORD_DURATION;
            const clamped = Math.max(min, Math.min(max, Math.min(duration, newBoundary)));
            newState = {
              wordIndex, edge, begin: originalWord.begin, end: clamped,
              adjacentWordIndex: wordIndex + 1, adjacentBegin: clamped, adjacentEnd: nextWord.end,
            };
          } else {
            const newEnd = originalWord.end + deltaTime;
            const minEnd = originalWord.begin + MIN_WORD_DURATION;
            const nextBegin = wordIndex < words.length - 1 ? words[wordIndex + 1].begin : duration;
            const clampedEnd = Math.min(nextBegin, Math.max(minEnd, Math.min(duration, newEnd)));
            newState = { wordIndex, edge, begin: originalWord.begin, end: clampedEnd };
          }
        }

        dragStateRef.current = newState;
        setDragState(newState);
      };

      const handleMouseUp = () => {
        const finalState = dragStateRef.current;
        dragStateRef.current = null;
        setDragState(null);
        justResizedRef.current = true;
        requestAnimationFrame(() => { justResizedRef.current = false; });

        if (finalState) {
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
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      cleanupRef.current = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [words, zoom, duration, onUpdateWord, syllablePositions],
  );

  const isBoundaryConjoined = (boundaryIndex: number): boolean => {
    if (boundaryIndex < 0 || boundaryIndex >= words.length - 1) return false;
    const pos = syllablePositions[boundaryIndex];
    const isSyllable = pos === "first" || pos === "middle";
    return altPressed ? !isSyllable : isSyllable;
  };

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

  const handleEdgeHover = useCallback(
    (wordIndex: number, edge: "left" | "right", hovering: boolean) => {
      if (!hovering) {
        setHoveredBoundary(null);
        return;
      }
      // Boundary index = the gap between words[i] and words[i+1]
      // Right edge of word N → boundary N
      // Left edge of word N → boundary N-1
      setHoveredBoundary(edge === "right" ? wordIndex : wordIndex - 1);
    },
    [],
  );

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
    if (useTimelineStore.getState().selectOnlyMode) return;
    if ((e.target as HTMLElement).closest("[data-word-block]")) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const time = clickX / zoom;

    const audioDuration = useAudioStore.getState().duration;
    const wordDuration = useSettingsStore.getState().defaultWordDuration;
    const begin = Math.max(0, time - wordDuration / 2);
    const end = Math.min(audioDuration, time + wordDuration / 2);

    // Check for overlap with existing words
    for (const w of words) {
      if (begin < w.end && end > w.begin) return;
    }

    const newWord: WordTiming = { text: "...", begin, end };
    const newWords = [...words, newWord].sort((a, b) => a.begin - b.begin);
    const newIndex = newWords.indexOf(newWord);

    for (let i = 0; i < newWords.length; i++) {
      const isLast = i === newWords.length - 1;
      const hasSpace = newWords[i].text.endsWith(" ");
      if (!isLast && !hasSpace) {
        newWords[i] = { ...newWords[i], text: `${newWords[i].text} ` };
      } else if (isLast && hasSpace) {
        newWords[i] = { ...newWords[i], text: newWords[i].text.trimEnd() };
      }
    }

    const updateLineWithHistory = useProjectStore.getState().updateLineWithHistory;
    if (trackType === "word") {
      updateLineWithHistory(lineId, { words: newWords });
    } else {
      updateLineWithHistory(lineId, { backgroundWords: newWords });
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
      className="relative"
      style={{ height, width: duration * zoom }}
      onClick={handleTrackClick}
      onDoubleClick={handleTrackDoubleClick}
      onContextMenu={handleTrackContextMenu}
    >
      {words.map((word, wordIndex) => {
        const display = getDisplay(wordIndex);
        const wordKey = `${lineId}-${trackType}-${wordIndex}`;
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
            syllablePosition={showSyllableIndicators ? syllablePositions[wordIndex] : "none"}
            leftHighlighted={hoveredBoundary === wordIndex - 1 && isBoundaryConjoined(wordIndex - 1)}
            rightHighlighted={hoveredBoundary === wordIndex && isBoundaryConjoined(wordIndex)}
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
