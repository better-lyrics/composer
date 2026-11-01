import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { shortcutPreset } from "@/stores/shortcut-presets";
import { type HelpLocation, useUIStore } from "@/stores/ui";
import { Button } from "@/ui/button";
import { IconKeyboard } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface HelpShortcutPresetButtonProps {
  returnPoint: () => HelpLocation;
}

// -- Component -----------------------------------------------------------------

const HelpShortcutPresetButton: React.FC<HelpShortcutPresetButtonProps> = ({ returnPoint }) => {
  const presetName = useShortcutBindingsStore((s) => shortcutPreset(s.preset).name);
  const openPresetSetting = () =>
    useUIStore.getState().openSettings({ target: { setting: "shortcutPreset" }, returnTo: returnPoint() });

  return (
    <Button variant="quiet" size="sm" hasIcon className="select-none" onClick={openPresetSetting}>
      <IconKeyboard size={15} aria-hidden="true" />
      {presetName} keys
    </Button>
  );
};

// -- Exports -------------------------------------------------------------------

export { HelpShortcutPresetButton };
