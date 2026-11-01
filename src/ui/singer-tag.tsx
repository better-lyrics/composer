import { cn } from "@/utils/cn";

// -- Interfaces ----------------------------------------------------------------

interface SingerTagProps {
  color: string;
  children: React.ReactNode;
  className?: string;
}

// -- Components ----------------------------------------------------------------

const SingerTag: React.FC<SingerTagProps> = ({ color, children, className }) => (
  <span
    className={cn("singer-tag", className)}
    style={{ "--agent": color }}
    title={typeof children === "string" ? children : undefined}
  >
    {/* The tag sets line-height 1, so truncate would clip descenders; the padding widens the clip, the margin keeps layout. */}
    <span className="-my-0.5 truncate py-0.5">{children}</span>
  </span>
);

// -- Exports -------------------------------------------------------------------

export { SingerTag };
