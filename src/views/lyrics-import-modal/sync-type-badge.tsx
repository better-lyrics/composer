import type { SyncType } from "@/domain/lyrics-search/sync-type";
import { SYNC_TYPE_VARIANTS, SyncTypeIcon } from "@/ui/sync-type-icon";
import { Tooltip } from "@/ui/tooltip";
import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

interface SyncTypeBadgeProps {
  syncType: SyncType;
  sourceLabel: string;
}

// -- Component ----------------------------------------------------------------

const SyncTypeBadge: React.FC<SyncTypeBadgeProps> = ({ syncType, sourceLabel }) => {
  const variant = SYNC_TYPE_VARIANTS[syncType];
  return (
    <Tooltip content={`${variant.label} sync`}>
      <span
        data-sync-type={syncType}
        className={cn(
          "inline-flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide cursor-help shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]",
          variant.colorClasses,
        )}
      >
        <SyncTypeIcon syncType={syncType} className="shrink-0" />
        <span>{sourceLabel}</span>
        <span className="sr-only">{variant.label}</span>
      </span>
    </Tooltip>
  );
};

// -- Exports ------------------------------------------------------------------

export { SyncTypeBadge };
export type { SyncTypeBadgeProps };
