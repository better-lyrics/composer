import { cropAudioBufferHead, parseLamePriming } from "@/audio/lame-priming";
import { sharedAudioContext } from "@/audio/shared-audio-context";

// -- Module state -------------------------------------------------------------

const decodedBySource = new WeakMap<Blob, Promise<AudioBuffer>>();

// -- Decoding -----------------------------------------------------------------

async function decodeWithoutPriming(source: Blob): Promise<AudioBuffer> {
  const bytes = await source.arrayBuffer();
  const priming = parseLamePriming(bytes);
  const ctx = sharedAudioContext();
  const decoded = await ctx.decodeAudioData(bytes);
  const startSample =
    priming.samples > 0 && priming.sampleRate > 0
      ? Math.round((priming.samples * decoded.sampleRate) / priming.sampleRate)
      : 0;
  return cropAudioBufferHead(decoded, startSample, ctx);
}

function decodeSourceAudio(source: Blob): Promise<AudioBuffer> {
  const cached = decodedBySource.get(source);
  if (cached) return cached;
  const decoding = decodeWithoutPriming(source);
  decodedBySource.set(source, decoding);
  decoding.catch(() => {
    if (decodedBySource.get(source) === decoding) decodedBySource.delete(source);
  });
  return decoding;
}

// -- Exports ------------------------------------------------------------------

export { decodeSourceAudio };
