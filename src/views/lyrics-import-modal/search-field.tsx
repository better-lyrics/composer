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
    <div className={cn("flex flex-col gap-1.5 select-none", fullWidth && "col-span-2")}>
      <label
        htmlFor={inputId}
        className="text-[11px] font-medium tracking-wide text-composer-text-muted px-0.5"
      >
        {label}
        {optional ? <span className="opacity-70"> ・ optional</span> : null}
      </label>
      <div className="flex items-center gap-2 px-3 py-2.5 bg-composer-input border border-composer-border rounded-lg transition-colors focus-within:border-composer-accent">
        <span className="text-composer-text opacity-50 shrink-0" aria-hidden="true">
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
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { SearchField };
export type { SearchFieldProps };
