import { cropAudioBufferHead, parseLamePriming, primingCropChanged, primingToCrop } from "@/audio/lame-priming";
import { sharedAudioContext } from "@/audio/shared-audio-context";

// -- Types --------------------------------------------------------------------

interface DecodedSource {
  audio: AudioBuffer;
  cropChanged: boolean;
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
    cropChanged: primingCropChanged(priming, decoded),
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

async function decodeCropChanged(source: Blob): Promise<boolean> {
  if (parseLamePriming(await source.arrayBuffer()).samples <= 0) return false;
  return (await decodeSource(source)).cropChanged;
}

// Data built from a decode that cropped LAME priming twice is keyed apart from data built from the corrected one.
async function primingDecodeTag(source: Blob): Promise<string> {
  return (await decodeCropChanged(source)) ? CROP_CHANGED_DECODE_TAG : "";
}

// -- Exports ------------------------------------------------------------------

export { decodeCropChanged, decodeSourceAudio, primingDecodeTag };
