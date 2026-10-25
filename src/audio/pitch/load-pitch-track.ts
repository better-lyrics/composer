import { decodeSourceAudio } from "@/audio/decoded-source-audio";
import { cachePitchTrack, readCachedPitchTrack } from "@/audio/pitch/pitch-cache";
import { startPitchDetection } from "@/audio/pitch/pitch-worker-host";
import { resampleMono } from "@/audio/pitch/resample-mono";
import { fetchVocalStem } from "@/audio/separation/fetch-vocal-stem";
import { SWIFT_F0_SAMPLE_RATE } from "@/domain/pitch/swift-f0-frames";
import type { PitchTrack } from "@/domain/pitch/track";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Pitch]";

// -- Types --------------------------------------------------------------------

interface PitchTrackRequest {
  jobKey: string | null;
  vocalsUrl: string;
  signal: AbortSignal;
  focusTime: () => number;
  onProgress: (track: PitchTrack) => void;
  // Detection follows the viewport; the returned setter is live until the track is done.
  onFocusSetter: (setFocusTime: ((seconds: number) => void) | null) => void;
}

// -- Helpers ------------------------------------------------------------------

async function readCached(jobKey: string | null): Promise<PitchTrack | null> {
  if (!jobKey) return null;
  try {
    return await readCachedPitchTrack(jobKey);
  } catch (error) {
    console.warn(LOG_PREFIX, "could not read cached pitch; detecting again", error);
    return null;
  }
}

async function cache(jobKey: string | null, track: PitchTrack): Promise<void> {
  if (!jobKey) return;
  try {
    await cachePitchTrack(jobKey, track);
  } catch (error) {
    console.warn(LOG_PREFIX, "could not cache pitch", error);
  }
}

// -- Loading ------------------------------------------------------------------

async function loadPitchTrack({
  jobKey,
  vocalsUrl,
  signal,
  focusTime,
  onProgress,
  onFocusSetter,
}: PitchTrackRequest): Promise<PitchTrack> {
  const cached = await readCached(jobKey);
  signal.throwIfAborted();
  if (cached) return cached;

  const decoded = await decodeSourceAudio(await fetchVocalStem(vocalsUrl, signal));
  signal.throwIfAborted();
  const audio16k = await resampleMono(decoded, SWIFT_F0_SAMPLE_RATE);
  signal.throwIfAborted();
  const detection = startPitchDetection(audio16k, { focusTime: focusTime(), signal, onProgress });
  onFocusSetter(detection.setFocusTime);
  const track = await detection.done.finally(() => onFocusSetter(null));
  await cache(jobKey, track);
  return track;
}

// -- Exports ------------------------------------------------------------------

export { loadPitchTrack };
