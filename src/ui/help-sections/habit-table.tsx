import { getEffectiveKeysArray, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { presetKeysArray } from "@/stores/shortcut-preset-keys";
import { type ShortcutPresetId, shortcutPreset } from "@/stores/shortcut-presets";
import { Button } from "@/ui/button";
import { HelpTable } from "@/ui/help-table";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { switchShortcutPreset } from "@/ui/settings/shortcuts/switch-shortcut-preset";
import { PROSE } from "@/ui/typography";
import { isStructurallyEqual } from "@/utils/structural-equal";
import { IconKeyboard } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface Habit {
  action: string;
  shortcutIds: readonly string[];
}

interface HabitTableProps {
  preset: ShortcutPresetId;
  habits: readonly Habit[];
}

interface PresetIntroProps {
  preset: ShortcutPresetId;
  children: React.ReactNode;
}

// -- Components ----------------------------------------------------------------

const KeyBadges: React.FC<{ keysPerShortcut: readonly string[][] }> = ({ keysPerShortcut }) =>
  keysPerShortcut.map((keys) => <InlineKeyBadge key={keys.join("+")} keys={keys} className="ml-0 mr-1" />);

const PresetKey: React.FC<{ preset: ShortcutPresetId; shortcutId: string }> = ({ preset, shortcutId }) => (
  <InlineKeyBadge keys={presetKeysArray(preset, shortcutId)} />
);

const HabitTable: React.FC<HabitTableProps> = ({ preset, habits }) => {
  useShortcutBindingsStore((state) => state.preset);
  useShortcutBindingsStore((state) => state.overrides);
  const rows = habits.map(({ action, shortcutIds }) => ({
    action,
    there: shortcutIds.map((id) => presetKeysArray(preset, id)),
    here: shortcutIds.map((id) => getEffectiveKeysArray(id)),
  }));
  const sameKeys = rows.every((row) => isStructurallyEqual(row.there, row.here));
  const head = ["What you do", shortcutPreset(preset).name, ...(sameKeys ? [] : ["Here"])];

  return (
    <HelpTable
      head={head}
      rows={rows.map(({ action, there, here }) => ({
        key: action,
        cells: [
          action,
          <KeyBadges key="there" keysPerShortcut={there} />,
          ...(sameKeys ? [] : [<KeyBadges key="here" keysPerShortcut={here} />]),
        ],
      }))}
    />
  );
};

const PresetIntro: React.FC<PresetIntroProps> = ({ preset, children }) => {
  const active = useShortcutBindingsStore((state) => state.preset === preset);
  const { name } = shortcutPreset(preset);

  return (
    <div className="flex items-center justify-between gap-4">
      <p className={PROSE}>{active ? `You're on the ${name} keys.` : children}</p>
      {!active && (
        <Button
          variant="quiet"
          size="sm"
          hasIcon
          className="shrink-0 select-none"
          onClick={() => void switchShortcutPreset(preset)}
        >
          <IconKeyboard size={15} aria-hidden="true" />
          Use {name} keys
        </Button>
      )}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { HabitTable, PresetIntro, PresetKey };
export type { Habit };
