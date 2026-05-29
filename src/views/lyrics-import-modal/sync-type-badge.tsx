import type { SyncType } from "@/domain/lyrics-search/sync-type";
import { cn } from "@/utils/cn";
import { IconCheck } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface SyncTypeBadgeProps {
  syncType: SyncType;
}

// -- Constants ----------------------------------------------------------------

const BADGE_LABELS: Record<SyncType, string> = {
  syllable: "Syllable",
  word: "Word",
  line: "Line",
  unsynced: "Unsynced",
};

const BASE_STYLES =
  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide border";

const VARIANT_STYLES: Record<SyncType, string> = {
  syllable: "bg-composer-accent/24 text-composer-accent-text border-composer-accent/45",
  word: "bg-composer-accent/16 text-composer-accent-text border-composer-accent/34",
  line: "bg-composer-accent/12 text-composer-accent-text border-composer-accent/25",
  unsynced: "bg-white/4 text-composer-text-muted border-composer-border",
};

// -- Component ----------------------------------------------------------------

const SyncTypeBadge: React.FC<SyncTypeBadgeProps> = ({ syncType }) => {
  const label = BADGE_LABELS[syncType];
  const showCheck = syncType !== "unsynced";
  return (
    <span className={cn(BASE_STYLES, VARIANT_STYLES[syncType])} data-sync-type={syncType}>
      {showCheck ? <IconCheck size={9} aria-hidden="true" className="opacity-85" /> : null}
      {label}
    </span>
  );
};

// -- Exports ------------------------------------------------------------------

export { SyncTypeBadge };
export type { SyncTypeBadgeProps };
