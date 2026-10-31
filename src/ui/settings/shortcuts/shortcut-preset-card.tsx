import { useMemo } from "react";
import { ownChanges, presetChanges } from "@/stores/shortcut-preset-changes";
import type { ShortcutPreset } from "@/stores/shortcut-presets";
import type { ShortcutBinding } from "@/stores/shortcut-registry";
import { CARD_ACTIVE, CARD_BASE, CARD_INACTIVE } from "@/ui/settings/preset-card-styles";
import { ShortcutChangesPopover } from "@/ui/settings/shortcuts/shortcut-changes-popover";
import { switchShortcutPreset } from "@/ui/settings/shortcuts/switch-shortcut-preset";
import { cn } from "@/utils/cn";

// -- Interfaces ----------------------------------------------------------------

interface ShortcutPresetCardProps {
  preset: ShortcutPreset;
  active: boolean;
  overrides: Record<string, ShortcutBinding>;
}

// -- Components ----------------------------------------------------------------

const ShortcutPresetCard: React.FC<ShortcutPresetCardProps> = ({ preset, active, overrides }) => {
  const changes = useMemo(() => presetChanges(preset.id), [preset.id]);
  const yours = useMemo(() => (active ? ownChanges(preset.id, overrides) : []), [active, preset.id, overrides]);

  return (
    <div className="relative flex">
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={() => void switchShortcutPreset(preset.id)}
        className={cn(CARD_BASE, "flex-1 px-3 pb-10", active ? CARD_ACTIVE : CARD_INACTIVE)}
      >
        <span className="text-[13px] font-bold text-composer-text">{preset.name}</span>
        <span className="mt-0.5 text-[11.5px] leading-[1.4] text-(--muted) text-pretty">{preset.description}</span>
      </button>
      <span className="absolute left-1.5 bottom-1.5">
        {changes.length === 0 && yours.length === 0 ? (
          <span className="flex h-6 items-center px-1.5 text-[11.5px] text-(--muted) select-none">Default</span>
        ) : (
          <ShortcutChangesPopover preset={preset} active={active} presetChanges={changes} yours={yours} />
        )}
      </span>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ShortcutPresetCard };
