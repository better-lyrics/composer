import type { UnisonStatus } from "@/domain/unison/lyric-status";
import { StatusChip } from "@/ui/status-chip";
import { Tooltip } from "@/ui/tooltip";
import { cn } from "@/utils/cn";
import {
  type Icon,
  IconCircleCheck,
  IconCircleX,
  IconEyeOff,
  IconHourglassHigh,
  IconRosetteDiscountCheck,
  IconTrash,
} from "@tabler/icons-react";

// -- Types ---------------------------------------------------------------------

interface StatusChipStyle {
  tone: "positive" | "accent" | "error" | "warning";
  label: string;
  icon: Icon;
}

interface UnisonStatusChipProps {
  status: UnisonStatus;
  className?: string;
}

interface DescribedUnisonStatusChipProps extends UnisonStatusChipProps {
  detail?: React.ReactNode;
}

// -- Constants -----------------------------------------------------------------

const STATUS_CHIPS: Record<UnisonStatus, StatusChipStyle> = {
  live: { tone: "positive", label: "Live", icon: IconCircleCheck },
  sealed: { tone: "accent", label: "Sealed", icon: IconRosetteDiscountCheck },
  pending: { tone: "warning", label: "Edit in review", icon: IconHourglassHigh },
  declined: { tone: "error", label: "Edit declined", icon: IconCircleX },
  hidden: { tone: "error", label: "Hidden", icon: IconEyeOff },
  removed: { tone: "error", label: "Removed", icon: IconTrash },
};

const UNISON_STATUS_DESCRIPTIONS: Record<UnisonStatus, string> = {
  live: "Listeners see this version",
  sealed: "The council marked this as the reference version",
  pending: "Your edit waits for the council",
  declined: "The council declined your last edit",
  hidden: "Downvotes hid this version",
  removed: "This version is gone from Unison",
};

// -- Component -----------------------------------------------------------------

const UnisonStatusChip: React.FC<UnisonStatusChipProps> = ({ status, className }) => {
  const chip = STATUS_CHIPS[status];
  return (
    <StatusChip tone={chip.tone} icon={chip.icon} className={className}>
      {chip.label}
    </StatusChip>
  );
};

const DescribedUnisonStatusChip: React.FC<DescribedUnisonStatusChipProps> = ({ status, detail, className }) => (
  <Tooltip
    content={
      detail ? (
        <span className="flex flex-col gap-0.5">
          {UNISON_STATUS_DESCRIPTIONS[status]}
          {detail}
        </span>
      ) : (
        UNISON_STATUS_DESCRIPTIONS[status]
      )
    }
  >
    <span className={cn("inline-flex cursor-help", className)}>
      <UnisonStatusChip status={status} />
      <span className="sr-only">
        , {UNISON_STATUS_DESCRIPTIONS[status]}
        {detail && <>, {detail}</>}
      </span>
    </span>
  </Tooltip>
);

// -- Exports -------------------------------------------------------------------

export { DescribedUnisonStatusChip };
