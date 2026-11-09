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
      "flex min-w-0 cursor-pointer select-none flex-col gap-2 rounded-xl p-2.5 text-left transition-[background-color,box-shadow,scale] duration-150 ease-out active:scale-[0.96]",
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
    <ProgressBar
      percent={status.total === 0 || status.state === "locked" ? 0 : (status.learned / status.total) * 100}
      segments={Math.max(1, status.total)}
      complete={status.state === "earned"}
      label={`${GUIDE_TIER_NAMES[status.tier]} progress`}
      className="h-1.5"
    />
  </button>
);

const TierTiles: React.FC<TierTilesProps> = ({ tiers, selected, onSelect }) => (
  <div className="grid grid-cols-3 gap-1">
    {tiers.map((status) => (
      <TierTile
        key={status.tier}
        status={status}
        selected={status.tier === selected}
        onSelect={() => onSelect(status.tier)}
      />
    ))}
  </div>
);

// -- Exports ------------------------------------------------------------------

export { TierTiles };
