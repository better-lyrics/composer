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
    <span className="truncate">{children}</span>
  </span>
);

// -- Exports -------------------------------------------------------------------

export { SingerTag };
