import { useAudioStore } from "@/stores/audio";
import { type LyricLine, useProjectStore } from "@/stores/project";
import { cn } from "@/utils/cn";
import type { ClipboardData } from "@/views/timeline/selection-types";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { type RefObject, useCallback, useEffect, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface PastePreviewProps {
  clipboard: ClipboardData;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

interface GhostWord {
  text: string;
  left: number;
  width: number;
  trackTop: number;
  trackHeight: number;
  overlaps: boolean;
  outOfBounds: boolean;
  isBg: boolean;
}

// -- Constants -----------------------------------------------------------------

const WAVEFORM_HEIGHT = 80;
const BG_DROP_ZONE_HEIGHT = 24;

// -- Component -----------------------------------------------------------------

const PastePreview: React.FC<PastePreviewProps> = ({ clipboard, scrollContainerRef }) => {
  const [mousePos, setMousePos] = useState<{ clientX: number; clientY: number } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ clientX: e.clientX, clientY: e.clientY });
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      const container = scrollContainerRef.current;
      if (!container) return;

      const { zoom, rowHeights, defaultRowHeight } = useTimelineStore.getState();
      const lines = useProjectStore.getState().lines;
      const duration = useAudioStore.getState().duration;

      const containerRect = container.getBoundingClientRect();
      const cursorTime = (e.clientX - containerRect.left - GUTTER_WIDTH + container.scrollLeft) / zoom;

      const cursorY = e.clientY - containerRect.top + container.scrollTop;
      const targetLineIndex = getLineIndexAtY(cursorY, lines, rowHeights, defaultRowHeight);
      if (targetLineIndex < 0) return;

      const firstEntry = clipboard.entries[0];
      const timeDelta = cursorTime - firstEntry.word.begin;

      const hasOverlap = checkOverlaps(clipboard, targetLineIndex, timeDelta, lines, duration);
      if (hasOverlap) return;

      const updates: Array<{ id: string; updates: Partial<LyricLine> }> = [];

      const grouped = new Map<number, typeof clipboard.entries>();
      for (const entry of clipboard.entries) {
        const lineIdx = targetLineIndex + entry.lineOffset;
        if (lineIdx < 0 || lineIdx >= lines.length) return;
        const arr = grouped.get(lineIdx) ?? [];
        arr.push(entry);
        grouped.set(lineIdx, arr);
      }

      for (const [lineIdx, entries] of grouped) {
        const line = lines[lineIdx];
        const newWords: Array<{ text: string; begin: number; end: number }> = [];
        const newBgWords: Array<{ text: string; begin: number; end: number }> = [];

        for (const entry of entries) {
          const newBegin = Math.max(0, entry.word.begin + timeDelta);
          const newEnd = Math.min(duration, entry.word.end + timeDelta);
          const newWord = { ...entry.word, begin: newBegin, end: newEnd };

          if (entry.trackType === "word") newWords.push(newWord);
          else newBgWords.push(newWord);
        }

        const lineUpdates: Partial<LyricLine> = {};

        if (newWords.length > 0) {
          lineUpdates.words = [...(line.words ?? []), ...newWords].sort((a, b) => a.begin - b.begin);
        }
        if (newBgWords.length > 0) {
          const merged = [...(line.backgroundWords ?? []), ...newBgWords].sort((a, b) => a.begin - b.begin);
          lineUpdates.backgroundWords = merged;
          lineUpdates.backgroundText = merged.map((w) => w.text).join("");
        }

        updates.push({ id: line.id, updates: lineUpdates });
      }

      if (updates.length > 0) {
        useProjectStore.getState().updateLinesWithHistory(updates);
        useTimelineStore.getState().setPasteMode({ status: "idle" });
        useTimelineStore.getState().clearSelection();
      }
    },
    [clipboard, scrollContainerRef],
  );

  const container = scrollContainerRef.current;
  if (!container || !mousePos) return null;

  const { zoom, rowHeights, defaultRowHeight } = useTimelineStore.getState();
  const lines = useProjectStore.getState().lines;
  const duration = useAudioStore.getState().duration;

  const containerRect = container.getBoundingClientRect();
  const cursorTime = (mousePos.clientX - containerRect.left - GUTTER_WIDTH + container.scrollLeft) / zoom;
  const cursorY = mousePos.clientY - containerRect.top + container.scrollTop;
  const targetLineIndex = getLineIndexAtY(cursorY, lines, rowHeights, defaultRowHeight);

  if (targetLineIndex < 0) return null;

  const firstEntry = clipboard.entries[0];
  const timeDelta = cursorTime - firstEntry.word.begin;

  const hasOverlap = checkOverlaps(clipboard, targetLineIndex, timeDelta, lines, duration);

  const ghosts = computeGhosts(
    clipboard,
    targetLineIndex,
    timeDelta,
    lines,
    zoom,
    duration,
    rowHeights,
    defaultRowHeight,
  );

  const scrollLeft = container.scrollLeft;
  const scrollTop = container.scrollTop;

  return (
    <div
      className={cn("absolute inset-0 z-55", hasOverlap ? "cursor-not-allowed" : "cursor-copy")}
      onClick={handleClick}
    >
      {ghosts.map((ghost) => (
        <div
          key={`${ghost.left}-${ghost.trackTop}-${ghost.text}-${ghost.isBg ? "bg" : "w"}`}
          className={cn(
            "absolute flex items-center justify-center text-xs text-white truncate rounded-xl border pointer-events-none",
            ghost.overlaps || ghost.outOfBounds
              ? "bg-red-500/30 border-red-500/60"
              : "bg-composer-accent/30 border-composer-accent/60",
            ghost.isBg && "opacity-70",
          )}
          style={{
            left: ghost.left - scrollLeft,
            top: ghost.trackTop - scrollTop + 4,
            width: ghost.width,
            height: ghost.trackHeight - 8,
          }}
        >
          <span className="px-1 truncate opacity-70">{ghost.text}</span>
        </div>
      ))}
    </div>
  );
};

// -- Helpers -------------------------------------------------------------------

function getLineIndexAtY(
  y: number,
  lines: LyricLine[],
  rowHeights: Record<string, number>,
  defaultRowHeight: number,
): number {
  let rowTop = WAVEFORM_HEIGHT;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const mainHeight = rowHeights[line.id] ?? defaultRowHeight;
    const hasBg = line.backgroundWords && line.backgroundWords.length > 0;
    const bgHeight = hasBg ? mainHeight : BG_DROP_ZONE_HEIGHT;
    const totalHeight = mainHeight + bgHeight + 1;

    if (y >= rowTop && y < rowTop + totalHeight) return i;
    rowTop += totalHeight;
  }
  return -1;
}

function checkOverlaps(
  clipboard: ClipboardData,
  targetLineIndex: number,
  timeDelta: number,
  lines: LyricLine[],
  duration: number,
): boolean {
  for (const entry of clipboard.entries) {
    const lineIdx = targetLineIndex + entry.lineOffset;
    if (lineIdx < 0 || lineIdx >= lines.length) return true;

    const newBegin = Math.max(0, entry.word.begin + timeDelta);
    const newEnd = Math.min(duration, entry.word.end + timeDelta);
    if (newEnd <= newBegin) return true;

    const line = lines[lineIdx];
    const wordsArray = entry.trackType === "word" ? line.words : line.backgroundWords;
    if (!wordsArray) continue;

    for (const existing of wordsArray) {
      if (newBegin < existing.end && newEnd > existing.begin) return true;
    }
  }
  return false;
}

function computeGhosts(
  clipboard: ClipboardData,
  targetLineIndex: number,
  timeDelta: number,
  lines: LyricLine[],
  zoom: number,
  duration: number,
  rowHeights: Record<string, number>,
  defaultRowHeight: number,
): GhostWord[] {
  const ghosts: GhostWord[] = [];

  const rowTops: number[] = [];
  const rowMainHeights: number[] = [];
  const rowBgHeights: number[] = [];
  let top = WAVEFORM_HEIGHT;
  for (const line of lines) {
    rowTops.push(top);
    const mainHeight = rowHeights[line.id] ?? defaultRowHeight;
    rowMainHeights.push(mainHeight);
    const hasBg = line.backgroundWords && line.backgroundWords.length > 0;
    const bgHeight = hasBg ? mainHeight : BG_DROP_ZONE_HEIGHT;
    rowBgHeights.push(bgHeight);
    top += mainHeight + bgHeight + 1;
  }

  for (const entry of clipboard.entries) {
    const lineIdx = targetLineIndex + entry.lineOffset;
    const outOfBounds = lineIdx < 0 || lineIdx >= lines.length;
    const isBg = entry.trackType === "bg";

    const newBegin = Math.max(0, entry.word.begin + timeDelta);
    const newEnd = Math.min(duration, entry.word.end + timeDelta);

    const left = GUTTER_WIDTH + newBegin * zoom;
    const width = Math.max((newEnd - newBegin) * zoom, 4);

    let overlaps = outOfBounds;
    if (!outOfBounds) {
      const line = lines[lineIdx];
      const wordsArray = isBg ? line.backgroundWords : line.words;
      if (wordsArray) {
        for (const existing of wordsArray) {
          if (newBegin < existing.end && newEnd > existing.begin) {
            overlaps = true;
            break;
          }
        }
      }
    }

    let trackTop: number;
    let trackHeight: number;

    if (outOfBounds) {
      trackTop = top;
      trackHeight = defaultRowHeight;
    } else if (isBg) {
      trackTop = rowTops[lineIdx] + rowMainHeights[lineIdx];
      trackHeight = rowBgHeights[lineIdx];
    } else {
      trackTop = rowTops[lineIdx];
      trackHeight = rowMainHeights[lineIdx];
    }

    ghosts.push({
      text: entry.word.text,
      left,
      width,
      trackTop,
      trackHeight,
      overlaps,
      outOfBounds,
      isBg,
    });
  }

  return ghosts;
}

// -- Exports -------------------------------------------------------------------

export { PastePreview };
