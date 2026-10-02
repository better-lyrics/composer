import type { ProjectTab } from "@/domain/project/tab";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { togglePlayback } from "@/lib/sync-count-in";

interface GlobalShortcutActions {
  setActiveTab: (tab: ProjectTab) => void;
  setHelpOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  editorActive?: boolean;
}

function useGlobalShortcuts(actions: GlobalShortcutActions): void {
  const { setActiveTab, setHelpOpen, setSettingsOpen, editorActive = true } = actions;
  const general = {
    "global.help": () => setHelpOpen(true),
    "global.settings": () => setSettingsOpen(true),
  };

  useKeyboardShortcuts(
    editorActive
      ? {
          "global.goToImport": () => setActiveTab("import"),
          "global.goToEdit": () => setActiveTab("edit"),
          "global.goToLanguages": () => setActiveTab("languages"),
          "global.goToSync": () => setActiveTab("sync"),
          "global.goToTimeline": () => setActiveTab("timeline"),
          "global.goToPreview": () => setActiveTab("preview"),
          "global.goToExport": () => setActiveTab("export"),
          "global.playPause": togglePlayback,
          ...general,
        }
      : general,
  );
}

export { useGlobalShortcuts };
