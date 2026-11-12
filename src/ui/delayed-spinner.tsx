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
}) => {
  const shown = useDelayedBusy(busy);
  if (shown) {
    return (
      <SpinIcon aria-hidden="true" className={cn("shrink-0 animate-spin motion-reduce:animate-none", className)} />
    );
  }
  // Holds the spinner's box during the delay so the label beside it does not move when it appears.
  if (busy && idle === null) return <span aria-hidden="true" className={cn("inline-block shrink-0", className)} />;
  return idle;
};

// -- Exports ------------------------------------------------------------------

export { DelayedSpinner };
