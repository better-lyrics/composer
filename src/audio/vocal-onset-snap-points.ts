import { detectOnsetsOffThread } from "@/audio/pcm-worker-host";
import { decodeFileToFloat32 } from "@/audio/separation/audio-codec";
import { getStemJobOnsets, putStemJobOnsets } from "@/audio/separation/stem-store";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[VocalOnsets]";

// -- Types --------------------------------------------------------------------

interface VocalOnsetRequest {
  jobKey: string | null;
  vocalsUrl: string;
  signal: AbortSignal;
  onDetectionStart: () => void;
}

// -- Helpers ------------------------------------------------------------------

async function readCachedOnsets(jobKey: string | null): Promise<number[] | null> {
  if (!jobKey) return null;
  try {
    return await getStemJobOnsets(jobKey);
  } catch (error) {
    console.warn(LOG_PREFIX, "could not read cached onsets; detecting again", error);
    return null;
  }
}

async function cacheOnsets(jobKey: string | null, onsets: number[]): Promise<void> {
  if (!jobKey) return;
  try {
    await putStemJobOnsets(jobKey, onsets);
  } catch (error) {
    console.warn(LOG_PREFIX, "could not cache onsets", error);
  }
}

// -- Loading ------------------------------------------------------------------

async function loadVocalOnsets({ jobKey, vocalsUrl, signal, onDetectionStart }: VocalOnsetRequest): Promise<number[]> {
  const cached = await readCachedOnsets(jobKey);
  signal.throwIfAborted();
  if (cached) return cached;

  onDetectionStart();
  const response = await fetch(vocalsUrl, { signal });
  if (!response.ok) throw new Error(`Could not read vocal stem (${response.status}).`);
  const decoded = await decodeFileToFloat32(await response.blob());
  signal.throwIfAborted();
  const onsets = await detectOnsetsOffThread(decoded.channels, decoded.sampleRate, signal);
  await cacheOnsets(jobKey, onsets);
  return onsets;
}

// -- Exports ------------------------------------------------------------------

export { loadVocalOnsets };
