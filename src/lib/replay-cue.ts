import { cueAfterPlacement, type PlacementKind, transportPosition } from "@/domain/cue/cue-rules";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { playPlain } from "@/views/timeline/selection-playback";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

type CueFlashListener = (time: number) => void;

// -- State --------------------------------------------------------------------

const flashListeners = new Set<CueFlashListener>();

useAudioStore.subscribe((state, previous) => {
  if (state.source !== previous.source) useTimelineStore.getState().setCue(null);
});

// -- Helpers ------------------------------------------------------------------

function onTimeline(): boolean {
  return useProjectStore.getState().activeTab === "timeline";
}

function flashCue(time: number): void {
  for (const listener of flashListeners) listener(time);
}

function currentTransportPosition(): { target: number; playhead: number } {
  const playhead = livePlaybackTime();
  const target = transportPosition({
    latched: onTimeline() && useSettingsStore.getState().returnToCue,
    cue: useTimelineStore.getState().cue,
    playhead,
  });
  return { target, playhead };
}

// -- Actions ------------------------------------------------------------------

function onCueFlash(listener: CueFlashListener): () => void {
  flashListeners.add(listener);
  return () => {
    flashListeners.delete(listener);
  };
}

function notePlacement(time: number, kind: PlacementKind): void {
  if (!onTimeline()) return;
  const { cue, setCue } = useTimelineStore.getState();
  const playing = useAudioStore.getState().isPlaying;
  setCue(cueAfterPlacement({ cue, time, kind, playing }));
}

function playFromCue(): void {
  const { cue, setCue } = useTimelineStore.getState();
  if (cue === null) {
    setCue(livePlaybackTime());
    if (useAudioStore.getState().isPlaying) return;
  }
  const from = useTimelineStore.getState().cue ?? livePlaybackTime();
  playPlain(from);
  flashCue(from);
}

function startPositionForPlay(): number {
  return currentTransportPosition().target;
}

function returnAfterStop(): void {
  const { target, playhead } = currentTransportPosition();
  if (target === playhead) return;
  useAudioStore.getState().seekTo(target);
  flashCue(target);
}

// -- Exports ------------------------------------------------------------------

export { notePlacement, onCueFlash, playFromCue, returnAfterStop, startPositionForPlay };
