import { getLanguageAlignmentErrorItems } from "@/domain/language/alignment-errors";
import { getLanguageReviewItems } from "@/domain/language/review";
import { PROJECT_TABS, type ProjectTab } from "@/domain/project/tab";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { StatusChip } from "@/ui/status-chip";
import { TabStrip } from "@/ui/tab-strip";
import { inlineIconReducedVariants, inlineIconTransition, inlineIconVariants } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import { useEffectiveFocus } from "@/views/timeline/effective-focus";
import { rangePlaybackIndicator } from "@/views/timeline/selection-playback-icon";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconAlertCircle, IconAlertTriangle } from "@tabler/icons-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
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

const RangeIndicatorIcon: React.FC<{ indicator: ReturnType<typeof rangePlaybackIndicator> }> = ({ indicator }) => {
  const reducedMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {indicator && (
        <m.span
          key={indicator.label}
          aria-hidden="true"
          title={indicator.label}
          variants={reducedMotion ? inlineIconReducedVariants : inlineIconVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={inlineIconTransition}
          className="inline-flex overflow-hidden text-composer-accent-text"
        >
          <indicator.icon className="size-3.5 shrink-0" />
        </m.span>
      )}
    </AnimatePresence>
  );
};

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
  const regionSet = useTimelineStore((s) => s.loopRegion !== null);
  const rangeIndicator = rangePlaybackIndicator(selectionPlayback, groupOpen && loopOpenGroup, regionSet);
  const rangeStateId = useId();
  return (
    <TabStrip
      tabs={TABS}
      active={activeTab}
      onSelect={setActiveTab}
      navAttributes={{ "data-tour": "tab-bar" }}
      tabAttributes={(tab) => ({
        "data-tour": `tab-${tab.id}`,
        "aria-describedby": tab.id === "timeline" && rangeIndicator ? rangeStateId : undefined,
      })}
      renderTab={(tab, index, isActive) => {
        const showLanguageWarning = tab.id === "languages" && languageReviewCount > 0;
        const showLanguageError = tab.id === "languages" && languageErrorCount > 0;
        return (
          <>
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {tab.id === "timeline" && <RangeIndicatorIcon indicator={rangeIndicator} />}
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
            {showHints && (
              <span
                className={cn(
                  "max-[1279px]:hidden",
                  isActive ? "text-composer-accent-text" : "text-composer-text-faint",
                )}
              >
                <InlineKeyBadge keys={["Mod", String(index + 1)]} />
              </span>
            )}
          </>
        );
      }}
    >
      {rangeIndicator && (
        <span id={rangeStateId} hidden>
          {rangeIndicator.label}
        </span>
      )}
    </TabStrip>
  );
};

export { TabBar };
