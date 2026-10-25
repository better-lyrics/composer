import { Popover } from "@/ui/popover";
import { Scroll } from "@/ui/scroll";
import { cn } from "@/utils/cn";
import type { Placement } from "@floating-ui/react";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { type ReactElement, type ReactNode, cloneElement, useRef, useState } from "react";

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
  appearance?: SelectAppearance;
  renderOption?: (option: SelectOption) => ReactNode;
}

type SelectAppearance = "field" | "pick";

// -- Constants ----------------------------------------------------------------

const TRIGGER_STYLES: Record<SelectAppearance, string> = {
  field:
    "h-7 pl-2.5 pr-2 text-[13px] rounded-lg bg-(--well) text-composer-text border border-(--edge) hover:border-(--edge-strong) focus:outline-none disabled:hover:border-(--edge)",
  pick: "h-6 pl-2 pr-1.5 text-xs rounded-[7px] bg-(--layer-2) text-(--label) shadow-[inset_0_0_0_1px_var(--divider)] hover:shadow-[inset_0_0_0_1px_var(--lit-ring)] aria-expanded:shadow-[inset_0_0_0_1px_var(--lit-ring)] focus:outline-none",
};

const CHEVRON_STYLES: Record<SelectAppearance, string> = {
  field: "size-4 text-composer-text",
  pick: "size-[13px]",
};

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
  appearance = "field",
  renderOption,
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
        "inline-flex items-center justify-between gap-1.5 cursor-pointer transition-[color,background-color,border-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50",
        TRIGGER_STYLES[appearance],
        className,
      )}
    >
      <span className="flex items-center gap-1.5 truncate">
        {leadingColor && <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: leadingColor }} />}
        <span className={cn("truncate", showPlaceholder && appearance === "field" && "text-(--muted)")}>
          {triggerLabel}
        </span>
      </span>
      <IconChevronDown
        className={cn(
          "shrink-0 opacity-50 transition-[rotate,opacity] in-aria-expanded:rotate-180 in-aria-expanded:opacity-90",
          CHEVRON_STYLES[appearance],
        )}
      />
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
          <div role="listbox" aria-label={ariaLabel} className="flex flex-col p-1.5 w-max min-w-50 max-w-80">
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
                  data-active={index === activeIndex || undefined}
                  {...getItemProps({
                    onClick: () => {
                      onChange(option.value);
                      close();
                    },
                  })}
                  className={cn(
                    "flex items-center gap-2 w-full h-8.5 px-2 rounded-lg text-[13px] text-left transition-colors data-active:bg-(--layer-1) data-active:text-composer-text",
                    isSelected
                      ? "bg-(--layer-2) text-composer-text"
                      : "cursor-pointer text-(--label) hover:bg-(--layer-1) hover:text-composer-text",
                  )}
                >
                  <span className="flex flex-1 min-w-0">
                    {renderOption ? renderOption(option) : <span className="truncate">{option.label}</span>}
                  </span>
                  <IconCheck
                    aria-hidden={!isSelected}
                    className={cn("size-[15px] text-composer-accent-text shrink-0", !isSelected && "invisible")}
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
