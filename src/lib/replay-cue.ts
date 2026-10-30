import { cueAfterPlacement, type PlacementKind, transportPosition } from "@/domain/cue/cue-rules";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { isYouTubeSourceFor } from "@/utils/youtube-source";
import { playPlain, skipLoopRegionOnNextPlay } from "@/views/timeline/selection-playback";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

type CueFlashListener = (time: number) => void;

// -- State --------------------------------------------------------------------

const flashListeners = new Set<CueFlashListener>();

// The YouTube file landing for the same video is the same song, so the cue survives it.
useAudioStore.subscribe(({ source }, previous) => {
  if (source === previous.source) return;
  if (source?.type === "youtube" && isYouTubeSourceFor(previous.source, source.videoId)) return;
  useTimelineStore.getState().setCue(null);
});

// -- Helpers ------------------------------------------------------------------

function onTimeline(): boolean {
  return useProjectStore.getState().activeTab === "timeline";
}

function flashCue(time: number): void {
  for (const listener of flashListeners) listener(time);
}

function currentTransportPosition(): { target: number; playhead: number; latched: boolean } {
  const playhead = livePlaybackTime();
  const latched = onTimeline() && useSettingsStore.getState().returnToCue;
  const target = transportPosition({ latched, cue: useTimelineStore.getState().cue, playhead });
  return { target, playhead, latched };
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
  flashCue(playPlain(useTimelineStore.getState().cue ?? livePlaybackTime()));
}

// Latched, Enter always plays from the cue, so a drawn region the cue sits outside is not adopted.
function prepareTransportPlay(): void {
  const { target, playhead, latched } = currentTransportPosition();
  const { loopRegion: region, cue } = useTimelineStore.getState();
  if (latched && cue !== null && region && (cue < region.begin || cue >= region.end)) skipLoopRegionOnNextPlay();
  if (target !== playhead) useAudioStore.getState().seekTo(target);
}

function returnAfterStop(): void {
  const { target, playhead } = currentTransportPosition();
  if (target === playhead) return;
  useAudioStore.getState().seekTo(target);
  flashCue(target);
}

// -- Exports ------------------------------------------------------------------

export { notePlacement, onCueFlash, playFromCue, prepareTransportPlay, returnAfterStop };
