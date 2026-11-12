import { disableShortcut } from "@/lib/disabled-shortcuts";
import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { ShortcutTip } from "@/ui/shortcut-tip";
import { ToggleButton } from "@/ui/toggle-button";
import { Tooltip } from "@/ui/tooltip";
import { unavailableProps } from "@/ui/unavailable-props";
import { cn } from "@/utils/cn";
import { useEffect } from "react";

// -- Interfaces ----------------------------------------------------------------

interface ShortcutToggleButtonProps {
  active: boolean;
  label: string;
  shortcut: string;
  onClick: () => void;
  children: React.ReactNode;
  /** Makes the latch unavailable; the tooltip and a press of its shortcut say why. */
  disabledReason?: string;
  description?: string;
  className?: string;
  stateInLabel?: boolean;
  iconOnly?: boolean;
}

// -- Components ----------------------------------------------------------------

// A latch in a toolbar tray: icon, label and the shortcut badge from the registry.
const ShortcutToggleButton: React.FC<ShortcutToggleButtonProps> = ({
  active,
  label,
  shortcut,
  onClick,
  children,
  disabledReason,
  description,
  className,
  stateInLabel,
  iconOnly,
}) => {
  const showHints = useSettingsStore((s) => s.showShortcutHints);
  useEffect(
    () => (disabledReason === undefined ? undefined : disableShortcut(shortcut, disabledReason)),
    [disabledReason, shortcut],
  );
  return (
    <Tooltip
      content={<ShortcutTip label={label} shortcut={shortcut} description={disabledReason ?? description} />}
      placement="bottom"
    >
      <ToggleButton
        pressed={active}
        stateInLabel={stateInLabel}
        size="sm"
        onClick={onClick}
        {...unavailableProps(disabledReason)}
        hasIcon
        aria-label={iconOnly ? label : undefined}
        className={cn(
          "h-7 text-[13px] [&>svg]:size-4 [&>[data-inline-key-badge]]:ml-0",
          iconOnly ? "min-w-7 gap-1 px-1.5" : cn("pl-2", showHints ? "pr-1.5" : "pr-2.5"),
          className,
        )}
      >
        {children}
        {!iconOnly && <span>{label}</span>}
        {showHints && <InlineKeyBadge keys={getEffectiveKeysArray(shortcut)} />}
      </ToggleButton>
    </Tooltip>
  );
};

// -- Exports -------------------------------------------------------------------

export { ShortcutToggleButton };
