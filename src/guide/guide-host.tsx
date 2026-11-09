import { stageTiers } from "@/domain/guide/tier-state";
import { PROJECT_TABS } from "@/domain/project/tab";
import { ALL_GUIDE_TIPS } from "@/guide/catalog/all-tips";
import { JOURNEY_COPY, STAGE_HELP_SECTIONS, STAGE_NAMES } from "@/guide/catalog/journey";
import { GuideCardBody } from "@/guide/guide-card-body";
import { hideGuide } from "@/guide/hide-guide";
import { markPeeksRead } from "@/guide/peek-queue";
import { type StageTiers, useJourneyFeed, useMilestoneFeed, useNudgeFeed } from "@/guide/use-guide-feed";
import { useGuidePeek } from "@/guide/use-guide-peek";
import { useProjectJourney } from "@/guide/use-project-journey";
import { useEscapeLayer } from "@/hooks/useEscapeLayer";
import { noteGuideProjectFact } from "@/lib/guide-signals";
import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { useGuideStore } from "@/stores/guide";
import { useProjectStore } from "@/stores/project";
import { useUIStore } from "@/stores/ui";
import { cn } from "@/utils/cn";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { GuideCard } from "@/ui/guide/guide-card";
import { GuideOrb } from "@/ui/guide/guide-orb";
import { AnimatePresence, MotionConfig } from "motion/react";
import { useEffect, useMemo, useState } from "react";

// -- Hooks --------------------------------------------------------------------

function useAllStageTiers(): StageTiers {
  const learnedSignals = useGuideStore((state) => state.learnedSignals);
  const showAll = useGuideStore((state) => state.showAll);
  return useMemo(() => {
    const learned = new Set(learnedSignals);
    return new Map(PROJECT_TABS.map((stage) => [stage, stageTiers(ALL_GUIDE_TIPS, stage, learned, showAll)]));
  }, [learnedSignals, showAll]);
}

// -- Component ----------------------------------------------------------------

const GuideHost: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [focusNudgeId, setFocusNudgeId] = useState<string | null>(null);
  const [showingRecord, setShowingRecord] = useState(false);
  const projectId = useOpenProjectId();
  const journey = useProjectJourney();
  const tiers = useAllStageTiers();
  const firstVisit = useGuideStore((state) => state.learnedSignals.length === 0);
  const showAll = useGuideStore((state) => state.showAll);
  const activeTab = useProjectStore((state) => state.activeTab);
  // The orb steps around controls that sit in this corner: the Timeline footer and the Export side panel.
  const timelineFooterShown = useTimelineStore((state) => state.selectedWords.length > 0) && activeTab === "timeline";
  const pending = useNudgeFeed();
  useJourneyFeed(journey, projectId, firstVisit);
  const { milestone, clearMilestone } = useMilestoneFeed(tiers);
  const { queue, hold, release } = useGuidePeek(open);

  // Whatever arrived while the card was open was in front of the user already.
  const close = () => {
    markPeeksRead();
    setOpen(false);
    setShowingRecord(false);
    setFocusNudgeId(null);
  };
  const openCard = () => {
    setFocusNudgeId(queue.showing?.nudgeId ?? null);
    markPeeksRead();
    setOpen(true);
  };
  useEscapeLayer("panel", open, close);

  // Visiting a step's tab is a journey fact; the Timeline counts only once every line is synced.
  const syncComplete = journey.steps.some((step) => step.id === "sync" && step.done);
  useEffect(() => {
    if (activeTab === "preview") noteGuideProjectFact("visitedPreview");
    if (activeTab === "timeline" && syncComplete) noteGuideProjectFact("visitedTimeline");
  }, [activeTab, syncComplete]);

  const stepIndex = journey.current ? journey.steps.findIndex((step) => step.id === journey.current) : -1;
  const unread = queue.waiting.length + queue.unread.length;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "layer-floating pointer-events-none absolute right-3 bottom-3 flex flex-col items-end gap-3 transition-transform duration-250 ease-out *:pointer-events-auto",
          timelineFooterShown && "-translate-y-[54px]",
          activeTab === "export" && "-translate-x-[416px]",
        )}
      >
        <AnimatePresence>
          {open && (
            <GuideCard
              key="card"
              stepTitle={journey.current ? JOURNEY_COPY[journey.current].title : "Song finished"}
              stepNumber={stepIndex >= 0 ? stepIndex + 1 : null}
              doneCount={journey.doneCount}
              stepTotal={journey.steps.length}
              showingRecord={showingRecord}
              showAll={showAll}
              onToggleRecord={() => setShowingRecord((shown) => !shown)}
              onToggleShowAll={() => useGuideStore.getState().setShowAll(!showAll)}
              onOpenHelp={() => useUIStore.getState().openHelp(STAGE_HELP_SECTIONS[activeTab])}
              onStartOver={() => useGuideStore.getState().startOver()}
              onHide={hideGuide}
            >
              <GuideCardBody
                stage={activeTab}
                stageName={STAGE_NAMES[activeTab]}
                tiers={tiers}
                pending={pending}
                focusNudgeId={focusNudgeId}
                milestone={milestone}
                showingRecord={showingRecord}
                onMilestoneDone={clearMilestone}
              />
            </GuideCard>
          )}
        </AnimatePresence>
        <GuideOrb
          peek={queue.showing}
          unread={unread}
          progress={journey.doneCount / journey.steps.length}
          open={open}
          onClick={open ? close : openCard}
          onHold={hold}
          onRelease={release}
        />
      </div>
    </MotionConfig>
  );
};

// -- Exports ------------------------------------------------------------------

export { GuideHost };
