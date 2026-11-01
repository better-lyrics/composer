import { Popover } from "@/ui/popover";
import { Scroll } from "@/ui/scroll";
import { StatusChip } from "@/ui/status-chip";
import { cn } from "@/utils/cn";
import type { Placement } from "@floating-ui/react";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { type ReactElement, type ReactNode, cloneElement, useRef, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface SelectOption {
  value: string;
  label: string;
  /** A second line under the label. Options with one wrap instead of truncating. */
  detail?: string;
  /** A short tag after the label, such as "Recommended". */
  badge?: string;
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
  /** Controls above the list, such as filter tabs. */
  header?: ReactNode;
  /** Shown on the trigger after the label, such as a status chip. */
  triggerAdornment?: ReactNode;
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

interface FieldTriggerOptions {
  label: string;
  /** Shown on hover when the label may be cut short. */
  title?: string;
  muted: boolean;
  appearance: SelectAppearance;
  ariaLabel?: string;
  disabled: boolean;
  leadingColor?: string;
  className?: string;
  triggerAdornment?: ReactNode;
}

// A plain element, not a component: the Popover clones its trigger to attach a ref and handlers.
const fieldTrigger = ({
  label,
  title,
  muted,
  appearance,
  ariaLabel,
  disabled,
  leadingColor,
  className,
  triggerAdornment,
}: FieldTriggerOptions) => (
  <button
    type="button"
    aria-label={ariaLabel}
    title={title}
    disabled={disabled}
    className={cn(
      "inline-flex items-center justify-between gap-1.5 cursor-pointer transition-[color,background-color,border-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50",
      TRIGGER_STYLES[appearance],
      className,
    )}
  >
    <span className="flex items-center gap-1.5 truncate">
      {leadingColor && <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: leadingColor }} />}
      <span className={cn("truncate", muted && appearance === "field" && "text-(--muted)")}>{label}</span>
    </span>
    {triggerAdornment}
    <IconChevronDown
      className={cn(
        "shrink-0 opacity-50 transition-[rotate,opacity] in-aria-expanded:rotate-180 in-aria-expanded:opacity-90",
        CHEVRON_STYLES[appearance],
      )}
    />
  </button>
);

// -- Components ---------------------------------------------------------------

const OptionLabel: React.FC<{ option: SelectOption }> = ({ option }) =>
  option.detail ? (
    <span className="flex flex-col gap-0.5 min-w-0">
      <span className="text-pretty">
        {option.label}
        {option.badge && (
          <StatusChip tone="accent" className="ml-1.5 align-[1px]">
            {option.badge}
          </StatusChip>
        )}
      </span>
      <span className="text-xs text-(--muted) tabular-nums">{option.detail}</span>
    </span>
  ) : (
    <span className="truncate">{option.label}</span>
  );

interface OptionRowProps {
  option: SelectOption;
  selected: boolean;
  tabStop: boolean;
  active: boolean;
  itemRef: (node: HTMLButtonElement | null) => void;
  itemProps: Record<string, unknown>;
  renderOption?: (option: SelectOption) => ReactNode;
}

const OptionRow: React.FC<OptionRowProps> = ({
  option,
  selected,
  tabStop,
  active,
  itemRef,
  itemProps,
  renderOption,
}) => (
  <button
    ref={itemRef}
    type="button"
    role="option"
    aria-selected={selected}
    tabIndex={tabStop ? 0 : -1}
    data-active={active || undefined}
    {...itemProps}
    className={cn(
      "flex items-center gap-2 w-full px-2 rounded-lg text-[13px] text-left transition-colors data-active:bg-(--layer-1) data-active:text-composer-text",
      option.detail ? "min-h-8.5 py-1.5" : "h-8.5",
      selected
        ? "bg-(--layer-2) text-composer-text"
        : "cursor-pointer text-(--label) hover:bg-(--layer-1) hover:text-composer-text",
    )}
  >
    <span className="flex flex-1 min-w-0">{renderOption ? renderOption(option) : <OptionLabel option={option} />}</span>
    <IconCheck
      aria-hidden={!selected}
      className={cn("size-[15px] text-composer-accent-text shrink-0", !selected && "invisible")}
    />
  </button>
);

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
  header,
  triggerAdornment,
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const listRef = useRef<Array<HTMLElement | null>>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];
  const tabStopIndex = activeIndex ?? (selected ? selectedIndex : 0);
  const showPlaceholder = !selected && placeholder !== undefined;
  const triggerLabel = selected?.label ?? placeholder ?? value;

  const triggerElement =
    (disabled && trigger ? cloneElement(trigger, { disabled }) : trigger) ??
    fieldTrigger({
      label: triggerLabel,
      title: selected?.detail ? triggerLabel : undefined,
      muted: showPlaceholder,
      appearance,
      ariaLabel,
      disabled,
      leadingColor,
      className,
      triggerAdornment,
    });

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
        <>
          {header}
          <Scroll className="max-h-80" onInitialized={focusTabStopOption}>
            {/* react-doctor-disable-next-line react-doctor/prefer-tag-over-role -- styled single-select popover; datalist is input autocomplete, not a listbox, and would reintroduce native chrome */}
            <div role="listbox" aria-label={ariaLabel} className="flex flex-col p-1.5 w-max min-w-50 max-w-80">
              {options.map((option, index) => (
                <OptionRow
                  key={option.value}
                  option={option}
                  selected={option.value === value}
                  tabStop={index === tabStopIndex}
                  active={index === activeIndex}
                  itemRef={(node) => {
                    listRef.current[index] = node;
                  }}
                  itemProps={getItemProps({
                    onClick: () => {
                      onChange(option.value);
                      close();
                    },
                  })}
                  renderOption={renderOption}
                />
              ))}
            </div>
          </Scroll>
        </>
      )}
    </Popover>
  );
};

// -- Exports ------------------------------------------------------------------

export { Select };
export type { SelectOption };
