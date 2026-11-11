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
  startFrame: number;
  channels: Float32Array[];
  sampleRate: number;
  duration: number;
}

type DecodedSourceUse<T> = (decoded: DecodedSource) => T | Promise<T>;

// -- Constants ----------------------------------------------------------------

const CROP_CHANGED_DECODE_TAG = "lt1";
const LOG_PREFIX = "[DecodedSource]";
const NO_CROP: PrimingCrop = { beforeSeconds: 0, nowSeconds: 0 };

// -- Module state -------------------------------------------------------------

const cropBySource = new WeakMap<Blob, PrimingCrop>();
let previousUse: Promise<void> = Promise.resolve();

// -- Decoding -----------------------------------------------------------------

async function decodeWithoutPriming(source: Blob): Promise<DecodedSource> {
  const bytes = await source.arrayBuffer();
  const priming = parseLamePriming(bytes);
  const audio = await sharedAudioContext().decodeAudioData(bytes);
  cropBySource.set(source, primingCrop(priming, audio));
  const cut = primingToCrop(priming, audio);
  const startFrame = cut < audio.length ? cut : 0;
  if (cut >= audio.length) console.warn(LOG_PREFIX, "priming meets or exceeds buffer length; skipping crop:", cut);
  return {
    audio,
    startFrame,
    channels: Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c).subarray(startFrame)),
    sampleRate: audio.sampleRate,
    duration: (audio.length - startFrame) / audio.sampleRate,
  };
}

// A decoded song is a full copy of the audio, so only one is alive at a time and nothing keeps it after its use
// settles. The use owns the channels and may transfer them.
function withDecodedSource<T>(source: Blob, use: DecodedSourceUse<T>): Promise<T> {
  const run = previousUse.then(async () => use(await decodeWithoutPriming(source)));
  previousUse = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function croppedAudioBuffer(decoded: DecodedSource): AudioBuffer {
  return cropAudioBufferHead(decoded.audio, decoded.startFrame, sharedAudioContext());
}

async function decodePrimingCrop(source: Blob): Promise<PrimingCrop> {
  const priming = parseLamePriming(await source.arrayBuffer());
  if (priming.samples <= 0 && priming.legacySamples <= 0) return NO_CROP;
  return cropBySource.get(source) ?? withDecodedSource(source, () => cropBySource.get(source) ?? NO_CROP);
}

// The old build cropped every file its legacy reading tagged, so those files are keyed apart without a decode.
async function primingDecodeTag(source: Blob): Promise<string> {
  return parseLamePriming(await source.arrayBuffer()).legacySamples > 0 ? CROP_CHANGED_DECODE_TAG : "";
}

// -- Exports ------------------------------------------------------------------

export { croppedAudioBuffer, decodePrimingCrop, primingDecodeTag, withDecodedSource };
export type { DecodedSource };
