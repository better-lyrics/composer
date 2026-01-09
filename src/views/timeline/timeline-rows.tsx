import { Virtuoso } from "react-virtuoso";
import { LineRow } from "@/views/timeline/line-row";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useProjectStore, type WordTiming } from "@/stores/project";
import { useAudioStore } from "@/stores/audio";
import { useCallback } from "react";

// -- Component -----------------------------------------------------------------

const TimelineRows: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
  const duration = useAudioStore((s) => s.duration);
  const scrollLeft = useTimelineStore((s) => s.scrollLeft);
  const zoom = useTimelineStore((s) => s.zoom);

  const handleUpdateWord = useCallback(
    (lineId: string, wordIndex: number, updates: Partial<WordTiming>) => {
      const line = lines.find((l) => l.id === lineId);
      if (!line?.words) return;

      const updatedWords = [...line.words];
      updatedWords[wordIndex] = { ...updatedWords[wordIndex], ...updates };
      updateLineWithHistory(lineId, { words: updatedWords });
    },
    [lines, updateLineWithHistory],
  );

  const handleUpdateBgWord = useCallback(
    (lineId: string, wordIndex: number, updates: Partial<WordTiming>) => {
      const line = lines.find((l) => l.id === lineId);
      if (!line?.backgroundWords) return;

      const updatedWords = [...line.backgroundWords];
      updatedWords[wordIndex] = { ...updatedWords[wordIndex], ...updates };
      updateLineWithHistory(lineId, { backgroundWords: updatedWords });
    },
    [lines, updateLineWithHistory],
  );

  return (
    <div className="flex-1 overflow-hidden">
      <div className="h-full" style={{ transform: `translateX(-${scrollLeft}px)`, width: duration * zoom }}>
        <Virtuoso
          totalCount={lines.length}
          itemContent={(index) => {
            const line = lines[index];
            return (
              <LineRow
                key={line.id}
                line={line}
                lineIndex={index}
                duration={duration}
                onUpdateWord={(wordIndex, updates) => handleUpdateWord(line.id, wordIndex, updates)}
                onUpdateBgWord={(wordIndex, updates) => handleUpdateBgWord(line.id, wordIndex, updates)}
              />
            );
          }}
          style={{ height: "100%" }}
        />
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineRows };
