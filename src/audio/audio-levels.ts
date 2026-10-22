import { parseLamePriming } from "@/audio/lame-priming";
import type { LevelEnvelope } from "@/audio/level-envelope";
import { computeLevelEnvelopeOffThread } from "@/audio/pcm-worker-host";

// -- Constants ----------------------------------------------------------------

const ANALYSIS_SAMPLE_RATE = 22050;
const MAX_CACHED_URLS = 4;

// -- Module state -------------------------------------------------------------

const envelopeBySource = new WeakMap<Blob, Promise<LevelEnvelope>>();
const envelopeByUrl = new Map<string, Promise<LevelEnvelope>>();

// -- Analysis -----------------------------------------------------------------

// An offline context decodes without starting the audio device, and the lower rate keeps the transient buffer small.
async function analyseLevels(source: Blob): Promise<LevelEnvelope> {
  const bytes = await source.arrayBuffer();
  const priming = parseLamePriming(bytes);
  const decoded = await new OfflineAudioContext(1, 1, ANALYSIS_SAMPLE_RATE).decodeAudioData(bytes);
  const startFrame =
    priming.samples > 0 && priming.sampleRate > 0
      ? Math.round((priming.samples * decoded.sampleRate) / priming.sampleRate)
      : 0;
  const channelCount = Math.min(2, decoded.numberOfChannels);
  const channels = Array.from({ length: channelCount }, (_, channel) =>
    decoded.getChannelData(channel).slice(startFrame),
  );
  return computeLevelEnvelopeOffThread(channels, decoded.sampleRate);
}

function forgetOnFailure<K>(cache: { get(key: K): unknown; delete(key: K): unknown }, key: K, run: Promise<unknown>) {
  run.catch(() => {
    if (cache.get(key) === run) cache.delete(key);
  });
}

function levelEnvelopeFor(source: Blob): Promise<LevelEnvelope> {
  const cached = envelopeBySource.get(source);
  if (cached) return cached;
  const run = analyseLevels(source);
  envelopeBySource.set(source, run);
  forgetOnFailure(envelopeBySource, source, run);
  return run;
}

function levelEnvelopeForUrl(url: string): Promise<LevelEnvelope> {
  const cached = envelopeByUrl.get(url);
  if (cached) return cached;
  const run = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Audio request failed with status ${response.status}`);
      return response.blob();
    })
    .then(analyseLevels);
  envelopeByUrl.set(url, run);
  forgetOnFailure(envelopeByUrl, url, run);
  if (envelopeByUrl.size > MAX_CACHED_URLS) {
    const oldest = envelopeByUrl.keys().next().value;
    if (oldest !== undefined) envelopeByUrl.delete(oldest);
  }
  return run;
}

function hasLevelEnvelope(source: Blob): boolean {
  return envelopeBySource.has(source);
}

// -- Exports ------------------------------------------------------------------

export { hasLevelEnvelope, levelEnvelopeFor, levelEnvelopeForUrl };
