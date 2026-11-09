import { GUIDE_TIER_ORDER, type GuideStage, type GuideTierId, type TierStatus } from "@/domain/guide/model";
import { Medal } from "@/ui/guide/medal";

// -- Types --------------------------------------------------------------------

interface StageRecord {
  stage: GuideStage;
  name: string;
  tiers: readonly TierStatus[];
}

// -- Constants ----------------------------------------------------------------

const COLUMN_NAMES: Record<GuideTierId, string> = { basics: "Basics", further: "Further", pro: "Pro" };

// -- Component ----------------------------------------------------------------

const GuideRecord: React.FC<{ stages: readonly StageRecord[] }> = ({ stages }) => {
  const withTips = stages.flatMap((row) => row.tiers).filter((status) => status.total > 0);
  const earned = withTips.filter((status) => status.state === "earned").length;
  return (
    <div className="px-1 pb-1">
      <div className="flex items-baseline justify-between px-1.5 pb-2">
        <span className="text-[13px] font-semibold">Your record</span>
        <span className="text-xs text-(--muted) tabular-nums">
          {earned} of {withTips.length} medals
        </span>
      </div>
      <div className="grid grid-cols-[1fr_repeat(3,48px)] items-center gap-y-1 rounded-xl bg-(--layer-1) p-2">
        <span />
        {GUIDE_TIER_ORDER.map((tier) => (
          <span key={tier} className="pb-1 text-center text-[11px] text-(--muted)">
            {COLUMN_NAMES[tier]}
          </span>
        ))}
        {stages.map((row) => (
          <div key={row.stage} className="contents">
            <span className="px-1.5 text-[13px]">{row.name}</span>
            {row.tiers.map((status) => (
              <span key={status.tier} className="flex justify-center">
                {status.total > 0 && <Medal tier={status.tier} state={status.state} size="sm" />}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { GuideRecord };
