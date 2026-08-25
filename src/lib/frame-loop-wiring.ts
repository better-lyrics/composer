import { holdFrames, wake } from "@/lib/frame-loop";
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

const PLAYING_HOLD_LABEL = "playing";

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
  let releasePlayingHold: (() => void) | null = null;

  // Fresh identity per wiring: Zustand listener sets and addEventListener both dedupe a
  // shared reference, so one disposer would silently unbind every other wiring.
  const wakeFromThisWiring = () => wake();

  const bindAudioElement = (element: HTMLAudioElement | null) => {
    if (boundAudioElement === element) return;
    if (boundAudioElement) {
      for (const eventType of AUDIO_WAKE_EVENTS) boundAudioElement.removeEventListener(eventType, wakeFromThisWiring);
    }
    boundAudioElement = element;
    if (boundAudioElement) {
      for (const eventType of AUDIO_WAKE_EVENTS) boundAudioElement.addEventListener(eventType, wakeFromThisWiring);
    }
  };

  const syncPlayingHold = (isPlaying: boolean) => {
    if (isPlaying === (releasePlayingHold !== null)) return;
    if (isPlaying) {
      releasePlayingHold = holdFrames(PLAYING_HOLD_LABEL);
      return;
    }
    releasePlayingHold?.();
    releasePlayingHold = null;
  };

  const syncAudio = (state: AudioFrameInputs) => {
    syncPlayingHold(state.isPlaying);
    bindAudioElement(state.audioElement);
    wake();
  };

  const wakeWhenVisible = () => {
    if (!document.hidden) wake();
  };

  const unsubscribes = [
    useAudioStore.subscribe(syncAudio),
    useAuthStore.subscribe(wakeFromThisWiring),
    useConfirmStore.subscribe(wakeFromThisWiring),
    useDivergenceStore.subscribe(wakeFromThisWiring),
    useImportModalStore.subscribe(wakeFromThisWiring),
    useModalStackStore.subscribe(wakeFromThisWiring),
    useProjectStore.subscribe(wakeFromThisWiring),
    useSeparationStore.subscribe(wakeFromThisWiring),
    useSettingsStore.subscribe(wakeFromThisWiring),
    useShortcutBindingsStore.subscribe(wakeFromThisWiring),
    useThemeStore.subscribe(wakeFromThisWiring),
    useUIStore.subscribe(wakeFromThisWiring),
    useTimelineStore.subscribe(wakeFromThisWiring),
  ];

  document.addEventListener("visibilitychange", wakeWhenVisible);
  syncAudio(useAudioStore.getState());

  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
    document.removeEventListener("visibilitychange", wakeWhenVisible);
    bindAudioElement(null);
    syncPlayingHold(false);
  };
}

// -- Exports ------------------------------------------------------------------

export { AUDIO_WAKE_EVENTS, PLAYING_HOLD_LABEL, wireFrameLoop };
