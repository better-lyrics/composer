import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { ToggleButton } from "@/ui/toggle-button";
import { cn } from "@/utils/cn";

// -- Interfaces ----------------------------------------------------------------

interface ShortcutToggleButtonProps {
  active: boolean;
  label: string;
  shortcut: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
  className?: string;
  stateInLabel?: boolean;
}

// -- Components ----------------------------------------------------------------

// A latch in a toolbar tray: icon, label and the shortcut badge from the registry.
const ShortcutToggleButton: React.FC<ShortcutToggleButtonProps> = ({
  active,
  label,
  shortcut,
  onClick,
  children,
  disabled,
  title,
  className,
  stateInLabel,
}) => {
  const showHints = useSettingsStore((s) => s.showShortcutHints);
  return (
    <ToggleButton
      pressed={active}
      stateInLabel={stateInLabel}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      hasIcon
      className={cn(
        "h-7 pl-2 text-[13px] [&>svg]:size-4 [&>[data-inline-key-badge]]:ml-0",
        showHints ? "pr-1.5" : "pr-2.5",
        className,
      )}
      title={title}
    >
      {children}
      <span>{label}</span>
      {showHints && <InlineKeyBadge keys={getEffectiveKeysArray(shortcut)} />}
    </ToggleButton>
  );
};

// -- Exports -------------------------------------------------------------------

export { ShortcutToggleButton };
