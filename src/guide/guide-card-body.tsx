import { GUIDE_TIER_ORDER, type GuideStage, type GuideTierId } from "@/domain/guide/model";
import { STAGE_NAMES } from "@/guide/catalog/journey";
import { GUIDE_NUDGES } from "@/guide/catalog/nudges";
import type { GuideTip } from "@/guide/catalog/types";
import type { EarnedTier, StageTiers } from "@/guide/use-guide-feed";
import { type PendingNudge, resolveGuideNudge } from "@/lib/guide-signals";
import { useGuideStore } from "@/stores/guide";
import { GuideRecord } from "@/ui/guide/guide-record";
import { GuideTips } from "@/ui/guide/guide-tips";
import { Milestone } from "@/ui/guide/milestone";
import { NudgePanel } from "@/ui/guide/nudge-panel";
import { useMemo, useState } from "react";

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
  onMilestoneDone: () => void;
}

// -- Component ----------------------------------------------------------------

const GuideCardBody: React.FC<GuideCardBodyProps> = ({
  stage,
  stageName,
  tiers,
  tips,
  pending,
  focusNudgeId,
  milestone,
  showingRecord,
  onMilestoneDone,
}) => {
  const learnedSignals = useGuideStore((state) => state.learnedSignals);
  const learned = useMemo(() => new Set(learnedSignals), [learnedSignals]);
  const [shownTier, setShownTier] = useState<{ stage: GuideStage; tier?: GuideTierId } | null>(null);

  if (showingRecord) {
    const stages = [...tiers].map(([recordStage, statuses]) => ({
      stage: recordStage,
      name: STAGE_NAMES[recordStage],
      tiers: statuses,
    }));
    return <GuideRecord stages={stages.filter((row) => row.tiers.some((status) => status.total > 0))} />;
  }

  if (milestone) {
    const count = (tier: GuideTierId) =>
      tips.filter((tip) => tip.stage === milestone.stage && tip.tier === tier).length;
    const next = GUIDE_TIER_ORDER.slice(GUIDE_TIER_ORDER.indexOf(milestone.tier) + 1).find((tier) => count(tier) > 0);
    return (
      <Milestone
        stageName={STAGE_NAMES[milestone.stage]}
        tier={milestone.tier}
        tipCount={count(milestone.tier)}
        next={next ? { tier: next, tipCount: count(next) } : null}
        onContinue={() => {
          setShownTier({ stage: milestone.stage, tier: next });
          onMilestoneDone();
        }}
      />
    );
  }

  const queued = pending.find((candidate) => candidate.id === focusNudgeId) ?? pending[0];
  // Show me asked for one stage's tips; a nudge waits for the next open instead of hiding them.
  const nudge = !shownTier && queued ? GUIDE_NUDGES.find((candidate) => candidate.id === queued.id) : undefined;
  const tipStage = shownTier?.stage ?? stage;
  const stageTips = tips.filter((tip) => tip.stage === tipStage);
  return (
    <>
      {nudge && (
        <NudgePanel
          nudge={nudge}
          onTake={() => {
            nudge.primary?.run(queued.key);
            resolveGuideNudge(nudge.id);
          }}
          onDismiss={() => resolveGuideNudge(nudge.id)}
          onMute={() => {
            useGuideStore.getState().muteCategory(nudge.category);
            resolveGuideNudge(nudge.id);
          }}
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
        />
      )}
      {!nudge && stageTips.length === 0 && (
        <p className="px-2.5 py-3 text-xs text-(--muted)">No tips for {stageName} yet.</p>
      )}
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { GuideCardBody };
