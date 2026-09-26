import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  "aria-label": string;
  className?: string;
}

// -- Component ----------------------------------------------------------------

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex h-8 rounded-lg bg-composer-bg-elevated p-0.5 select-none", className)}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              "px-3 text-sm rounded-md transition-colors cursor-pointer",
              isSelected
                ? "bg-composer-button text-composer-text"
                : "text-composer-text-muted hover:text-composer-text",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// -- Exports ------------------------------------------------------------------

export { SegmentedControl };
