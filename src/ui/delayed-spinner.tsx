import { useDelayedBusy } from "@/hooks/use-delayed-busy";
import { cn } from "@/utils/cn";
import { type Icon, IconLoader2 } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface DelayedSpinnerProps {
  busy: boolean;
  className?: string;
  icon?: Icon;
  idle?: React.ReactNode;
}

// -- Component ----------------------------------------------------------------

const DelayedSpinner: React.FC<DelayedSpinnerProps> = ({
  busy,
  className,
  icon: SpinIcon = IconLoader2,
  idle = null,
}) =>
  useDelayedBusy(busy) ? (
    <SpinIcon aria-hidden="true" className={cn("shrink-0 animate-spin motion-reduce:animate-none", className)} />
  ) : (
    idle
  );

// -- Exports ------------------------------------------------------------------

export { DelayedSpinner };
