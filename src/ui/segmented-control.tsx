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

type SegmentedControlSize = "md" | "sm";

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  "aria-label": string;
  size?: SegmentedControlSize;
  className?: string;
}

// -- Constants ----------------------------------------------------------------

const TRAY_SIZE_STYLES: Record<SegmentedControlSize, string> = {
  md: "",
  sm: "tray-compact",
};

const OPTION_SIZE_STYLES: Record<SegmentedControlSize, string> = {
  md: "h-7 px-3 text-[13px] rounded-lg",
  sm: "h-6 min-w-9 px-2 text-xs rounded-md tabular-nums",
};

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
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("tray select-none", TRAY_SIZE_STYLES[size], className)}>
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
              "inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-[color,background-color,box-shadow] cursor-pointer",
              OPTION_SIZE_STYLES[size],
              option.iconOnly && "w-7 px-0",
              "disabled:cursor-not-allowed disabled:text-composer-text-faint disabled:line-through",
              isSelected
                ? "latch-on [&_svg]:text-composer-accent-text"
                : "text-[var(--muted)] hover:text-[var(--label)] hover:bg-[var(--layer-1)]",
            )}
          >
            {OptionIcon && <OptionIcon aria-hidden="true" className="size-4 shrink-0" />}
            {!option.iconOnly && option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "text-xs tabular-nums",
                  isSelected ? "text-composer-accent-text" : "text-composer-text-faint",
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
