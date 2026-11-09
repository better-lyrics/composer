import { GUIDE_TIER_ORDER, type GuideStage, type GuideTierId } from "@/domain/guide/model";
import { STAGE_NAMES } from "@/guide/catalog/journey";
import { GUIDE_NUDGES } from "@/guide/catalog/nudges";
import { muteHintsLike } from "@/guide/mute-hints";
import type { GuideTip } from "@/guide/catalog/types";
import type { EarnedTier, StageTiers } from "@/guide/use-guide-feed";
import { markGuideNudgeShown, type PendingNudge, resolveGuideNudge } from "@/lib/guide-signals";
import { useGuideStore } from "@/stores/guide";
import { GuideRecord } from "@/ui/guide/guide-record";
import { GuideTips } from "@/ui/guide/guide-tips";
import { Milestone } from "@/ui/guide/milestone";
import { NudgePanel } from "@/ui/guide/nudge-panel";
import { guideViewSwapVariants } from "@/utils/animationVariants";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useMemo, useState } from "react";

// -- Types --------------------------------------------------------------------

interface GuideCardBodyProps {
  stage: GuideStage;
  stageName: string;
  tiers: StageTiers;
  tips: readonly GuideTip[];
  pending: readonly PendingNudge[];
  focusNudgeId: string | null;
  milestone: EarnedTier | null;
  showingRecord: boolean;
  onLeaveRecord: () => void;
  onMilestoneDone: () => void;
  onShowTip: (tip: GuideTip) => void;
}

// -- Component ----------------------------------------------------------------

// The card is one of the places a nudge reaches the screen, so showing it here counts as seen.
const ShownNudgePanel: React.FC<React.ComponentProps<typeof NudgePanel>> = (props) => {
  const { id } = props.nudge;
  useEffect(() => markGuideNudgeShown(id), [id]);
  return <NudgePanel {...props} />;
};

type ShownTier = { stage: GuideStage; tier?: GuideTierId } | null;

const RecordView: React.FC<{ tiers: StageTiers; onOpenStage: (stage: GuideStage) => void }> = ({
  tiers,
  onOpenStage,
}) => {
  const stages = [...tiers]
    .map(([stage, statuses]) => ({ stage, name: STAGE_NAMES[stage], tiers: statuses }))
    .filter((row) => row.tiers.some((status) => status.total > 0));
  return <GuideRecord stages={stages} onOpenStage={onOpenStage} />;
};

const MilestoneView: React.FC<{
  milestone: EarnedTier;
  tips: readonly GuideTip[];
  learned: ReadonlySet<string>;
  onContinue: (next: GuideTierId | undefined) => void;
}> = ({ milestone, tips, learned, onContinue }) => {
  const inTier = (tier: GuideTierId) => tips.filter((tip) => tip.stage === milestone.stage && tip.tier === tier);
  const next = GUIDE_TIER_ORDER.slice(GUIDE_TIER_ORDER.indexOf(milestone.tier) + 1).find(
    (tier) => inTier(tier).length > 0,
  );
  const newTips = next ? inTier(next).filter((tip) => !learned.has(tip.learnedBy)).length : 0;
  return (
    <Milestone
      stageName={STAGE_NAMES[milestone.stage]}
      tier={milestone.tier}
      tipCount={inTier(milestone.tier).length}
      next={next ? { tier: next, tipCount: newTips } : null}
      onContinue={() => onContinue(next)}
    />
  );
};

const TipsView: React.FC<{
  stage: GuideStage;
  stageName: string;
  tiers: StageTiers;
  tips: readonly GuideTip[];
  learned: ReadonlySet<string>;
  queued: PendingNudge | undefined;
  shownTier: ShownTier;
  onShowTip: (tip: GuideTip) => void;
}> = ({ stage, stageName, tiers, tips, learned, queued, shownTier, onShowTip }) => {
  // Show me asked for one stage's tips; a nudge waits for the next open instead of hiding them.
  const nudge = !shownTier && queued ? GUIDE_NUDGES.find((candidate) => candidate.id === queued.id) : undefined;
  const tipStage = shownTier?.stage ?? stage;
  const stageTips = tips.filter((tip) => tip.stage === tipStage);
  return (
    <>
      {nudge && (
        <ShownNudgePanel
          nudge={nudge}
          onTake={() => {
            nudge.primary?.run(queued?.key);
            resolveGuideNudge(nudge.id);
          }}
          onDismiss={() => resolveGuideNudge(nudge.id)}
          onMute={() => muteHintsLike(nudge.category)}
        />
      )}
      {(!nudge || nudge.stage === tipStage) && stageTips.length > 0 && (
        <GuideTips
          key={`${tipStage}:${shownTier?.tier ?? ""}`}
          stageName={STAGE_NAMES[tipStage]}
          tiers={tiers.get(tipStage) ?? []}
          tips={stageTips}
          learnedSignals={learned}
          initialTier={shownTier?.tier}
          onKnown={(tip) => useGuideStore.getState().learnSignal(tip.learnedBy)}
          onShow={onShowTip}
        />
      )}
      {!nudge && stageTips.length === 0 && (
        <p className="px-2.5 py-3 text-xs text-(--muted)">No tips for {stageName} yet.</p>
      )}
    </>
  );
};

type CardViewProps = GuideCardBodyProps & {
  learned: ReadonlySet<string>;
  shownTier: ShownTier;
  onShownTier: (shown: ShownTier) => void;
};

const CardView: React.FC<CardViewProps> = ({
  stage,
  stageName,
  tiers,
  tips,
  pending,
  focusNudgeId,
  milestone,
  showingRecord,
  learned,
  shownTier,
  onShownTier: setShownTier,
  onLeaveRecord,
  onMilestoneDone,
  onShowTip,
}) => {
  if (showingRecord) {
    return (
      <RecordView
        tiers={tiers}
        onOpenStage={(recordStage) => {
          setShownTier({ stage: recordStage });
          onLeaveRecord();
        }}
      />
    );
  }
  if (milestone) {
    return (
      <MilestoneView
        milestone={milestone}
        tips={tips}
        learned={learned}
        onContinue={(next) => {
          setShownTier({ stage: milestone.stage, tier: next });
          onMilestoneDone();
        }}
      />
    );
  }
  return (
    <TipsView
      stage={stage}
      stageName={stageName}
      tiers={tiers}
      tips={tips}
      learned={learned}
      queued={pending.find((candidate) => candidate.id === focusNudgeId) ?? pending[0]}
      shownTier={shownTier}
      onShowTip={onShowTip}
    />
  );
};

const GuideCardBody: React.FC<GuideCardBodyProps> = (props) => {
  const { stage, milestone, showingRecord } = props;
  const learnedSignals = useGuideStore((state) => state.learnedSignals);
  const learned = useMemo(() => new Set(learnedSignals), [learnedSignals]);
  const [shownTier, setShownTier] = useState<ShownTier>(null);
  const viewKey = showingRecord
    ? "record"
    : milestone
      ? `milestone:${milestone.stage}:${milestone.tier}`
      : `tips:${shownTier?.stage ?? stage}`;
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <m.div key={viewKey} variants={guideViewSwapVariants} initial="hidden" animate="shown" exit="exit">
        <CardView {...props} learned={learned} shownTier={shownTier} onShownTier={setShownTier} />
      </m.div>
    </AnimatePresence>
  );
};

// -- Exports ------------------------------------------------------------------

export { GuideCardBody };
