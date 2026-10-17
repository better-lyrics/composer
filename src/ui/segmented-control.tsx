import { cn } from "@/utils/cn";
import type { Icon } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: Icon;
  count?: number;
  iconOnly?: boolean;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  "aria-label": string;
  className?: string;
}

// -- Helpers ------------------------------------------------------------------

function optionName<T extends string>(option: SegmentedOption<T>): string | undefined {
  if (option.count !== undefined) return `${option.label} ${option.count}`;
  return option.iconOnly ? option.label : undefined;
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
        const OptionIcon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            aria-label={optionName(option)}
            title={option.iconOnly ? option.label : undefined}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 px-3 text-sm rounded-md whitespace-nowrap transition-colors cursor-pointer",
              option.iconOnly && "w-8 px-0",
              "disabled:cursor-not-allowed disabled:text-composer-text-faint disabled:line-through",
              isSelected
                ? "bg-composer-button text-composer-text"
                : "text-composer-text-muted hover:text-composer-text",
            )}
          >
            {OptionIcon && <OptionIcon aria-hidden="true" className="size-4 shrink-0" />}
            {!option.iconOnly && option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "text-xs tabular-nums",
                  isSelected ? "text-composer-text-secondary" : "text-composer-text-muted",
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// -- Exports ------------------------------------------------------------------

export { SegmentedControl };
export type { SegmentedOption };
