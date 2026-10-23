import { getLanguageAlignmentErrorItems } from "@/domain/language/alignment-errors";
import { getLanguageReviewItems } from "@/domain/language/review";
import { PROJECT_TABS, type ProjectTab } from "@/domain/project/tab";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { StatusChip } from "@/ui/status-chip";
import { inlineIconReducedVariants, inlineIconTransition, inlineIconVariants } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import { useEffectiveFocus } from "@/views/timeline/effective-focus";
import { rangePlaybackIndicator } from "@/views/timeline/selection-playback-icon";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconAlertCircle, IconAlertTriangle } from "@tabler/icons-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useId, useLayoutEffect, useRef } from "react";

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

function useSlidingCap(activeTab: ProjectTab) {
  const navRef = useRef<HTMLElement>(null);
  const capRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const cap = capRef.current;
    if (!nav || !cap) return;
    const place = () => {
      const tab = nav.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`);
      if (!tab) return;
      cap.style.width = `${tab.offsetWidth}px`;
      cap.style.transform = `translateX(${tab.offsetLeft}px)`;
    };
    place();
    cap.dataset.placed = "";
    // Only a tab change glides; a tab that resizes in place (a status icon growing in) carries the cap with it.
    let observedOnce = false;
    const follow = () => {
      if (!observedOnce) {
        observedOnce = true;
        return;
      }
      delete cap.dataset.placed;
      place();
      void cap.offsetWidth;
      cap.dataset.placed = "";
    };
    const observer = new ResizeObserver(follow);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [activeTab]);

  return { navRef, capRef };
}

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
  const rangeIndicator = rangePlaybackIndicator(selectionPlayback, groupOpen && loopOpenGroup);
  const rangeStateId = useId();
  const { navRef, capRef } = useSlidingCap(activeTab);

  return (
    <nav
      ref={navRef}
      data-tour="tab-bar"
      className="relative flex p-(--tray-pad) rounded-[calc(9px+var(--tray-pad))] bg-(--well) shadow-(--well-edge) select-none"
    >
      <span
        ref={capRef}
        aria-hidden="true"
        className="absolute top-(--tray-pad) left-0 h-[calc(100%-2*var(--tray-pad))] w-0 rounded-[9px] bg-(--cap) shadow-(--raised-edge) data-placed:transition-[transform,width] data-placed:duration-400 data-placed:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      />
      {TABS.map((tab, index) => {
        const isActive = activeTab === tab.id;
        const showLanguageWarning = tab.id === "languages" && languageReviewCount > 0;
        const showLanguageError = tab.id === "languages" && languageErrorCount > 0;
        return (
          <button
            key={tab.id}
            type="button"
            data-tour={`tab-${tab.id}`}
            data-tab={tab.id}
            aria-current={isActive ? "page" : undefined}
            onClick={() => setActiveTab(tab.id)}
            aria-describedby={tab.id === "timeline" && rangeIndicator ? rangeStateId : undefined}
            className={cn(
              "relative flex items-center h-8 px-3 rounded-[9px] cursor-pointer text-[13.5px] font-medium transition-colors",
              isActive ? "text-composer-text" : "text-[var(--muted)] hover:text-[var(--label)]",
            )}
          >
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
