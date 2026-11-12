import { cn } from "@/utils/cn";
import { useEffect, useRef } from "react";

// -- Types --------------------------------------------------------------------

interface FieldErrorProps {
  id: string;
  message: string | null;
  hint?: React.ReactNode;
  reserveLine?: boolean;
  className?: string;
}

// -- Component ----------------------------------------------------------------

// Always mounted so screen readers hear the message when it appears; an empty region takes no space.
const FieldError: React.FC<FieldErrorProps> = ({ id, message, hint, reserveLine = false, className }) => {
  const regionRef = useRef<HTMLSpanElement>(null);
  const shown = message !== null;
  const wasShownRef = useRef(shown);
  // Focus or typing keeps the field in view, but a message that just appeared below it can sit past a scroll edge.
  useEffect(() => {
    if (shown && !wasShownRef.current) regionRef.current?.scrollIntoView({ block: "nearest" });
    wasShownRef.current = shown;
  }, [shown]);
  return (
    <span
      ref={regionRef}
      id={id}
      aria-live="polite"
      className={cn(
        "block text-xs text-pretty scroll-mb-4",
        reserveLine ? "min-h-4" : "empty:sr-only",
        shown ? "text-composer-negative select-text cursor-text" : "text-composer-text-muted select-none",
        className,
      )}
    >
      {message ?? hint}
    </span>
  );
};

// -- Exports ------------------------------------------------------------------

export { FieldError };
