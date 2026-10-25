import { cropAudioBufferHead, parseLamePriming, primingStartFrame } from "@/audio/lame-priming";
import { sharedAudioContext } from "@/audio/shared-audio-context";

// -- Module state -------------------------------------------------------------

const decodedBySource = new WeakMap<Blob, Promise<AudioBuffer>>();

// -- Decoding -----------------------------------------------------------------

async function decodeWithoutPriming(source: Blob): Promise<AudioBuffer> {
  const bytes = await source.arrayBuffer();
  const priming = parseLamePriming(bytes);
  const ctx = sharedAudioContext();
  const decoded = await ctx.decodeAudioData(bytes);
  return cropAudioBufferHead(decoded, primingStartFrame(priming, decoded.sampleRate), ctx);
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
