import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { backgroundFields } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import { bgText, bgWords } from "@/domain/line/voices";
import type { WordTiming } from "@/domain/word/timing";
import { useSettingsStore } from "@/stores/settings";
import { cn } from "@/utils/cn";
import { findInsertionSlot } from "@/utils/word-spaces";
import { placeVoiceAtPlayhead } from "@/views/timeline/place-voice-at-playhead";
import { BG_DROP_ZONE_HEIGHT } from "@/views/timeline/row-geometry";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { WordTrack } from "@/views/timeline/word-track";
import { useDroppable } from "@dnd-kit/core";
import { IconPlus } from "@tabler/icons-react";
import { useCallback } from "react";

// -- Types ---------------------------------------------------------------------

interface LineBgLaneProps {
  line: LyricLine;
  lineIndex: number;
  color: string;
  duration: number;
  rowHeight: number;
  dragShiftPx: number;
  onUpdateBgWord: (
    wordIndex: number,
    updates: Partial<WordTiming>,
    adjacentIndex?: number,
    adjacentUpdates?: Partial<WordTiming>,
  ) => void;
}

// -- Constants -----------------------------------------------------------------

const BG_BAR_TEXT_LIMIT = 40;

// -- PlaceBgButton -------------------------------------------------------------

const PlaceBgButton: React.FC<{ lineId: string }> = ({ lineId }) => {
  const placeBackground = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      placeVoiceAtPlayhead(lineId, "background");
    },
    [lineId],
  );

  return (
    <button
      type="button"
      data-bg-place="true"
      onClick={placeBackground}
      className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-composer-text-muted hover:text-composer-text hover:bg-composer-button cursor-pointer transition-colors"
    >
      <IconPlus size={12} />
      Place
    </button>
  );
};

// -- Component -----------------------------------------------------------------

const LineBgLane: React.FC<LineBgLaneProps> = ({
  line,
  lineIndex,
  color,
  duration,
  rowHeight,
  dragShiftPx,
  onUpdateBgWord,
}) => {
  const bg = bgWords(line);
  const bgTextValue = bgText(line);
  const hasBgWords = bg && bg.length > 0;
  const laneShift = dragShiftPx !== 0 ? `translateX(${dragShiftPx}px)` : undefined;

  const { setNodeRef: setBgDropRef, isOver: isOverBg } = useDroppable({
    id: `bg-drop-${line.id}`,
    data: { lineId: line.id, lineIndex },
  });

  if (hasBgWords) {
    return (
      <div
        ref={setBgDropRef}
        className={cn(
          "relative opacity-70 transition-colors border-t border-composer-border/50",
          isOverBg ? "bg-composer-accent/10" : "bg-composer-bg-elevated/25",
        )}
        style={{ transform: laneShift }}
      >
        <WordTrack
          lineId={line.id}
          lineIndex={lineIndex}
          words={bg}
          color={color}
          trackType="bg"
          duration={duration}
          height={rowHeight}
          onUpdateWord={onUpdateBgWord}
        />
      </div>
    );
  }

  return (
    <div
      ref={setBgDropRef}
      className={cn(
        "flex items-center gap-1 px-2 text-xs font-mono transition-colors border-t border-composer-border/30 cursor-pointer",
        isOverBg
          ? "bg-composer-accent/20 text-composer-text"
          : "text-composer-text-muted/50 bg-composer-bg-elevated/25",
      )}
      style={{ height: BG_DROP_ZONE_HEIGHT }}
      onDoubleClick={(e) => {
        const localZoom = useTimelineStore.getState().zoom;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const time = (e.clientX - rect.left) / localZoom;
        const audioDuration = useAudioStore.getState().duration;
        const wordDuration = useSettingsStore.getState().defaultWordDuration;
        const slot = findInsertionSlot([], time, wordDuration, audioDuration);
        if (!slot) return;
        const newWord: WordTiming = { text: "...", begin: slot.begin, end: slot.end };
        useProjectStore
          .getState()
          .updateLineWithHistory(line.id, backgroundFields({ text: newWord.text, words: [newWord], source: "manual" }));
        useTimelineStore.getState().setEditingWord({ lineId: line.id, wordIndex: 0, type: "bg" });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        const localZoom = useTimelineStore.getState().zoom;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const time = (e.clientX - rect.left) / localZoom;
        useTimelineStore.getState().setContextMenu({
          x: e.clientX,
          y: e.clientY,
          target: { kind: "track", lineId: line.id, lineIndex, time, type: "bg" },
        });
      }}
    >
      <span className="truncate">
        {bgTextValue
          ? `${bgTextValue.slice(0, BG_BAR_TEXT_LIMIT)}${bgTextValue.length > BG_BAR_TEXT_LIMIT ? "..." : ""}`
          : "BG"}
      </span>
      {bgTextValue && <PlaceBgButton lineId={line.id} />}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { LineBgLane };
