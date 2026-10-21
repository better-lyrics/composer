import { getLanguageAlignmentErrorItems } from "@/domain/language/alignment-errors";
import { getLanguageReviewItems } from "@/domain/language/review";
import { PROJECT_TABS, type ProjectTab } from "@/domain/project/tab";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { StatusChip } from "@/ui/status-chip";
import { cn } from "@/utils/cn";
import { useEffectiveFocus } from "@/views/timeline/effective-focus";
import { rangePlaybackIndicator } from "@/views/timeline/selection-playback-icon";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconAlertCircle, IconAlertTriangle } from "@tabler/icons-react";
import { useId } from "react";

const TAB_LABELS: Record<ProjectTab, string> = {
  import: "Import",
  edit: "Edit",
  languages: "Languages",
  sync: "Sync",
  timeline: "Timeline",
  preview: "Preview",
  export: "Export",
};

const TABS = PROJECT_TABS.map((id) => ({ id, label: TAB_LABELS[id] }));

const TabBar: React.FC = () => {
  const activeTab = useProjectStore((s) => s.activeTab);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const lines = useProjectStore((s) => s.lines);
  const showHints = useSettingsStore((s) => s.showShortcutHints);
  const languageReviewCount = getLanguageReviewItems(lines).length;
  const languageErrorCount = getLanguageAlignmentErrorItems(lines).length;
  const selectionPlayback = useTimelineStore((s) => s.selectionPlayback);
  const loopOpenGroup = useSettingsStore((s) => s.loopOpenGroup);
  const groupOpen = useEffectiveFocus() !== null;
  const rangeIndicator = rangePlaybackIndicator(selectionPlayback, groupOpen && loopOpenGroup);
  const rangeStateId = useId();

  return (
    <nav data-tour="tab-bar" className="flex border-b border-composer-border select-none">
      {TABS.map((tab, index) => {
        const isActive = activeTab === tab.id;
        const showLanguageWarning = tab.id === "languages" && languageReviewCount > 0;
        const showLanguageError = tab.id === "languages" && languageErrorCount > 0;
        return (
          <button
            key={tab.id}
            type="button"
            data-tour={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            aria-describedby={tab.id === "timeline" && rangeIndicator ? rangeStateId : undefined}
            className={cn(
              "cursor-pointer px-4 py-3 text-sm font-medium transition-colors",
              isActive
                ? "border-b-2 border-composer-accent text-composer-text"
                : "text-composer-text-muted hover:text-composer-text-secondary",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {tab.id === "timeline" && rangeIndicator && (
                <rangeIndicator.icon
                  aria-hidden="true"
                  title={rangeIndicator.label}
                  className="size-3.5 text-composer-accent-text"
                />
              )}
              {showLanguageError && (
                <StatusChip
                  tone="error"
                  icon={IconAlertCircle}
                  aria-label={
                    languageErrorCount === 1
                      ? "1 line with a timing mismatch"
                      : `${languageErrorCount} lines with a timing mismatch`
                  }
                >
                  {languageErrorCount}
                </StatusChip>
              )}
              {showLanguageWarning && (
                <StatusChip
                  tone="warning"
                  icon={IconAlertTriangle}
                  aria-label={
                    languageReviewCount === 1
                      ? "1 line needs review in Languages"
                      : `${languageReviewCount} lines need review in Languages`
                  }
                >
                  {languageReviewCount}
                </StatusChip>
              )}
            </span>
            {showHints && <InlineKeyBadge keys={["Mod", String(index + 1)]} />}
          </button>
        );
      })}
      {rangeIndicator && (
        <span id={rangeStateId} hidden>
          {rangeIndicator.label}
        </span>
      )}
    </nav>
  );
};

export { TabBar };
