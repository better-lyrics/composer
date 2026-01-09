import { WordBlock } from "@/views/timeline/word-block";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { WordTiming } from "@/stores/project";
import { useCallback, useState } from "react";

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
  index: number;
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
  const rippleEnabled = useTimelineStore((s) => s.rippleEnabled);

  // Local state during drag to avoid flickering
  const [dragState, setDragState] = useState<DragState | null>(null);

  const handleResizeStart = useCallback(
    (index: number, edge: "left" | "right", startX: number) => {
      const word = words[index];

      // Initialize drag state
      setDragState({ index, edge, begin: word.begin, end: word.end });

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const deltaTime = deltaX / zoom;

        setDragState((prev) => {
          if (!prev) return null;

          const originalWord = words[index];

          if (edge === "left") {
            const newBegin = originalWord.begin + deltaTime;
            const maxBegin = originalWord.end - 0.05;
            const prevEnd = index > 0 ? words[index - 1].end : 0;
            const clampedBegin = Math.max(prevEnd, Math.min(maxBegin, Math.max(0, newBegin)));
            return { ...prev, begin: clampedBegin };
          }

          const newEnd = originalWord.end + deltaTime;
          const minEnd = originalWord.begin + 0.05;
          const nextBegin = index < words.length - 1 ? words[index + 1].begin : duration;
          const clampedEnd = Math.min(nextBegin, Math.max(minEnd, Math.min(duration, newEnd)));
          return { ...prev, end: clampedEnd };
        });
      };

      const handleMouseUp = () => {
        // Commit the change to the store
        setDragState((prev) => {
          if (prev) {
            if (edge === "left") {
              onUpdateWord(index, { begin: prev.begin });
              if (rippleEnabled && index > 0) {
                onUpdateWord(index - 1, { end: prev.begin });
              }
            } else {
              onUpdateWord(index, { end: prev.end });
              if (rippleEnabled && index < words.length - 1) {
                onUpdateWord(index + 1, { begin: prev.end });
              }
            }
          }
          return null;
        });

        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [words, zoom, duration, onUpdateWord, rippleEnabled],
  );

  const isWordSelected = (index: number) =>
    selectedWord?.lineId === lineId && selectedWord?.wordIndex === index && selectedWord?.type === trackType;

  const hasSelection = selectedWord !== null;

  // Get display values (use drag state if dragging this word)
  const getWordDisplay = (word: WordTiming, index: number) => {
    if (dragState && dragState.index === index) {
      return { begin: dragState.begin, end: dragState.end };
    }
    return { begin: word.begin, end: word.end };
  };

  const handleTrackClick = () => {
    setSelectedWord(null);
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: click to deselect
    <div className="relative" style={{ height, width: duration * zoom }} onClick={handleTrackClick}>
      {words.map((word, index) => {
        const display = getWordDisplay(word, index);
        const wordKey = `${lineId}-${trackType}-${word.begin.toFixed(3)}`;
        return (
          <WordBlock
            key={wordKey}
            id={wordKey}
            lineId={lineId}
            lineIndex={lineIndex}
            wordIndex={index}
            trackType={trackType}
            text={word.text}
            begin={display.begin}
            end={display.end}
            color={color}
            zoom={zoom}
            isDimmed={hasSelection && !isWordSelected(index)}
            onClick={() => {
              if (isWordSelected(index)) {
                setSelectedWord(null);
              } else {
                setSelectedWord({
                  lineId,
                  lineIndex,
                  wordIndex: index,
                  type: trackType,
                });
              }
            }}
            onResizeStart={(edge, startX) => handleResizeStart(index, edge, startX)}
          />
        );
      })}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { WordTrack };
