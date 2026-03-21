import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Shortcut } from "@/hooks/useKeyboardShortcuts";
import { getEffectiveBinding, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { useAudioStore } from "@/stores/audio";
import type { SimpleTab } from "@/stores/project";
import { useMemo } from "react";

interface GlobalShortcutActions {
  setActiveTab: (tab: SimpleTab) => void;
  setHelpOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
}

function useGlobalShortcuts(actions: GlobalShortcutActions): void {
  const { setActiveTab, setHelpOpen, setSettingsOpen } = actions;
  const overrides = useShortcutBindingsStore((s) => s.overrides);

  // biome-ignore lint/correctness/useExhaustiveDependencies: overrides triggers recomputation when bindings change
  const shortcuts: Shortcut[] = useMemo(() => {
    const playPause = getEffectiveBinding("global.playPause");
    const help = getEffectiveBinding("global.help");
    const settings = getEffectiveBinding("global.settings");
    return [
      { key: "1", ctrl: true, action: () => setActiveTab("import"), description: "Import" },
      { key: "2", ctrl: true, action: () => setActiveTab("edit"), description: "Edit" },
      { key: "3", ctrl: true, action: () => setActiveTab("sync"), description: "Sync" },
      { key: "4", ctrl: true, action: () => setActiveTab("timeline"), description: "Timeline" },
      { key: "5", ctrl: true, action: () => setActiveTab("preview"), description: "Preview" },
      { key: "6", ctrl: true, action: () => setActiveTab("export"), description: "Export" },
      {
        key: playPause.key,
        shift: playPause.shift,
        alt: playPause.alt,
        action: () => {
          const { isPlaying, setIsPlaying } = useAudioStore.getState();
          setIsPlaying(!isPlaying);
        },
        description: "Play / Pause",
      },
      {
        key: help.key,
        shift: help.shift,
        alt: help.alt,
        action: () => setHelpOpen(true),
        description: "Show keyboard shortcuts",
      },
      {
        key: settings.key,
        shift: settings.shift,
        alt: settings.alt,
        action: () => setSettingsOpen(true),
        description: "Open settings",
      },
    ];
  }, [setActiveTab, setHelpOpen, setSettingsOpen, overrides]);

  useKeyboardShortcuts(shortcuts);
}

export { useGlobalShortcuts };
