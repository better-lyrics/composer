import { GUIDE_TIER_ORDER, type GuideTierId, type TierStatus } from "@/domain/guide/model";
import { GUIDE_TIER_NAMES, type GuideTip } from "@/guide/catalog/types";
import { TierTiles } from "@/ui/guide/tier-tiles";
import { TipList } from "@/ui/guide/tip-list";
import { useState } from "react";

// -- Types --------------------------------------------------------------------

interface GuideTipsProps {
  stageName: string;
  tiers: readonly TierStatus[];
  tips: readonly GuideTip[];
  learnedSignals: ReadonlySet<string>;
  initialTier?: GuideTierId;
  onKnown: (tip: GuideTip) => void;
}

// -- Helpers ------------------------------------------------------------------

function firstTierToWorkOn(tiers: readonly TierStatus[]): GuideTierId {
  return tiers.find((status) => status.state === "open")?.tier ?? "basics";
}

// -- Component ----------------------------------------------------------------

const GuideTips: React.FC<GuideTipsProps> = ({ stageName, tiers, tips, learnedSignals, initialTier, onKnown }) => {
  const [selected, setSelected] = useState<GuideTierId>(() => initialTier ?? firstTierToWorkOn(tiers));
  const status = tiers.find((candidate) => candidate.tier === selected);
  const inTier = tips.filter((tip) => tip.tier === selected);
  const previous = GUIDE_TIER_ORDER[GUIDE_TIER_ORDER.indexOf(selected) - 1];
  return (
    <>
      <h3 className="px-2.5 pb-1 text-xs font-medium text-(--muted)">{stageName} tips</h3>
      <TierTiles tiers={tiers} selected={selected} onSelect={setSelected} />
      {status?.state === "locked" && previous ? (
        <p className="px-2.5 py-3 text-xs text-pretty text-(--muted)">
          Opens once you know most of {GUIDE_TIER_NAMES[previous]}, or as soon as you try one of these on your own.
        </p>
      ) : (
        <TipList
          open={inTier.filter((tip) => !learnedSignals.has(tip.learnedBy))}
          learned={inTier.filter((tip) => learnedSignals.has(tip.learnedBy))}
          onKnown={onKnown}
        />
      )}
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { GuideTips };
