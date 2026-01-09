import { LineRow } from "@/views/timeline/line-row";
import { useProjectStore, type WordTiming } from "@/stores/project";
import { useAudioStore } from "@/stores/audio";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useCallback } from "react";

// -- Constants -----------------------------------------------------------------

const GUTTER_WIDTH = 48;

// -- Component -----------------------------------------------------------------

const TimelineRows: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
  const duration = useAudioStore((s) => s.duration);
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

  const totalWidth = duration * zoom;

  return (
    <div style={{ width: totalWidth + GUTTER_WIDTH, minWidth: "100%" }}>
      {lines.map((line, index) => (
        <LineRow
          key={line.id}
          line={line}
          lineIndex={index}
          duration={duration}
          onUpdateWord={(wordIndex, updates) => handleUpdateWord(line.id, wordIndex, updates)}
          onUpdateBgWord={(wordIndex, updates) => handleUpdateBgWord(line.id, wordIndex, updates)}
        />
      ))}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineRows };
