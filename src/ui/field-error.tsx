import { cn } from "@/utils/cn";

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
const FieldError: React.FC<FieldErrorProps> = ({ id, message, hint, reserveLine = false, className }) => (
  <span
    id={id}
    aria-live="polite"
    className={cn(
      "block text-xs text-pretty",
      reserveLine ? "min-h-4" : "empty:sr-only",
      message === null ? "text-composer-text-muted select-none" : "text-composer-negative select-text cursor-text",
      className,
    )}
  >
    {message ?? hint}
  </span>
);

// -- Exports ------------------------------------------------------------------

export { FieldError };
