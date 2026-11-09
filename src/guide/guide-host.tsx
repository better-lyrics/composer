import type { Journey } from "@/domain/guide/journey";
import { stageTiers } from "@/domain/guide/tier-state";
import { PROJECT_TABS, type ProjectTab } from "@/domain/project/tab";
import { JOURNEY_COPY, STAGE_HELP_SECTIONS, STAGE_NAMES } from "@/guide/catalog/journey";
import type { GuideTip } from "@/guide/catalog/types";
import { GuideCardBody } from "@/guide/guide-card-body";
import { hideGuide } from "@/guide/hide-guide";
import { markPeeksRead } from "@/guide/peek-queue";
import { type StageTiers, useJourneyFeed, useMilestoneFeed, useNudgeFeed } from "@/guide/use-guide-feed";
import { useGuidePeek } from "@/guide/use-guide-peek";
import { SpotHint } from "@/guide/spot-hint";
import { useGuideStateLearning } from "@/guide/use-guide-state-learning";
import { useGuideTips } from "@/guide/use-guide-tips";
import { useOrbPlacement } from "@/guide/use-orb-placement";
import { useJourneyVisits, useProjectJourney } from "@/guide/use-project-journey";
import { useEscapeLayer } from "@/hooks/useEscapeLayer";
import { startGuideOver } from "@/lib/guide-signals";
import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { useGuideStore } from "@/stores/guide";
import { useProjectStore } from "@/stores/project";
import { useUIStore } from "@/stores/ui";
import { GuideCard } from "@/ui/guide/guide-card";
import { GuideOrb } from "@/ui/guide/guide-orb";
import { guideSpring } from "@/utils/animationVariants";
import { AnimatePresence, LazyMotion, MotionConfig, m } from "motion/react";
import { useMemo, useState } from "react";

// -- Hooks --------------------------------------------------------------------

function useAllStageTiers(tips: readonly GuideTip[]): StageTiers {
  const learnedSignals = useGuideStore((state) => state.learnedSignals);
  const showAll = useGuideStore((state) => state.showAll);
  return useMemo(() => {
    const learned = new Set(learnedSignals);
    return new Map(PROJECT_TABS.map((stage) => [stage, stageTiers(tips, stage, learned, showAll)]));
  }, [tips, learnedSignals, showAll]);
}

// -- Helpers ------------------------------------------------------------------

const loadGuideMotionFeatures = () =>
  import("@/guide/guide-motion-features").then((module) => module.guideMotionFeatures);

// The card header names the next step, links to its tab from elsewhere and counts where it sits.
function journeyHeader(journey: Journey, activeTab: ProjectTab) {
  const current = journey.current;
  if (!current) return { stepTitle: "Song finished", goToStep: undefined, stepNumber: null };
  const { title, stage } = JOURNEY_COPY[current];
  const goToStep =
    stage === activeTab
      ? undefined
      : { stageName: STAGE_NAMES[stage], onGo: () => useProjectStore.getState().setActiveTab(stage) };
  return { stepTitle: title, goToStep, stepNumber: journey.steps.findIndex((step) => step.id === current) + 1 };
}

// -- Component ----------------------------------------------------------------

const GuideHost: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [focusNudgeId, setFocusNudgeId] = useState<string | null>(null);
  const [showingRecord, setShowingRecord] = useState(false);
  const projectId = useOpenProjectId();
  const journey = useProjectJourney();
  const tips = useGuideTips();
  const tiers = useAllStageTiers(tips);
  const firstVisit = useGuideStore((state) => state.learnedSignals.length === 0);
  const showAll = useGuideStore((state) => state.showAll);
  const activeTab = useProjectStore((state) => state.activeTab);
  useGuideStateLearning();
  const pending = useNudgeFeed();
  useJourneyFeed(journey, projectId, firstVisit);
  const { milestone, clearMilestone } = useMilestoneFeed(tiers);
  const { queue, hold, release } = useGuidePeek(open, activeTab);

  // Whatever arrived while the card was open was in front of the user already.
  const close = () => {
    markPeeksRead();
    setOpen(false);
    setShowingRecord(false);
    setFocusNudgeId(null);
  };
  const openCard = () => {
    const focus = queue.showing?.nudgeId ?? null;
    const cardNudgeId = pending.find((queued) => queued.id === focus)?.id ?? pending[0]?.id;
    setFocusNudgeId(focus);
    markPeeksRead((peek) => peek.nudgeId !== undefined && peek.nudgeId !== cardNudgeId);
    setOpen(true);
  };
  useEscapeLayer("panel", open, close);

  useJourneyVisits(journey, activeTab, projectId);
  const placement = useOrbPlacement(activeTab);

  const header = journeyHeader(journey, activeTab);
  const unread = queue.waiting.length + queue.unread.length;

  return (
    <LazyMotion features={loadGuideMotionFeatures}>
      <MotionConfig reducedMotion="user">
        <m.div
          layout="position"
          initial={false}
          animate={{ x: placement.x, y: placement.y }}
          transition={guideSpring}
          className="layer-floating pointer-events-none absolute right-3 bottom-3 flex flex-col items-end gap-3 *:pointer-events-auto"
        >
          <AnimatePresence>
            {open && (
              <GuideCard
                key="card"
                className={placement.cardRoom}
                stepTitle={header.stepTitle}
                goToStep={header.goToStep}
                stepNumber={header.stepNumber}
                doneCount={journey.doneCount}
                stepTotal={journey.steps.length}
                showingRecord={showingRecord}
                showAll={showAll}
                onToggleRecord={() => setShowingRecord((shown) => !shown)}
                onToggleShowAll={() => useGuideStore.getState().setShowAll(!showAll)}
                onOpenHelp={() => useUIStore.getState().openHelp(STAGE_HELP_SECTIONS[activeTab])}
                onStartOver={() => startGuideOver()}
                onHide={hideGuide}
              >
                <GuideCardBody
                  stage={activeTab}
                  stageName={STAGE_NAMES[activeTab]}
                  tiers={tiers}
                  tips={tips}
                  pending={pending}
                  focusNudgeId={focusNudgeId}
                  milestone={milestone}
                  showingRecord={showingRecord}
                  onLeaveRecord={() => setShowingRecord(false)}
                  onMilestoneDone={clearMilestone}
                />
              </GuideCard>
            )}
          </AnimatePresence>
          <SpotHint />
          <GuideOrb
            peek={queue.showing}
            unread={unread}
            progress={journey.doneCount / journey.steps.length}
            open={open}
            onClick={open ? close : openCard}
            onHold={hold}
            onRelease={release}
          />
        </m.div>
      </MotionConfig>
    </LazyMotion>
  );
};

// -- Exports ------------------------------------------------------------------

export { GuideHost };
