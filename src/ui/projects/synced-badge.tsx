import { cn } from "@/utils/cn";
import { IconCircleCheck } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface SyncedBadgeProps {
  withLabel?: boolean;
  className?: string;
}

// -- Component ----------------------------------------------------------------

const SyncedBadge: React.FC<SyncedBadgeProps> = ({ withLabel = false, className }) => {
  if (withLabel) {
    return (
      <span className={cn("inline-flex items-center gap-1 font-medium text-composer-positive", className)}>
        <IconCircleCheck aria-hidden="true" className="size-[15px]" />
        Synced
      </span>
    );
  }
  return (
    <IconCircleCheck role="img" aria-label="Synced" className={cn("size-[18px] text-composer-positive", className)} />
  );
};

// -- Exports ------------------------------------------------------------------

export { SyncedBadge };
