import type { Placement } from "@floating-ui/react";
import { Popover } from "@/ui/popover";
import { cn } from "@/utils/cn";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";

// -- Interfaces ---------------------------------------------------------------

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  "aria-label"?: string;
  placement?: Placement;
  className?: string;
}

// -- Component ----------------------------------------------------------------

const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  placement = "bottom-end",
  className,
}) => {
  const selected = options.find((option) => option.value === value);

  return (
    <Popover
      placement={placement}
      trigger={
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          className={cn(
            "inline-flex items-center justify-between gap-1.5 h-7 pl-3 pr-2 text-sm rounded-lg cursor-pointer transition-colors bg-composer-input text-composer-text border border-composer-border hover:border-composer-accent focus:outline-none focus:border-composer-accent",
            className,
          )}
        >
          <span className="truncate">{selected?.label ?? value}</span>
          <IconChevronDown className="size-4 text-composer-text opacity-50 shrink-0" />
        </button>
      }
    >
      {(close) => (
        <div role="listbox" aria-label={ariaLabel} className="flex flex-col gap-0.5 p-1 w-max min-w-36">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
                className={cn(
                  "flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm text-left text-composer-text transition-colors",
                  isSelected ? "bg-composer-button font-medium" : "cursor-pointer hover:bg-composer-button",
                )}
              >
                <span className="flex-1">{option.label}</span>
                <IconCheck
                  aria-hidden={!isSelected}
                  className={cn("size-3.5 text-composer-accent shrink-0", !isSelected && "invisible")}
                />
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
};

// -- Exports ------------------------------------------------------------------

export { Select };
export type { SelectOption };
