import { cn } from "@/utils/cn";
import { m } from "motion/react";

// -- Interfaces ----------------------------------------------------------------

interface FloatingChipProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

// -- Components ----------------------------------------------------------------

const FloatingChip: React.FC<FloatingChipProps> = ({ icon, className, children, ...rest }) => (
  <div
    className={cn(
      "surface-floating layer-floating pointer-events-none fixed flex h-8 items-center gap-2 rounded-full border border-transparent pr-3 pl-1.5 text-xs whitespace-nowrap select-none",
      className,
    )}
    {...rest}
  >
    {icon && (
      <span className="relative flex size-5 shrink-0 items-center justify-center rounded-full bg-(--layer-2)">
        {icon}
      </span>
    )}
    {children}
  </div>
);

const MotionFloatingChip = m.create(FloatingChip);

// -- Exports -------------------------------------------------------------------

export { FloatingChip, MotionFloatingChip };
