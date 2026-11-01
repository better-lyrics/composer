import { isLinked } from "@/domain/instance/predicates";
import { hasTransliteration } from "@/domain/language/has-transliteration";
import { isLineSynced } from "@/domain/line/predicates";
import type { WordTiming } from "@/domain/word/timing";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { ShortcutToggleButton } from "@/ui/shortcut-toggle-button";
import { TooltipGroup } from "@/ui/tooltip";
import { convertLineToWord, splitIntoWordsWithMeta } from "@/utils/sync-helpers";
import { HeaderAction } from "@/views/timeline/header-action";
import { SnapLatch } from "@/views/timeline/snap-latch";
import { SpectrumLatch } from "@/views/timeline/spectrum/spectrum-latch";
import { TimelineAutoAlign } from "@/views/timeline/timeline-auto-align";
import { TimelineZoomControls } from "@/views/timeline/timeline-header-controls";
import { TimelineNotices } from "@/views/timeline/timeline-notices";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useCueShortcuts } from "@/views/timeline/use-cue-shortcuts";
import {
  IconArrowBackUp,
  IconArrowBarBoth,
  IconChevronsDown,
  IconChevronsUp,
  IconEye,
  IconFocusCentered,
  IconLanguage,
  IconLayoutDistributeHorizontal,
  IconMapPin,
  IconTextPlus,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo } from "react";

interface TimelineHeaderProps {
  onImportLyrics?: () => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

const TimelineHeader: React.FC<TimelineHeaderProps> = ({ onImportLyrics, scrollContainerRef }) => {
  useCueShortcuts();
  const followPlayhead = useSettingsStore((s) => s.followPlayhead);
  const returnToCue = useSettingsStore((s) => s.returnToCue);
  const previewSidebar = useSettingsStore((s) => s.previewSidebar);
  const rollingEdit = useSettingsStore((s) => s.rollingEdit);
  const markerMode = useTimelineStore((s) => s.markerMode);
  const toggleMarkerMode = useTimelineStore((s) => s.toggleMarkerMode);
  const showHints = useSettingsStore((s) => s.showShortcutHints);
  const lines = useProjectStore((s) => s.lines);
  const collapsedInstances = useTimelineStore((s) => s.collapsedInstances);
  const setInstanceCollapsed = useTimelineStore((s) => s.setInstanceCollapsed);
  const textVariant = useTimelineStore((s) => s.textVariant);
  const toggleTextVariant = useTimelineStore((s) => s.toggleTextVariant);
  const linesHaveTransliteration = useMemo(() => hasTransliteration(lines), [lines]);
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
    <TooltipGroup>
      <div className="@container flex items-center justify-between gap-4 h-13 shrink-0 px-2 border-b border-(--divider) @max-[72rem]:[&_[data-inline-key-badge]]:hidden">
        <h2 className="sr-only">Timeline</h2>
        <div className="flex items-center gap-3 shrink-0">
          <div className="tray">
            <ShortcutToggleButton
              active={textVariant === "transliteration"}
              label={textVariant === "transliteration" ? "Transliteration" : "Original"}
              stateInLabel
              shortcut="timeline.toggleTextVariant"
              onClick={toggleTextVariant}
              disabled={!linesHaveTransliteration}
              description="Toggle original / transliteration labels"
              iconOnly
            >
              <IconLanguage />
            </ShortcutToggleButton>
          </div>

          <div className="tray">
            <ShortcutToggleButton
              active={followPlayhead}
              label="Follow"
              shortcut="timeline.toggleFollow"
              onClick={() => useSettingsStore.getState().toggle("followPlayhead")}
              iconOnly
            >
              <IconFocusCentered />
            </ShortcutToggleButton>
            <ShortcutToggleButton
              active={returnToCue}
              label="Return to cue"
              description="Play starts from the cue, and stopping returns to it"
              shortcut="timeline.toggleReturnToCue"
              onClick={() => useSettingsStore.getState().toggle("returnToCue")}
              iconOnly
            >
              <IconArrowBackUp />
            </ShortcutToggleButton>
            <ShortcutToggleButton
              active={rollingEdit}
              label="Rolling"
              shortcut="timeline.toggleRollingEdit"
              onClick={() => useSettingsStore.getState().toggle("rollingEdit")}
              description="Rolling edit: drag a shared word boundary and both words move together"
              iconOnly
            >
              <IconArrowBarBoth />
            </ShortcutToggleButton>
            <ShortcutToggleButton
              active={previewSidebar}
              label="Preview"
              shortcut="timeline.togglePreview"
              onClick={() => useSettingsStore.getState().toggle("previewSidebar")}
              iconOnly
            >
              <IconEye />
            </ShortcutToggleButton>
          </div>

          <div className="tray">
            <SnapLatch />
            <ShortcutToggleButton
              active={markerMode}
              label="Marker"
              shortcut="timeline.toggleMarkerMode"
              onClick={toggleMarkerMode}
              iconOnly
            >
              <IconMapPin />
            </ShortcutToggleButton>
          </div>

          <div className="tray">
            <SpectrumLatch />
          </div>

          <TimelineAutoAlign />

          {onImportLyrics && (
            <HeaderAction onClick={onImportLyrics} label="Import" shortcut="timeline.importLyrics" showHint={showHints}>
              <IconTextPlus />
            </HeaderAction>
          )}

          {hasUnexpandedLines && (
            <HeaderAction
              onClick={handleExpandAll}
              label="Expand All"
              shortcut="timeline.expandAll"
              showHint={showHints}
            >
              <IconLayoutDistributeHorizontal />
            </HeaderAction>
          )}

          {hasGroups && (
            <HeaderAction
              onClick={handleToggleAllCollapsed}
              label={anyExpanded ? "Collapse all" : "Expand all"}
              description={anyExpanded ? "Collapse all groups" : "Expand all groups"}
              shortcut="timeline.toggleAllCollapsed"
              showHint={showHints}
            >
              {anyExpanded ? <IconChevronsUp /> : <IconChevronsDown />}
            </HeaderAction>
          )}
        </div>

        <div className="flex flex-1 min-w-0 items-center justify-end gap-3">
          <TimelineNotices />
          <TimelineZoomControls scrollContainerRef={scrollContainerRef} />
        </div>
      </div>
    </TooltipGroup>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineHeader };
