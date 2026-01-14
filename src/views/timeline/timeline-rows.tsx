import { useAudioStore } from "@/stores/audio";
import { useProjectStore, type WordTiming } from "@/stores/project";
import { LineRow } from "@/views/timeline/line-row";
import { DEFAULT_ROW_HEIGHT, GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { useCallback, useMemo, type RefObject } from "react";
import { Virtuoso } from "react-virtuoso";

// -- Types ---------------------------------------------------------------------

interface TimelineRowsProps {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

// -- Constants -----------------------------------------------------------------

const BG_DROP_ZONE_HEIGHT = 24;
const WAVEFORM_HEIGHT = 80;

// -- Component -----------------------------------------------------------------

const TimelineRows: React.FC<TimelineRowsProps> = ({ scrollContainerRef }) => {
  const lines = useProjectStore((s) => s.lines);
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
  const duration = useAudioStore((s) => s.duration);
  const zoom = useTimelineStore((s) => s.zoom);
  const rowHeights = useTimelineStore((s) => s.rowHeights);

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

  const getRowHeight = useCallback(
    (index: number) => {
      const line = lines[index];
      if (!line) return DEFAULT_ROW_HEIGHT + BG_DROP_ZONE_HEIGHT;
      const mainHeight = rowHeights[line.id] ?? DEFAULT_ROW_HEIGHT;
      const hasBgWords = line.backgroundWords && line.backgroundWords.length > 0;
      return mainHeight + (hasBgWords ? mainHeight : BG_DROP_ZONE_HEIGHT) + 1;
    },
    [lines, rowHeights],
  );

  const totalHeight = useMemo(() => lines.reduce((sum, _, i) => sum + getRowHeight(i), 0), [lines, getRowHeight]);

  return (
    <div style={{ width: totalWidth + GUTTER_WIDTH, minWidth: "100%", height: totalHeight }}>
      <Virtuoso
        data={lines}
        computeItemKey={(_, line) => line.id}
        itemContent={(index, line) => (
          <LineRow
            line={line}
            lineIndex={index}
            duration={duration}
            onUpdateWord={(wordIndex, updates) => handleUpdateWord(line.id, wordIndex, updates)}
            onUpdateBgWord={(wordIndex, updates) => handleUpdateBgWord(line.id, wordIndex, updates)}
          />
        )}
        style={{ height: "100%", width: "100%" }}
        customScrollParent={scrollContainerRef.current ?? undefined}
        overscan={200}
        defaultItemHeight={DEFAULT_ROW_HEIGHT + BG_DROP_ZONE_HEIGHT}
        increaseViewportBy={{ top: WAVEFORM_HEIGHT, bottom: 0 }}
      />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineRows };
