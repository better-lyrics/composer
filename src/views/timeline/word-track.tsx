import { WordBlock } from "@/views/timeline/word-block";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { WordTiming } from "@/stores/project";
import { useCallback } from "react";

// -- Types ---------------------------------------------------------------------

interface WordTrackProps {
  lineId: string;
  lineIndex: number;
  words: WordTiming[];
  color: string;
  trackType: "word" | "bg";
  duration: number;
  onUpdateWord: (index: number, updates: Partial<WordTiming>) => void;
}

// -- Constants -----------------------------------------------------------------

const TRACK_HEIGHT = 28;

// -- Component -----------------------------------------------------------------

const WordTrack: React.FC<WordTrackProps> = ({
  lineId,
  lineIndex,
  words,
  color,
  trackType,
  duration,
  onUpdateWord,
}) => {
  const zoom = useTimelineStore((s) => s.zoom);
  const selectedWord = useTimelineStore((s) => s.selectedWord);
  const setSelectedWord = useTimelineStore((s) => s.setSelectedWord);
  const rippleEnabled = useTimelineStore((s) => s.rippleEnabled);

  const handleResizeStart = useCallback(
    (index: number, edge: "left" | "right", startX: number) => {
      const word = words[index];

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const deltaTime = deltaX / zoom;
        const newTime = Math.max(0, Math.min(duration, (edge === "left" ? word.begin : word.end) + deltaTime));

        if (edge === "left") {
          const maxBegin = word.end - 0.05;
          const prevEnd = index > 0 ? words[index - 1].end : 0;
          const clampedBegin = Math.max(prevEnd, Math.min(maxBegin, newTime));
          onUpdateWord(index, { begin: clampedBegin });

          if (rippleEnabled && index > 0) {
            onUpdateWord(index - 1, { end: clampedBegin });
          }
        } else {
          const minEnd = word.begin + 0.05;
          const nextBegin = index < words.length - 1 ? words[index + 1].begin : duration;
          const clampedEnd = Math.min(nextBegin, Math.max(minEnd, newTime));
          onUpdateWord(index, { end: clampedEnd });

          if (rippleEnabled && index < words.length - 1) {
            onUpdateWord(index + 1, { begin: clampedEnd });
          }
        }
      };

      const handleMouseUp = () => {
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

  return (
    <div className="relative" style={{ height: TRACK_HEIGHT, width: duration * zoom }}>
      {words.map((word, index) => (
        <WordBlock
          key={`${lineId}-${trackType}-${word.begin}-${word.text}`}
          text={word.text}
          begin={word.begin}
          end={word.end}
          color={color}
          zoom={zoom}
          isSelected={isWordSelected(index)}
          isDimmed={hasSelection && !isWordSelected(index)}
          onClick={() =>
            setSelectedWord({
              lineId,
              lineIndex,
              wordIndex: index,
              type: trackType,
            })
          }
          onResizeStart={(edge, startX) => handleResizeStart(index, edge, startX)}
        />
      ))}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { WordTrack, TRACK_HEIGHT };
