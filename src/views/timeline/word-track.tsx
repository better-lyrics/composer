import { WordBlock } from "@/views/timeline/word-block";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { WordTiming } from "@/stores/project";
import { memo, useCallback, useEffect, useRef, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface WordTrackProps {
  lineId: string;
  lineIndex: number;
  words: WordTiming[];
  color: string;
  trackType: "word" | "bg";
  duration: number;
  height: number;
  onUpdateWord: (index: number, updates: Partial<WordTiming>) => void;
}

interface DragState {
  wordIndex: number;
  edge: "left" | "right";
  begin: number;
  end: number;
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
  const selectedWord = useTimelineStore((s) => s.selectedWord);
  const setSelectedWord = useTimelineStore((s) => s.setSelectedWord);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const handleResizeStart = useCallback(
    (wordIndex: number, edge: "left" | "right", startX: number) => {
      const word = words[wordIndex];
      setDragState({ wordIndex, edge, begin: word.begin, end: word.end });

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const deltaTime = deltaX / zoom;

        setDragState((prev) => {
          if (!prev) return null;

          const originalWord = words[wordIndex];

          if (edge === "left") {
            const newBegin = originalWord.begin + deltaTime;
            const maxBegin = originalWord.end - 0.05;
            const prevEnd = wordIndex > 0 ? words[wordIndex - 1].end : 0;
            const clampedBegin = Math.max(prevEnd, Math.min(maxBegin, Math.max(0, newBegin)));
            return { ...prev, begin: clampedBegin };
          }

          const newEnd = originalWord.end + deltaTime;
          const minEnd = originalWord.begin + 0.05;
          const nextBegin = wordIndex < words.length - 1 ? words[wordIndex + 1].begin : duration;
          const clampedEnd = Math.min(nextBegin, Math.max(minEnd, Math.min(duration, newEnd)));
          return { ...prev, end: clampedEnd };
        });
      };

      const handleMouseUp = () => {
        setDragState((prev) => {
          if (prev) {
            if (edge === "left") {
              onUpdateWord(wordIndex, { begin: prev.begin });
            } else {
              onUpdateWord(wordIndex, { end: prev.end });
            }
          }
          return null;
        });

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
    [words, zoom, duration, onUpdateWord],
  );

  const isSelected = (wordIndex: number) =>
    selectedWord?.lineId === lineId && selectedWord?.wordIndex === wordIndex && selectedWord?.type === trackType;

  const hasSelection = selectedWord !== null;

  const getDisplay = (wordIndex: number) => {
    if (dragState && dragState.wordIndex === wordIndex) {
      return { begin: dragState.begin, end: dragState.end };
    }
    const word = words[wordIndex];
    return { begin: word.begin, end: word.end };
  };

  const handleTrackClick = () => {
    setSelectedWord(null);
  };

  const handleSelect = (wordIndex: number) => {
    if (isSelected(wordIndex)) {
      setSelectedWord(null);
    } else {
      setSelectedWord({
        lineId,
        lineIndex,
        wordIndex,
        type: trackType,
      });
    }
  };

  return (
    <div className="relative" style={{ height, width: duration * zoom }} onClick={handleTrackClick}>
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
            isDimmed={hasSelection && !isSelected(wordIndex)}
            onClick={() => handleSelect(wordIndex)}
            onResizeStart={(edge, startX) => handleResizeStart(wordIndex, edge, startX)}
          />
        );
      })}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

const MemoizedWordTrack = memo(WordTrack);
export { MemoizedWordTrack as WordTrack };
