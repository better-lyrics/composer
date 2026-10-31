import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { SHORTCUT_PRESETS } from "@/stores/shortcut-presets";
import { CARD_GROUP_LABEL } from "@/ui/settings/preset-card-styles";
import { CopyShortcutCodeButton } from "@/ui/settings/shortcuts/copy-shortcut-code-button";
import { ShortcutImportCard } from "@/ui/settings/shortcuts/shortcut-import-card";
import { ShortcutPresetCard } from "@/ui/settings/shortcuts/shortcut-preset-card";
import { resetMyShortcutChanges } from "@/ui/settings/shortcuts/switch-shortcut-preset";
import { Button } from "@/ui/button";
import { IconRefresh } from "@tabler/icons-react";

// -- Constants ----------------------------------------------------------------

// The change list is wider than a card, so it opens toward the middle of the grid and stays inside Settings.
const CHANGES_PLACEMENT_BY_COLUMN = ["bottom-start", "bottom", "bottom-end"] as const;

// -- Components ----------------------------------------------------------------

const ShortcutPresetGallery: React.FC = () => {
  const activePreset = useShortcutBindingsStore((state) => state.preset);
  const overrides = useShortcutBindingsStore((state) => state.overrides);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className={CARD_GROUP_LABEL}>Presets</span>
        <span className="flex items-center gap-1">
          {Object.keys(overrides).length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              hasIcon
              className="h-6 pl-1.5 pr-2 text-xs rounded-md"
              onClick={() => void resetMyShortcutChanges()}
            >
              <IconRefresh className="size-3.5" />
              Reset my changes
            </Button>
          )}
          <CopyShortcutCodeButton />
        </span>
      </div>
      <div role="radiogroup" aria-label="Shortcut preset" className="grid grid-cols-3 gap-2.5">
        {SHORTCUT_PRESETS.map((preset, index) => (
          <ShortcutPresetCard
            key={preset.id}
            preset={preset}
            changesPlacement={CHANGES_PLACEMENT_BY_COLUMN[index % CHANGES_PLACEMENT_BY_COLUMN.length]}
            active={preset.id === activePreset}
            overrides={overrides}
          />
        ))}
        <ShortcutImportCard />
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ShortcutPresetGallery };
