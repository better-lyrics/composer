import { useAudioStore } from "@/stores/audio";

// -- Interfaces ----------------------------------------------------------------

interface WaveformData {
  peaks: Float32Array[];
  duration: number;
  barHeight: number | undefined;
}

interface CachedWaveformData extends WaveformData {
  source: string;
}

type DecodedAudio = Pick<AudioBuffer, "numberOfChannels" | "duration" | "getChannelData">;

// -- State ---------------------------------------------------------------------

let cached: CachedWaveformData | null = null;
let accepting = true;

// -- Functions -----------------------------------------------------------------

function dropIfSourceChanged(this: HTMLAudioElement): void {
  if (cached && this.currentSrc !== cached.source) cached = null;
}

useAudioStore.subscribe((state, previous) => {
  if (state.audioElement === previous.audioElement) return;
  previous.audioElement?.removeEventListener("loadstart", dropIfSourceChanged);
  state.audioElement?.addEventListener("loadstart", dropIfSourceChanged);
  cached = null;
});

function unitRangeScale(channel: Float32Array): number | null {
  let peak = 0;
  for (let i = 0; i < channel.length; i++) {
    const magnitude = Math.abs(channel[i]);
    if (magnitude > peak) peak = magnitude;
  }
  if (!Number.isFinite(peak)) return null;
  let scale = 1;
  while (peak * scale > 1) scale /= 2;
  return scale;
}

function mediaSource(media: HTMLAudioElement | null): string {
  return media?.currentSrc || media?.src || "no-audio";
}

function openWaveformCache(): void {
  accepting = true;
}

function closeWaveformCache(): void {
  accepting = false;
  cached = null;
}

function readWaveformData(source: string): WaveformData | null {
  return cached?.source === source ? cached : null;
}

// Scales the samples in place, so call it only once the instance that drew them is destroyed.
function keepWaveformData(source: string, media: HTMLAudioElement, decoded: DecodedAudio | null): void {
  if (!accepting || useAudioStore.getState().audioElement !== media || mediaSource(media) !== source) return;
  if (cached?.source === source || !decoded || decoded.numberOfChannels === 0 || decoded.duration <= 0) return;
  const peaks = Array.from({ length: decoded.numberOfChannels }, (_, channel) => decoded.getChannelData(channel));
  // WaveSurfer rescales peaks outside [-1, 1]; a power of two scale undone by barHeight rounds every bar to the same pixels.
  const scale = peaks[0].length > 0 ? unitRangeScale(peaks[0]) : null;
  if (scale === null) return;
  if (scale !== 1) {
    for (const channel of peaks) {
      for (let i = 0; i < channel.length; i++) channel[i] *= scale;
    }
  }
  cached = { source, peaks, duration: decoded.duration, barHeight: scale === 1 ? undefined : 1 / scale };
}

// -- Exports -------------------------------------------------------------------

export { closeWaveformCache, keepWaveformData, mediaSource, openWaveformCache, readWaveformData };
