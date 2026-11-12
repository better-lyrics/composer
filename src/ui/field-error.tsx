import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

interface FieldErrorProps {
  id: string;
  message: string | null;
  className?: string;
}

// -- Component ----------------------------------------------------------------

const FieldError: React.FC<FieldErrorProps> = ({ id, message, className }) =>
  message === null ? null : (
    <span id={id} role="alert" className={cn("text-xs text-composer-error-text select-text cursor-text", className)}>
      {message}
    </span>
  );

// -- Exports ------------------------------------------------------------------

export { FieldError };
