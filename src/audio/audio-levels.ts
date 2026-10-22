import { parseLamePriming, primingStartFrame } from "@/audio/lame-priming";
import type { LevelEnvelope } from "@/audio/level-envelope";
import { computeLevelEnvelopeOffThread } from "@/audio/pcm-worker-host";

// -- Constants ----------------------------------------------------------------

const ANALYSIS_SAMPLE_RATE = 22050;
const MAX_CACHED_URLS = 4;

// -- Module state -------------------------------------------------------------

interface AnalysisRun {
  envelope: Promise<LevelEnvelope>;
  signal: AbortSignal;
  finished: boolean;
}

const envelopeBySource = new WeakMap<Blob, AnalysisRun>();
const envelopeByUrl = new Map<string, AnalysisRun>();

// -- Analysis -----------------------------------------------------------------

// An offline context decodes without starting the audio device, and the lower rate keeps the transient buffer small.
async function analyseLevels(source: Blob, signal: AbortSignal): Promise<LevelEnvelope> {
  const bytes = await source.arrayBuffer();
  const priming = parseLamePriming(bytes);
  const decoded = await new OfflineAudioContext(1, 1, ANALYSIS_SAMPLE_RATE).decodeAudioData(bytes);
  const startFrame = primingStartFrame(priming, decoded.sampleRate);
  const channelCount = Math.min(2, decoded.numberOfChannels);
  const channels = Array.from({ length: channelCount }, (_, channel) =>
    decoded.getChannelData(channel).slice(startFrame),
  );
  return computeLevelEnvelopeOffThread(channels, decoded.sampleRate, signal);
}

// A run started under a signal that has since aborted is never reused: it rejects, and the caller would keep that failure.
function usableRun(run: AnalysisRun | undefined): Promise<LevelEnvelope> | undefined {
  return run && (run.finished || !run.signal.aborted) ? run.envelope : undefined;
}

function remember<K>(
  cache: { get(key: K): AnalysisRun | undefined; set(key: K, run: AnalysisRun): unknown; delete(key: K): unknown },
  key: K,
  run: AnalysisRun,
) {
  cache.set(key, run);
  run.envelope.then(
    () => {
      run.finished = true;
    },
    () => {
      if (cache.get(key) === run) cache.delete(key);
    },
  );
}

function levelEnvelopeFor(source: Blob, signal: AbortSignal): Promise<LevelEnvelope> {
  const cached = usableRun(envelopeBySource.get(source));
  if (cached) return cached;
  const run = { envelope: analyseLevels(source, signal), signal, finished: false };
  remember(envelopeBySource, source, run);
  return run.envelope;
}

function levelEnvelopeForUrl(url: string, signal: AbortSignal): Promise<LevelEnvelope> {
  const cached = usableRun(envelopeByUrl.get(url));
  if (cached) return cached;
  const envelope = fetch(url, { signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Audio request failed with status ${response.status}`);
      return response.blob();
    })
    .then((blob) => analyseLevels(blob, signal));
  remember(envelopeByUrl, url, { envelope, signal, finished: false });
  if (envelopeByUrl.size > MAX_CACHED_URLS) {
    const oldest = envelopeByUrl.keys().next().value;
    if (oldest !== undefined) envelopeByUrl.delete(oldest);
  }
  return envelope;
}

function hasLevelEnvelope(source: Blob): boolean {
  return usableRun(envelopeBySource.get(source)) !== undefined;
}

// -- Exports ------------------------------------------------------------------

export { hasLevelEnvelope, levelEnvelopeFor, levelEnvelopeForUrl };
