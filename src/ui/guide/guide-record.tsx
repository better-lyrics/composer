import { GUIDE_TIER_ORDER, type GuideStage, type GuideTierId, type TierStatus } from "@/domain/guide/model";
import { Medal } from "@/ui/guide/medal";
import { ProgressRing } from "@/ui/guide/progress-ring";

// -- Types --------------------------------------------------------------------

interface StageRecord {
  stage: GuideStage;
  name: string;
  tiers: readonly TierStatus[];
}

// -- Constants ----------------------------------------------------------------

const COLUMN_NAMES: Record<GuideTierId, string> = { basics: "Basics", further: "Further", pro: "Pro" };

// -- Components ---------------------------------------------------------------

// A tier you have started shows how far along it is as a ring around its medal.
const RecordCell: React.FC<{ status: TierStatus }> = ({ status }) => {
  const progress = partProgress(status);
  return (
    <span
      title={status.total > 0 ? `${status.learned} of ${status.total}` : undefined}
      className="relative flex size-10 items-center justify-center justify-self-center"
    >
      {progress !== null && <ProgressRing progress={progress} className="absolute inset-0 size-10" />}
      {status.total > 0 && <Medal tier={status.tier} state={status.state} size="sm" />}
    </span>
  );
};

function partProgress({ state, learned, total }: TierStatus): number | null {
  return state === "open" && learned > 0 ? learned / total : null;
}

const GuideRecord: React.FC<{ stages: readonly StageRecord[]; onOpenStage: (stage: GuideStage) => void }> = ({
  stages,
  onOpenStage,
}) => {
  const withTips = stages.flatMap((row) => row.tiers).filter((status) => status.total > 0);
  const earned = withTips.filter((status) => status.state === "earned").length;
  return (
    <div>
      <div className="flex items-baseline justify-between px-2.5 pb-2">
        <span className="text-[13px] font-semibold">Your record</span>
        <span className="text-xs text-(--muted) tabular-nums">
          {earned} of {withTips.length} medals
        </span>
      </div>
      <div className="grid grid-cols-[1fr_repeat(3,48px)] items-center gap-y-1 rounded-[14px] bg-(--layer-1) p-2.5">
        <span />
        {GUIDE_TIER_ORDER.map((tier) => (
          <span key={tier} className="pb-1 text-center text-[11px] text-(--muted)">
            {COLUMN_NAMES[tier]}
          </span>
        ))}
        {stages.map((row) => (
          <div key={row.stage} className="contents">
            <button
              type="button"
              onClick={() => onOpenStage(row.stage)}
              className="-mx-1.5 flex self-stretch cursor-pointer select-none items-center rounded-lg px-1.5 text-left text-[13px] transition-[background-color] duration-150 hover:bg-(--layer-2)"
            >
              {row.name}
            </button>
            {row.tiers.map((status) => (
              <RecordCell key={status.tier} status={status} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { GuideRecord };
