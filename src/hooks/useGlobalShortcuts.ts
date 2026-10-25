import type { ProjectTab } from "@/domain/project/tab";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { togglePlayback } from "@/lib/sync-count-in";
import { seekBy, toggledPlaybackRate, useAudioStore } from "@/stores/audio";
import { toggledStem, useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { toggleLoopShortcut } from "@/views/timeline/selection-playback";

interface GlobalShortcutActions {
  setActiveTab: (tab: ProjectTab) => void;
  setHelpOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  editorActive?: boolean;
}

function togglePlaybackSpeed(): void {
  useAudioStore.getState().setPlaybackRate(toggledPlaybackRate());
}

function seekBackward(): void {
  seekBy(-useSettingsStore.getState().seekStep);
}

function seekForward(): void {
  seekBy(useSettingsStore.getState().seekStep);
}

function fineSeekBackward(): void {
  seekBy(-useSettingsStore.getState().fineSeekStep);
}

function fineSeekForward(): void {
  seekBy(useSettingsStore.getState().fineSeekStep);
}

function toggleStem(): void {
  useSeparationStore.getState().selectStem(toggledStem());
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
          "global.playPauseWhileTyping": togglePlayback,
          "global.seekBackward": seekBackward,
          "global.seekForward": seekForward,
          "global.seekBackwardWhileTyping": seekBackward,
          "global.seekForwardWhileTyping": seekForward,
          "global.seekBackwardFine": fineSeekBackward,
          "global.seekForwardFine": fineSeekForward,
          "global.seekBackwardFineWhileTyping": fineSeekBackward,
          "global.seekForwardFineWhileTyping": fineSeekForward,
          "global.togglePlaybackSpeed": togglePlaybackSpeed,
          "global.toggleStem": toggleStem,
          "global.toggleLoop": toggleLoopShortcut,
          ...general,
        }
      : general,
  );
}

export { useGlobalShortcuts };
