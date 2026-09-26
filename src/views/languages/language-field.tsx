import { INPUT_STYLES } from "@/ui/input-styles";
import { cn } from "@/utils/cn";
import { IconAlertCircle, IconAlertTriangle } from "@tabler/icons-react";
import { useId } from "react";

// -- Interfaces ---------------------------------------------------------------

interface LanguageFieldProps {
  label: string;
  ariaLabel?: string;
  value: string;
  placeholder?: string;
  status?: "review";
  error?: string | null;
  mono?: boolean;
  pasteKind?: "transliteration" | "translation";
  pasteLanguage?: string;
  action?: React.ReactNode;
  onChange: (value: string) => void;
}

// -- Component ----------------------------------------------------------------

const LanguageField: React.FC<LanguageFieldProps> = ({
  label,
  ariaLabel,
  value,
  placeholder,
  status,
  error,
  mono = false,
  pasteKind,
  pasteLanguage,
  action,
  onChange,
}) => {
  const inputId = useId();
  const errorId = useId();
  const tone = error ? "error" : status;

  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)_4.5rem] items-start gap-2">
      <label
        htmlFor={inputId}
        className={cn(
          "flex min-h-8 items-center gap-1 text-xs select-none",
          tone === "error"
            ? "text-composer-negative"
            : tone === "review"
              ? "text-composer-warning"
              : "text-composer-text-muted",
        )}
      >
        {tone === "error" && <IconAlertCircle aria-hidden="true" className="size-3 shrink-0" />}
        {tone === "review" && <IconAlertTriangle aria-hidden="true" className="size-3 shrink-0" />}
        {label}
      </label>
      <div className="flex min-w-0 flex-col gap-1">
        <input
          id={inputId}
          aria-label={ariaLabel}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          value={value}
          placeholder={placeholder}
          data-language-import-kind={pasteKind}
          data-language-import-language={pasteLanguage}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "w-full",
            INPUT_STYLES,
            mono && "font-mono",
            tone === "error" && "border-composer-error focus:border-composer-error",
            tone === "review" && "border-composer-warning/40",
          )}
        />
        {error && (
          <span id={errorId} role="alert" className="text-xs text-composer-error-text select-text cursor-text">
            {error}
          </span>
        )}
      </div>
      <div className="flex min-h-8 items-center">{action}</div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { LanguageField };
