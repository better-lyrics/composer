import type { ProjectTab } from "@/domain/project/tab";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { notePlayShortcut } from "@/hooks/useSpaceHabitHint";
import { noteGuideSignal } from "@/lib/guide-signals";
import { notePlacement } from "@/lib/replay-cue";
import { togglePlayback } from "@/lib/sync-count-in";
import { livePlaybackTime, seekBy, toggledPlaybackRate, useAudioStore } from "@/stores/audio";
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
  noteGuideSignal("sync.speed");
  noteGuideSignal("transport.speedKey");
}

function whileTyping(action: () => void): () => void {
  return () => {
    noteGuideSignal("edit.playWhileTyping");
    action();
  };
}

function seekAndNote(seconds: number): void {
  seekBy(seconds);
  notePlacement(livePlaybackTime(), "keyboard");
  noteGuideSignal("transport.seekKey");
}

function seekBackward(): void {
  seekAndNote(-useSettingsStore.getState().seekStep);
}

function seekForward(): void {
  seekAndNote(useSettingsStore.getState().seekStep);
}

function fineSeekBackward(): void {
  seekAndNote(-useSettingsStore.getState().fineSeekStep);
}

function fineSeekForward(): void {
  seekAndNote(useSettingsStore.getState().fineSeekStep);
}

function toggleStem(): void {
  const stem = toggledStem();
  useSeparationStore.getState().selectStem(stem);
  if (useSeparationStore.getState().currentStem !== "original") noteGuideSignal("timeline.stems");
}

function playFromShortcut(): void {
  notePlayShortcut();
  noteGuideSignal("transport.playKey");
  togglePlayback();
}

function useGlobalShortcuts(actions: GlobalShortcutActions): void {
  const { setActiveTab, setHelpOpen, setSettingsOpen, editorActive = true } = actions;
  const goToTab = (tab: ProjectTab) => {
    setActiveTab(tab);
    noteGuideSignal("app.tabKey");
  };
  const general = {
    "global.help": () => setHelpOpen(true),
    "global.settings": () => setSettingsOpen(true),
  };

  useKeyboardShortcuts(
    editorActive
      ? {
          "global.goToImport": () => goToTab("import"),
          "global.goToEdit": () => goToTab("edit"),
          "global.goToLanguages": () => goToTab("languages"),
          "global.goToSync": () => goToTab("sync"),
          "global.goToTimeline": () => goToTab("timeline"),
          "global.goToPreview": () => goToTab("preview"),
          "global.goToExport": () => goToTab("export"),
          "global.playPause": playFromShortcut,
          "global.playPauseWhileTyping": whileTyping(togglePlayback),
          "global.seekBackward": seekBackward,
          "global.seekForward": seekForward,
          "global.seekBackwardWhileTyping": whileTyping(seekBackward),
          "global.seekForwardWhileTyping": whileTyping(seekForward),
          "global.seekBackwardFine": fineSeekBackward,
          "global.seekForwardFine": fineSeekForward,
          "global.seekBackwardFineWhileTyping": whileTyping(fineSeekBackward),
          "global.seekForwardFineWhileTyping": whileTyping(fineSeekForward),
          "global.togglePlaybackSpeed": togglePlaybackSpeed,
          "global.toggleStem": toggleStem,
          "global.toggleLoop": toggleLoopShortcut,
          ...general,
        }
      : general,
  );
}

export { useGlobalShortcuts };
