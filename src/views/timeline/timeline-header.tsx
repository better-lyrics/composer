import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import type { WordTiming } from "@/stores/project";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/ui/button";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { cn } from "@/utils/cn";
import { convertLineToWord, splitIntoWordsWithMeta } from "@/utils/sync-helpers";
import { MAX_ZOOM, MIN_ZOOM, useTimelineStore } from "@/views/timeline/timeline-store";
import {
  IconEye,
  IconFocusCentered,
  IconLayoutDistributeHorizontal,
  IconMinus,
  IconPlus,
  IconPointer,
  IconTextPlus,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo } from "react";

// -- Types --------------------------------------------------------------------

interface TimelineHeaderProps {
  onImportLyrics?: () => void;
}

// -- Component -----------------------------------------------------------------

const TimelineHeader: React.FC<TimelineHeaderProps> = ({ onImportLyrics }) => {
  const zoom = useTimelineStore((s) => s.zoom);
  const zoomIn = useTimelineStore((s) => s.zoomIn);
  const zoomOut = useTimelineStore((s) => s.zoomOut);
  const followEnabled = useTimelineStore((s) => s.followEnabled);
  const toggleFollow = useTimelineStore((s) => s.toggleFollow);
  const previewSidebarOpen = useTimelineStore((s) => s.previewSidebarOpen);
  const togglePreviewSidebar = useTimelineStore((s) => s.togglePreviewSidebar);
  const selectOnlyMode = useTimelineStore((s) => s.selectOnlyMode);
  const toggleSelectOnlyMode = useTimelineStore((s) => s.toggleSelectOnlyMode);
  const showHints = useSettingsStore((s) => s.showShortcutHints);
  const lines = useProjectStore((s) => s.lines);

  const hasUnexpandedLines = useMemo(
    () => lines.some((l) => !l.words?.length && l.text.trim().length > 0),
    [lines],
  );

  const handleExpandAll = useCallback(() => {
    const currentTime = useAudioStore.getState().currentTime;
    const wordDuration = useSettingsStore.getState().defaultWordDuration;
    const updateLinesWithHistory = useProjectStore.getState().updateLinesWithHistory;

    const updates: Array<{ id: string; updates: { words?: WordTiming[]; begin?: undefined; end?: undefined } }> = [];

    for (const line of lines) {
      if (line.words?.length) continue;
      if (!line.text.trim()) continue;

      const isLineSynced = line.begin !== undefined && line.end !== undefined;

      if (isLineSynced) {
        const converted = convertLineToWord(line);
        if (converted.words) {
          updates.push({ id: line.id, updates: { words: converted.words, begin: undefined, end: undefined } });
        }
      } else {
        const { parts, trailingSpace } = splitIntoWordsWithMeta(line.text);
        if (parts.length === 0) continue;
        const words: WordTiming[] = parts.map((part, i) => ({
          text: trailingSpace[i] ? `${part} ` : part,
          begin: currentTime + i * wordDuration,
          end: currentTime + (i + 1) * wordDuration,
        }));
        updates.push({ id: line.id, updates: { words } });
      }
    }

    if (updates.length > 0) {
      updateLinesWithHistory(updates);

      const newSelections: Array<{ lineId: string; lineIndex: number; wordIndex: number; type: "word" | "bg" }> = [];
      for (const u of updates) {
        const lineIndex = lines.findIndex((l) => l.id === u.id);
        if (lineIndex < 0 || !u.updates.words) continue;
        for (let wi = 0; wi < u.updates.words.length; wi++) {
          newSelections.push({ lineId: u.id, lineIndex, wordIndex: wi, type: "word" });
        }
      }
      if (newSelections.length > 0) {
        useTimelineStore.getState().setSelectedWords(newSelections);
      }
    }
  }, [lines]);

  useEffect(() => {
    const handler = () => handleExpandAll();
    window.addEventListener("timeline:expand-all", handler);
    return () => window.removeEventListener("timeline:expand-all", handler);
  }, [handleExpandAll]);

  const zoomPercent = Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100);

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-composer-border">
      <h2 className="text-lg font-medium select-none">Timeline</h2>

      <div className="flex items-center gap-4">
        {/* Follow toggle */}
        <Button
          variant={followEnabled ? "primary" : "ghost"}
          size="sm"
          onClick={toggleFollow}
          hasIcon
          className={cn(!followEnabled && "opacity-60")}
        >
          <IconFocusCentered size={16} />
          <span>Follow</span>
          {showHints && <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleFollow")} />}
        </Button>

        {/* Select-only mode toggle */}
        <Button
          variant={selectOnlyMode ? "primary" : "ghost"}
          size="sm"
          onClick={toggleSelectOnlyMode}
          hasIcon
          className={cn(!selectOnlyMode && "opacity-60")}
          title="Select-only mode (disables double-click word creation)"
        >
          <IconPointer size={16} />
          <span>Select</span>
        </Button>

        {/* Preview sidebar toggle */}
        <Button
          variant={previewSidebarOpen ? "primary" : "ghost"}
          size="sm"
          onClick={togglePreviewSidebar}
          hasIcon
          className={cn(!previewSidebarOpen && "opacity-60")}
        >
          <IconEye size={16} />
          <span>Preview</span>
          {showHints && <InlineKeyBadge keys={getEffectiveKeysArray("timeline.togglePreview")} />}
        </Button>

        {/* Import lyrics */}
        {onImportLyrics && (
          <Button variant="ghost" size="sm" onClick={onImportLyrics} hasIcon className="opacity-60">
            <IconTextPlus size={16} />
            <span>Import</span>
            {showHints && <InlineKeyBadge keys={["Mod", "Shift", "V"]} />}
          </Button>
        )}

        {/* Expand all unexpanded lines */}
        {hasUnexpandedLines && (
          <Button variant="ghost" size="sm" onClick={handleExpandAll} hasIcon className="opacity-60">
            <IconLayoutDistributeHorizontal size={16} />
            <span>Expand All</span>
            {showHints && <InlineKeyBadge keys={getEffectiveKeysArray("timeline.expandAll")} />}
          </Button>
        )}

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={zoomOut} disabled={zoom <= MIN_ZOOM} className="h-7 w-7">
            <IconMinus size={16} />
          </Button>

          <span className="w-12 text-center text-xs text-composer-text-muted select-none tabular-nums">
            {zoomPercent}%
          </span>

          <Button variant="ghost" size="icon" onClick={zoomIn} disabled={zoom >= MAX_ZOOM} className="h-7 w-7">
            <IconPlus size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineHeader };
