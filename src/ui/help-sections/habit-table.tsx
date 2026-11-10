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

const KeyBadges: React.FC<{ shortcutIds: readonly string[]; keysOf: (shortcutId: string) => string[] }> = ({
  shortcutIds,
  keysOf,
}) => shortcutIds.map((id) => <InlineKeyBadge key={id} keys={keysOf(id)} className="ml-0 mr-1" />);

const PresetKey: React.FC<{ preset: ShortcutPresetId; shortcutId: string }> = ({ preset, shortcutId }) => (
  <InlineKeyBadge keys={presetKeysArray(preset, shortcutId)} />
);

const HabitTable: React.FC<HabitTableProps> = ({ preset, habits }) => {
  useShortcutBindingsStore((state) => state.preset);
  useShortcutBindingsStore((state) => state.overrides);
  const presetKeys = (id: string) => presetKeysArray(preset, id);
  const sameKeys = habits.every(({ shortcutIds }) =>
    shortcutIds.every((id) => isStructurallyEqual(presetKeys(id), getEffectiveKeysArray(id))),
  );
  const head = ["What you do", shortcutPreset(preset).name, ...(sameKeys ? [] : ["Here"])];

  return (
    <HelpTable
      head={head}
      rows={habits.map(({ action, shortcutIds }) => ({
        key: action,
        cells: [
          action,
          <KeyBadges key="there" shortcutIds={shortcutIds} keysOf={presetKeys} />,
          ...(sameKeys ? [] : [<KeyBadges key="here" shortcutIds={shortcutIds} keysOf={getEffectiveKeysArray} />]),
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
