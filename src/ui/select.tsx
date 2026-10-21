import type { Placement } from "@floating-ui/react";
import { Popover } from "@/ui/popover";
import { Scroll } from "@/ui/scroll";
import { cn } from "@/utils/cn";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { type ReactElement, cloneElement, useRef, useState } from "react";

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
  placeholder?: string;
  leadingColor?: string;
  placement?: Placement;
  className?: string;
  disabled?: boolean;
  trigger?: ReactElement<{ disabled?: boolean }>;
}

// -- Helpers ------------------------------------------------------------------

const focusTabStopOption = (viewport: HTMLDivElement) => {
  const option = viewport.querySelector<HTMLElement>('[role="option"][tabindex="0"]');
  option?.scrollIntoView({ block: "nearest" });
  option?.focus();
};

// -- Component ----------------------------------------------------------------

const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  placeholder,
  leadingColor,
  placement = "bottom-end",
  className,
  disabled = false,
  trigger,
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const listRef = useRef<Array<HTMLElement | null>>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];
  const tabStopIndex = activeIndex ?? (selected ? selectedIndex : 0);
  const showPlaceholder = !selected && placeholder !== undefined;
  const triggerLabel = selected?.label ?? placeholder ?? value;

  const triggerElement = (disabled && trigger ? cloneElement(trigger, { disabled }) : trigger) ?? (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-between gap-1.5 h-7 pl-3 pr-2 text-sm rounded-lg cursor-pointer transition-colors bg-composer-input text-composer-text border border-composer-border hover:border-composer-accent focus:outline-none focus:border-composer-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-composer-border",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 truncate">
        {leadingColor && <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: leadingColor }} />}
        <span className={cn("truncate", showPlaceholder && "text-composer-text-muted")}>{triggerLabel}</span>
      </span>
      <IconChevronDown className="size-4 text-composer-text opacity-50 shrink-0" />
    </button>
  );

  return (
    <Popover
      placement={placement}
      hasPopup="listbox"
      trigger={triggerElement}
      listNavigation={{
        listRef,
        activeIndex,
        selectedIndex: selected ? selectedIndex : null,
        onNavigate: setActiveIndex,
      }}
    >
      {(close, getItemProps) => (
        <Scroll className="max-h-80" onInitialized={focusTabStopOption}>
          {/* react-doctor-disable-next-line react-doctor/prefer-tag-over-role -- styled single-select popover; datalist is input autocomplete, not a listbox, and would reintroduce native chrome */}
          <div role="listbox" aria-label={ariaLabel} className="flex flex-col gap-0.5 p-1 w-max min-w-36">
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  ref={(node) => {
                    listRef.current[index] = node;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={index === tabStopIndex ? 0 : -1}
                  {...getItemProps({
                    onClick: () => {
                      onChange(option.value);
                      close();
                    },
                  })}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-sm text-left text-composer-text transition-colors",
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
        </Scroll>
      )}
    </Popover>
  );
};

// -- Exports ------------------------------------------------------------------

export { Select };
export type { SelectOption };
