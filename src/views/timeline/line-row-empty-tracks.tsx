import { useCallback } from "react";
import { IconPlus } from "@tabler/icons-react";
import { backgroundFields, manualBackgroundWordEdit } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { cn } from "@/utils/cn";
import { stripSplitCharacter } from "@/utils/split-character";
import { createBgWordsFromTextAt, splitIntoWordsWithMeta } from "@/utils/sync-helpers";
import { findInsertionSlot } from "@/utils/word-spaces";
import { elementXToTime } from "@/views/timeline/coords";
import { BG_DROP_ZONE_HEIGHT } from "@/views/timeline/row-geometry";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types ---------------------------------------------------------------------

type TrackType = "word" | "bg";

interface EmptyWordTrackProps {
  line: LyricLine;
  lineIndex: number;
  duration: number;
  rowHeight: number;
}

interface EmptyBgTrackProps {
  line: LyricLine;
  lineIndex: number;
  isOver: boolean;
  dropRef: (element: HTMLElement | null) => void;
}

// -- Constants -----------------------------------------------------------------

const MAIN_LABEL_MAX_CHARS = 60;
const BG_LABEL_MAX_CHARS = 40;

// -- Helpers -------------------------------------------------------------------

function pointerTime(e: React.MouseEvent): number {
  return elementXToTime(e.clientX, e.currentTarget, useTimelineStore.getState().zoom);
}

function insertionSlotAt(time: number) {
  const audioDuration = useAudioStore.getState().duration;
  const { defaultWordDuration, minWordDuration } = useSettingsStore.getState();
  return findInsertionSlot([], time, defaultWordDuration, audioDuration, minWordDuration);
}

function openTrackContextMenu(e: React.MouseEvent, lineId: string, lineIndex: number, type: TrackType): void {
  e.preventDefault();
  useTimelineStore.getState().setContextMenu({
    x: e.clientX,
    y: e.clientY,
    target: { kind: "track", lineId, lineIndex, time: pointerTime(e), type },
  });
}

function addWordAt(line: LyricLine, time: number): void {
  const slot = insertionSlotAt(time);
  if (!slot) return;
  const text = stripSplitCharacter(line.text).slice(0, MAIN_LABEL_MAX_CHARS) || "...";
  useProjectStore
    .getState()
    .updateLineWithHistory(line.id, { words: [{ text, begin: slot.begin, end: slot.end }], text });
  useTimelineStore.getState().setEditingWord({ lineId: line.id, wordIndex: 0, type: "word" });
}

function addBackgroundWordAt(line: LyricLine, time: number): void {
  const slot = insertionSlotAt(time);
  if (!slot) return;
  const { updateLineWithHistory } = useProjectStore.getState();
  const timedText = createBgWordsFromTextAt(line, slot.begin, useAudioStore.getState().duration);
  if (timedText) {
    updateLineWithHistory(line.id, manualBackgroundWordEdit(timedText));
    return;
  }
  const placeholder: WordTiming = { text: "...", begin: slot.begin, end: slot.end };
  updateLineWithHistory(line.id, backgroundFields({ text: placeholder.text, words: [placeholder], source: "manual" }));
  useTimelineStore.getState().setEditingWord({ lineId: line.id, wordIndex: 0, type: "bg" });
}

function truncateLabel(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}...` : text;
}

// -- Components ----------------------------------------------------------------

const SyncLineButton: React.FC<{ lineId: string; wordCount: number }> = ({ lineId, wordCount }) => {
  const selectLineWords = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const currentTime = useAudioStore.getState().currentTime;
      const wordDuration = useSettingsStore.getState().defaultWordDuration;
      const lineDuration = Math.max(wordCount, 1) * wordDuration;

      useProjectStore.getState().updateLineWithHistory(lineId, {
        begin: currentTime,
        end: currentTime + lineDuration,
      });
    },
    [lineId, wordCount],
  );

  return (
    <button
      type="button"
      onClick={selectLineWords}
      className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-composer-text-muted hover:text-composer-text hover:bg-composer-button cursor-pointer transition-colors not-italic"
    >
      <IconPlus size={12} />
      Place
    </button>
  );
};

const EmptyWordTrack: React.FC<EmptyWordTrackProps> = ({ line, lineIndex, duration, rowHeight }) => {
  const zoom = useTimelineStore((s) => s.zoom);
  const displayText = stripSplitCharacter(line.text);

  return (
    <div
      className="relative cursor-pointer"
      style={{ width: duration * zoom, height: rowHeight }}
      onDoubleClick={(e) => addWordAt(line, pointerTime(e))}
      onContextMenu={(e) => openTrackContextMenu(e, line.id, lineIndex, "word")}
    >
      <div
        className="sticky left-[48px] z-10 inline-flex items-center gap-2 px-3 text-xs text-composer-text-muted italic bg-composer-bg/80 backdrop-blur-sm"
        style={{ height: rowHeight, maxWidth: "calc(100% - 48px)" }}
      >
        <span className="truncate pr-0.5">{truncateLabel(displayText, MAIN_LABEL_MAX_CHARS)}</span>
        {displayText.length > 0 && (
          <SyncLineButton lineId={line.id} wordCount={splitIntoWordsWithMeta(line.text).parts.length} />
        )}
      </div>
    </div>
  );
};

const EmptyBgTrack: React.FC<EmptyBgTrackProps> = ({ line, lineIndex, isOver, dropRef }) => (
  <div
    ref={dropRef}
    data-line-index={lineIndex}
    data-track="bg"
    className={cn(
      "flex items-center px-2 text-xs font-mono truncate transition-colors border-t border-composer-border/30 cursor-pointer",
      isOver ? "bg-composer-accent/20 text-composer-text" : "text-composer-text-muted/50 bg-composer-bg-elevated/25",
    )}
    style={{ height: BG_DROP_ZONE_HEIGHT }}
    onDoubleClick={(e) => addBackgroundWordAt(line, pointerTime(e))}
    onContextMenu={(e) => openTrackContextMenu(e, line.id, lineIndex, "bg")}
  >
    {line.backgroundText ? truncateLabel(line.backgroundText, BG_LABEL_MAX_CHARS) : "BG"}
  </div>
);

// -- Exports -------------------------------------------------------------------

export { EmptyBgTrack, EmptyWordTrack };
