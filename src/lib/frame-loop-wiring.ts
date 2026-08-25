import { setFrameSource, wake } from "@/lib/frame-loop";
import { useAudioStore } from "@/stores/audio";
import { useAuthStore } from "@/stores/auth";
import { useConfirmStore } from "@/stores/confirm-store";
import { useDivergenceStore } from "@/stores/divergence-store";
import { useImportModalStore } from "@/stores/import-modal-store";
import { useModalStackStore } from "@/stores/modal-stack";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { useThemeStore } from "@/stores/theme";
import { useUIStore } from "@/stores/ui";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Interfaces ---------------------------------------------------------------

interface AudioFrameInputs {
  isPlaying: boolean;
  audioElement: HTMLAudioElement | null;
}

// -- Constants ----------------------------------------------------------------

const PLAYING_FRAME_SOURCE = "playing";

const AUDIO_WAKE_EVENTS = [
  "play",
  "playing",
  "pause",
  "seeking",
  "seeked",
  "ratechange",
  "durationchange",
  "loadedmetadata",
  "loadstart",
  "emptied",
] as const;

// -- Wiring -------------------------------------------------------------------

function wireFrameLoop(): () => void {
  let boundAudioElement: HTMLAudioElement | null = null;

  const bindAudioElement = (element: HTMLAudioElement | null) => {
    if (boundAudioElement === element) return;
    if (boundAudioElement) {
      for (const eventType of AUDIO_WAKE_EVENTS) boundAudioElement.removeEventListener(eventType, wake);
    }
    boundAudioElement = element;
    if (boundAudioElement) {
      for (const eventType of AUDIO_WAKE_EVENTS) boundAudioElement.addEventListener(eventType, wake);
    }
  };

  const syncAudio = (state: AudioFrameInputs) => {
    setFrameSource(PLAYING_FRAME_SOURCE, state.isPlaying);
    bindAudioElement(state.audioElement);
    wake();
  };

  const wakeWhenVisible = () => {
    if (!document.hidden) wake();
  };

  const unsubscribes = [
    useAudioStore.subscribe(syncAudio),
    useAuthStore.subscribe(wake),
    useConfirmStore.subscribe(wake),
    useDivergenceStore.subscribe(wake),
    useImportModalStore.subscribe(wake),
    useModalStackStore.subscribe(wake),
    useProjectStore.subscribe(wake),
    useSeparationStore.subscribe(wake),
    useSettingsStore.subscribe(wake),
    useShortcutBindingsStore.subscribe(wake),
    useThemeStore.subscribe(wake),
    useUIStore.subscribe(wake),
    useTimelineStore.subscribe(wake),
  ];

  document.addEventListener("visibilitychange", wakeWhenVisible);
  syncAudio(useAudioStore.getState());

  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
    document.removeEventListener("visibilitychange", wakeWhenVisible);
    bindAudioElement(null);
    setFrameSource(PLAYING_FRAME_SOURCE, false);
  };
}

// -- Exports ------------------------------------------------------------------

export { AUDIO_WAKE_EVENTS, wireFrameLoop };
