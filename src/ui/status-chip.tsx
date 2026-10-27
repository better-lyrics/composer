import { cn } from "@/utils/cn";
import type { Icon } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

type StatusTone = "warning" | "error" | "positive" | "accent";

interface StatusChipProps {
  tone: StatusTone;
  icon?: Icon;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

// -- Constants ----------------------------------------------------------------

const TONE_STYLES: Record<StatusTone, string> = {
  warning: "bg-composer-warning/15 text-composer-warning",
  error: "bg-composer-error/25 text-composer-negative",
  positive: "bg-composer-positive/10 text-composer-positive",
  accent: "bg-composer-accent/15 text-composer-accent-text",
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
    role={ariaLabel ? "img" : undefined}
    data-tone={tone}
    className={cn(
      "inline-flex h-[18px] shrink-0 items-center gap-[3px] rounded-md text-[11px] font-semibold tabular-nums select-none",
      ToneIcon ? "pl-1 pr-[5px]" : "px-1.5",
      TONE_STYLES[tone],
      className,
    )}
  >
    {ToneIcon && <ToneIcon aria-hidden="true" className="size-3 shrink-0" />}
    {children}
  </span>
);

// -- Exports ------------------------------------------------------------------

export { StatusChip };
