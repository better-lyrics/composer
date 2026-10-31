import { useEffect } from "react";
import { toast } from "sonner";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { shortcutPreset } from "@/stores/shortcut-presets";
import { useUIStore } from "@/stores/ui";
import { pluralize, pluralWord } from "@/utils/pluralize";

// -- Constants ----------------------------------------------------------------

const PRESET_INTRO_DURATION_MS = 10_000;

// -- Helpers ------------------------------------------------------------------

function presetIntroDescription(): string {
  const { preset, overrides } = useShortcutBindingsStore.getState();
  if (preset !== "composer") {
    const { name } = shortcutPreset(preset);
    return `Your keys match ${name}, so ${name} is selected. Nothing moved.`;
  }
  const count = Object.keys(overrides).length;
  return `Your ${pluralize(count, "changed key")} ${pluralWord(count, "is", "are")} kept on top of Composer. Nothing moved.`;
}

// -- Hook ---------------------------------------------------------------------

function useShortcutPresetIntro(enabled: boolean): void {
  useEffect(() => {
    const { presetIntroPending, dismissPresetIntro } = useShortcutBindingsStore.getState();
    if (!enabled || !presetIntroPending) return;
    dismissPresetIntro();
    toast("Shortcuts now come in presets", {
      description: presetIntroDescription(),
      duration: PRESET_INTRO_DURATION_MS,
      action: {
        label: "See presets",
        onClick: () => useUIStore.getState().openSettings({ target: { setting: "shortcutPreset" } }),
      },
    });
  }, [enabled]);
}

// -- Exports ------------------------------------------------------------------

export { useShortcutPresetIntro };
