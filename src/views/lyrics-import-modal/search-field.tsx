import { useMemo } from "react";
import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

interface SearchFieldProps {
  label: string;
  optional?: boolean;
  mono?: boolean;
  fullWidth?: boolean;
  icon: React.ReactNode;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
}

// -- Component ----------------------------------------------------------------

const SearchField: React.FC<SearchFieldProps> = ({
  label,
  optional,
  mono,
  fullWidth,
  icon,
  value,
  placeholder,
  onChange,
  onBlur,
  inputRef,
}) => {
  const inputId = useMemo(() => `field-${label.toLowerCase().replace(/\s+/g, "-")}`, [label]);
  return (
    <label
      htmlFor={inputId}
      className={cn(
        "relative flex items-center gap-2 px-3 py-2.5 bg-composer-input border border-composer-border rounded-lg transition-colors focus-within:border-composer-accent",
        fullWidth && "col-span-2",
      )}
    >
      <span className="absolute -top-1.5 left-2 px-1 bg-composer-bg-dark text-[10px] font-medium tracking-wide text-composer-text-muted">
        {label}
        {optional ? <span className="opacity-70"> ・ optional</span> : null}
      </span>
      <span className="text-composer-text-muted shrink-0" aria-hidden="true">
        {icon}
      </span>
      <input
        id={inputId}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={cn(
          "flex-1 min-w-0 bg-transparent border-0 outline-none text-composer-text placeholder:text-composer-text-muted",
          mono ? "font-mono text-xs tracking-tight" : "text-sm",
        )}
      />
    </label>
  );
};

// -- Exports ------------------------------------------------------------------

export { SearchField };
export type { SearchFieldProps };
