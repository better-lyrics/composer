import { cn } from "@/utils/cn";

// -- Interfaces ---------------------------------------------------------------

interface RomanizationReferenceProps {
  text: string;
  isCurrent: boolean;
  className?: string;
}

// -- Component ----------------------------------------------------------------

const RomanizationReference: React.FC<RomanizationReferenceProps> = ({ text, isCurrent, className }) => {
  if (!text || text.trim().length === 0) return null;

  return (
    <span
      data-testid="romanization-reference"
      className={cn(
        "text-xs italic leading-tight select-text pointer-events-none",
        isCurrent ? "text-composer-accent-text opacity-90" : "text-composer-text-muted opacity-60",
        className,
      )}
    >
      {text}
    </span>
  );
};

// -- Exports ------------------------------------------------------------------

export { RomanizationReference };
export type { RomanizationReferenceProps };
