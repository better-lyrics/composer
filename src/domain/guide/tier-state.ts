import {
  GUIDE_TIER_ORDER,
  type GuideStage,
  type GuideTipEntry,
  type TierState,
  type TierStatus,
} from "@/domain/guide/model";

// -- Constants ----------------------------------------------------------------

const NEXT_TIER_OPENS_AT = 0.8;

// -- Derivations --------------------------------------------------------------

function stageTiers(
  tips: readonly GuideTipEntry[],
  stage: GuideStage,
  learned: ReadonlySet<string>,
  showAll: boolean,
): TierStatus[] {
  const counts = GUIDE_TIER_ORDER.map((tier) => {
    const inTier = tips.filter((entry) => entry.stage === stage && entry.tier === tier);
    return { tier, total: inTier.length, learned: inTier.filter((entry) => learned.has(entry.id)).length };
  });
  return counts.map((count, index) => ({ ...count, state: stateOf(counts, index, showAll) }));
}

function stateOf(counts: readonly Omit<TierStatus, "state">[], index: number, showAll: boolean): TierState {
  const { total, learned } = counts[index];
  if (total > 0 && learned === total) return "earned";
  if (index === 0 || showAll || learned > 0) return "open";
  const previous = counts[index - 1];
  return previous.total > 0 && previous.learned / previous.total >= NEXT_TIER_OPENS_AT ? "open" : "locked";
}

// -- Exports ------------------------------------------------------------------

export { stageTiers };
