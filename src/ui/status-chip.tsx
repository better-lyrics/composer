import { cn } from "@/utils/cn";
import type { Icon } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

type StatusTone = "warning" | "error" | "positive";

interface StatusChipProps {
  tone: StatusTone;
  icon: Icon;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

// -- Constants ----------------------------------------------------------------

const TONE_STYLES: Record<StatusTone, string> = {
  warning: "bg-composer-warning/15 text-composer-warning",
  error: "bg-composer-error/25 text-composer-negative",
  positive: "bg-composer-positive/10 text-composer-positive",
};

// -- Component ----------------------------------------------------------------

const StatusChip: React.FC<StatusChipProps> = ({
  tone,
  icon: ToneIcon,
  children,
  className,
  "aria-label": ariaLabel,
}) => (
  <span
    aria-label={ariaLabel}
    data-tone={tone}
    className={cn(
      "inline-flex h-5 shrink-0 items-center gap-1 rounded-md pl-1 pr-1.5 text-[11px] font-medium tabular-nums select-none",
      TONE_STYLES[tone],
      className,
    )}
  >
    <ToneIcon aria-hidden="true" className="size-3 shrink-0" />
    {children}
  </span>
);

// -- Exports ------------------------------------------------------------------

export { StatusChip };
export type { StatusTone };
