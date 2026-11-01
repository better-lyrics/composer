import {
  type PrimingCrop,
  cropAudioBufferHead,
  parseLamePriming,
  primingCrop,
  primingToCrop,
} from "@/audio/lame-priming";
import { sharedAudioContext } from "@/audio/shared-audio-context";

// -- Types --------------------------------------------------------------------

interface DecodedSource {
  audio: AudioBuffer;
  crop: PrimingCrop;
}

// -- Constants ----------------------------------------------------------------

const CROP_CHANGED_DECODE_TAG = "lt1";

// -- Module state -------------------------------------------------------------

const decodedBySource = new WeakMap<Blob, Promise<DecodedSource>>();

// -- Decoding -----------------------------------------------------------------

async function decodeWithoutPriming(source: Blob): Promise<DecodedSource> {
  const bytes = await source.arrayBuffer();
  const priming = parseLamePriming(bytes);
  const ctx = sharedAudioContext();
  const decoded = await ctx.decodeAudioData(bytes);
  return {
    audio: cropAudioBufferHead(decoded, primingToCrop(priming, decoded), ctx),
    crop: primingCrop(priming, decoded),
  };
}

function decodeSource(source: Blob): Promise<DecodedSource> {
  const cached = decodedBySource.get(source);
  if (cached) return cached;
  const decoding = decodeWithoutPriming(source);
  decodedBySource.set(source, decoding);
  decoding.catch(() => {
    if (decodedBySource.get(source) === decoding) decodedBySource.delete(source);
  });
  return decoding;
}

async function decodeSourceAudio(source: Blob): Promise<AudioBuffer> {
  return (await decodeSource(source)).audio;
}

async function decodePrimingCrop(source: Blob): Promise<PrimingCrop> {
  const priming = parseLamePriming(await source.arrayBuffer());
  if (priming.samples <= 0 && priming.legacySamples <= 0) return { beforeSeconds: 0, nowSeconds: 0 };
  return (await decodeSource(source)).crop;
}

// The old build cropped every file its legacy reading tagged, so those files are keyed apart without a decode.
async function primingDecodeTag(source: Blob): Promise<string> {
  return parseLamePriming(await source.arrayBuffer()).legacySamples > 0 ? CROP_CHANGED_DECODE_TAG : "";
}

// -- Exports ------------------------------------------------------------------

export { decodePrimingCrop, decodeSourceAudio, primingDecodeTag };
