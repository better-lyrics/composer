import type { GuideTierId, TierStatus } from "@/domain/guide/model";
import { GUIDE_TIER_NAMES } from "@/guide/catalog/types";
import { Medal } from "@/ui/guide/medal";
import { ProgressBar } from "@/ui/progress-bar";
import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

interface TierTilesProps {
  tiers: readonly TierStatus[];
  selected: GuideTierId;
  onSelect: (tier: GuideTierId) => void;
}

// -- Helpers ------------------------------------------------------------------

function tierCount({ state, learned, total }: TierStatus): string {
  if (state === "locked") return "Later";
  return state === "earned" ? "Done" : `${learned} of ${total}`;
}

// -- Components ---------------------------------------------------------------

const TierProgress: React.FC<{ status: TierStatus; className?: string }> = ({ status, className }) => (
  <ProgressBar
    percent={status.total === 0 || status.state === "locked" ? 0 : (status.learned / status.total) * 100}
    segments={Math.max(1, status.total)}
    complete={status.state === "earned"}
    label={`${GUIDE_TIER_NAMES[status.tier]} progress`}
    className={cn("h-1.5", className)}
  />
);

const TierTile: React.FC<{ status: TierStatus; selected: boolean; onSelect: () => void }> = ({
  status,
  selected,
  onSelect,
}) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onSelect}
    className={cn(
      "flex min-w-0 cursor-pointer select-none flex-col gap-2 rounded-[14px] p-2.5 text-left transition-[background-color,box-shadow,scale] duration-150 ease-out active:scale-[0.96]",
      selected ? "bg-(--layer-2) shadow-[inset_0_0_0_1px_var(--lit-ring)]" : "hover:bg-(--layer-1)",
    )}
  >
    <span className="flex items-center justify-between">
      <Medal tier={status.tier} state={status.state} size="sm" />
      <span className="text-[11px] text-(--muted) tabular-nums">{tierCount(status)}</span>
    </span>
    <span className={cn("truncate text-[13px] font-medium", status.state === "locked" && "text-(--muted)")}>
      {GUIDE_TIER_NAMES[status.tier]}
    </span>
    <TierProgress status={status} />
  </button>
);

// One tier leaves nothing to choose, so it reads as a summary row rather than a tab.
const TierSummary: React.FC<{ status: TierStatus }> = ({ status }) => (
  <div className="flex items-center gap-3 px-2.5 py-1">
    <Medal tier={status.tier} state={status.state} size="sm" />
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium">{GUIDE_TIER_NAMES[status.tier]}</span>
        <span className="text-[11px] text-(--muted) tabular-nums">{tierCount(status)}</span>
      </div>
      <TierProgress status={status} className="mt-1.5" />
    </div>
  </div>
);

const TierTiles: React.FC<TierTilesProps> = ({ tiers, selected, onSelect }) => {
  const shown = tiers.filter((status) => status.total > 0);
  if (shown.length === 1) return <TierSummary status={shown[0]} />;
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1">
      {shown.map((status) => (
        <TierTile
          key={status.tier}
          status={status}
          selected={status.tier === selected}
          onSelect={() => onSelect(status.tier)}
        />
      ))}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { TierTiles };
