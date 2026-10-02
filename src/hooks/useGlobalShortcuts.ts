import type { ProjectTab } from "@/domain/project/tab";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAudioStore } from "@/stores/audio";

interface GlobalShortcutActions {
  setActiveTab: (tab: ProjectTab) => void;
  setHelpOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  editorActive?: boolean;
}

const SLOW_PLAYBACK_RATE = 0.75;

function togglePlaybackSpeed(): void {
  const { playbackRate, setPlaybackRate } = useAudioStore.getState();
  setPlaybackRate(playbackRate === 1 ? SLOW_PLAYBACK_RATE : 1);
}

function togglePlayback(): void {
  const { isPlaying, setIsPlaying } = useAudioStore.getState();
  setIsPlaying(!isPlaying);
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
          "global.togglePlaybackSpeed": togglePlaybackSpeed,
          ...general,
        }
      : general,
  );
}

export { useGlobalShortcuts };
