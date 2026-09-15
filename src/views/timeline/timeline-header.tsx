import { isLinked } from "@/domain/instance/predicates";
import { isLineSynced } from "@/domain/line/predicates";
import type { WordTiming } from "@/domain/word/timing";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { Button } from "@/ui/button";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { cn } from "@/utils/cn";
import { MOD_KEY } from "@/utils/platform";
import { convertLineToWord, splitIntoWordsWithMeta } from "@/utils/sync-helpers";
import { TimelineToggleButton, TimelineZoomControls } from "@/views/timeline/timeline-header-controls";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import {
  IconArrowBarBoth,
  IconChevronsDown,
  IconChevronsUp,
  IconEye,
  IconFocusCentered,
  IconLanguage,
  IconLayoutDistributeHorizontal,
  IconMagnet,
  IconMapPin,
  IconTextPlus,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo } from "react";

interface TimelineHeaderProps {
  onImportLyrics?: () => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

const TimelineHeader: React.FC<TimelineHeaderProps> = ({ onImportLyrics, scrollContainerRef }) => {
  const followEnabled = useTimelineStore((s) => s.followEnabled);
  const toggleFollow = useTimelineStore((s) => s.toggleFollow);
  const previewSidebarOpen = useTimelineStore((s) => s.previewSidebarOpen);
  const togglePreviewSidebar = useTimelineStore((s) => s.togglePreviewSidebar);
  const rollingEditMode = useTimelineStore((s) => s.rollingEditMode);
  const toggleRollingEditMode = useTimelineStore((s) => s.toggleRollingEditMode);
  const markerMode = useTimelineStore((s) => s.markerMode);
  const toggleMarkerMode = useTimelineStore((s) => s.toggleMarkerMode);
  const showHints = useSettingsStore((s) => s.showShortcutHints);
  const snapEnabled = useSettingsStore((s) => s.timelineSnap);
  const setSetting = useSettingsStore((s) => s.set);
  const isBypassing = useTimelineStore((s) => s.isBypassing);
  const toggleSnapKeys = getEffectiveKeysArray("timeline.toggleSnap");
  const toggleMarkerKeys = getEffectiveKeysArray("timeline.toggleMarkerMode");
  const lines = useProjectStore((s) => s.lines);
  const collapsedInstances = useTimelineStore((s) => s.collapsedInstances);
  const setInstanceCollapsed = useTimelineStore((s) => s.setInstanceCollapsed);
  const textVariant = useTimelineStore((s) => s.textVariant);
  const toggleTextVariant = useTimelineStore((s) => s.toggleTextVariant);
  const hasTransliteration = useMemo(
    () => lines.some((line) => !!(line.transliteration?.text || line.transliteration?.backgroundText)),
    [lines],
  );
  const hasUnexpandedLines = useMemo(() => lines.some((l) => !l.words?.length && l.text.trim().length > 0), [lines]);

  const instanceKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const line of lines) {
      if (isLinked(line)) {
        keys.add(`${line.groupId}:${line.instanceIdx}`);
      }
    }
    return [...keys];
  }, [lines]);

  const hasGroups = instanceKeys.length > 0;
  const anyExpanded = useMemo(
    () => instanceKeys.some((k) => !collapsedInstances[k]),
    [instanceKeys, collapsedInstances],
  );

  const handleToggleAllCollapsed = useCallback(() => {
    for (const k of instanceKeys) setInstanceCollapsed(k, anyExpanded);
  }, [instanceKeys, anyExpanded, setInstanceCollapsed]);

  const handleExpandAll = useCallback(() => {
    const currentTime = useAudioStore.getState().currentTime;
    const wordDuration = useSettingsStore.getState().defaultWordDuration;
    const updateLinesWithHistory = useProjectStore.getState().updateLinesWithHistory;

    const updates: Array<{ id: string; updates: { words?: WordTiming[]; begin?: undefined; end?: undefined } }> = [];

    for (const line of lines) {
      if (line.words?.length) continue;
      if (!line.text.trim()) continue;

      if (isLineSynced(line)) {
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

      const lineIndexById = new Map<string, number>();
      for (let i = 0; i < lines.length; i++) lineIndexById.set(lines[i].id, i);
      const newSelections: Array<{ lineId: string; lineIndex: number; wordIndex: number; type: "word" | "bg" }> = [];
      for (const u of updates) {
        const lineIndex = lineIndexById.get(u.id);
        if (lineIndex === undefined || !u.updates.words) continue;
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

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-composer-border">
      <h2 className="text-lg font-medium select-none">Timeline</h2>

      <div className="flex items-center gap-4">
        <TimelineToggleButton
          active={textVariant === "transliteration"}
          label={textVariant === "transliteration" ? "Transliteration" : "Original"}
          shortcut="timeline.toggleTextVariant"
          onClick={toggleTextVariant}
          disabled={!hasTransliteration}
          title="Toggle original / transliteration labels"
        >
          <IconLanguage size={16} />
        </TimelineToggleButton>
        {/* Follow toggle */}
        <TimelineToggleButton
          active={followEnabled}
          label="Follow"
          shortcut="timeline.toggleFollow"
          onClick={toggleFollow}
        >
          <IconFocusCentered size={16} />
        </TimelineToggleButton>

        {/* Rolling edit toggle */}
        <TimelineToggleButton
          active={rollingEditMode}
          label="Rolling"
          shortcut="timeline.toggleRollingEdit"
          onClick={toggleRollingEditMode}
          title="Rolling edit: drag a shared word boundary and both words move together"
        >
          <IconArrowBarBoth size={16} />
        </TimelineToggleButton>

        {/* Preview sidebar toggle */}
        <TimelineToggleButton
          active={previewSidebarOpen}
          label="Preview"
          shortcut="timeline.togglePreview"
          onClick={togglePreviewSidebar}
        >
          <IconEye size={16} />
        </TimelineToggleButton>

        <TimelineToggleButton
          active={snapEnabled}
          label="Snap"
          shortcut="timeline.toggleSnap"
          onClick={() => setSetting("timelineSnap", !snapEnabled)}
          className={cn(isBypassing && "opacity-50")}
          title={`Snap${toggleSnapKeys.length ? ` (${toggleSnapKeys.join(" ")})` : ""} · hold ${MOD_KEY} to bypass`}
        >
          <IconMagnet size={16} />
        </TimelineToggleButton>

        {/* Marker mode toggle */}
        <TimelineToggleButton
          active={markerMode}
          label="Marker"
          shortcut="timeline.toggleMarkerMode"
          onClick={toggleMarkerMode}
          title={`Marker mode${toggleMarkerKeys.length ? ` (${toggleMarkerKeys.join(" ")})` : ""}`}
        >
          <IconMapPin size={16} />
        </TimelineToggleButton>

        {/* Import lyrics */}
        {onImportLyrics && (
          <Button variant="ghost" size="sm" onClick={onImportLyrics} hasIcon className="opacity-60">
            <IconTextPlus size={16} />
            <span>Import</span>
            {showHints && <InlineKeyBadge keys={getEffectiveKeysArray("timeline.importLyrics")} />}
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

        {/* Collapse / expand all groups */}
        {hasGroups && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleAllCollapsed}
            hasIcon
            className="opacity-60"
            title={anyExpanded ? "Collapse all groups" : "Expand all groups"}
          >
            {anyExpanded ? <IconChevronsUp size={16} /> : <IconChevronsDown size={16} />}
            <span>{anyExpanded ? "Collapse all" : "Expand all"}</span>
            {showHints && <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleAllCollapsed")} />}
          </Button>
        )}

        <TimelineZoomControls scrollContainerRef={scrollContainerRef} />
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineHeader };
