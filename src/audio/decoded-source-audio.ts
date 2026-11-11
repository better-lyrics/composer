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
let kept: { source: Blob; decoded: DecodedSource } | null = null;

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

function queued<T>(run: () => Promise<T>): Promise<T> {
  const next = previousUse.then(run);
  previousUse = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function keptFor(source: Blob): DecodedSource | null {
  return kept?.source === source ? kept.decoded : null;
}

// A decoded song is a full copy of the audio, so one is decoded at a time and at most one is kept, for the song
// whose first scrub will take it. A use that only reads may get the kept copy; it must not move its channels.
function withDecodedSource<T>(source: Blob, use: DecodedSourceUse<T>): Promise<T> {
  return queued(async () => use(keptFor(source) ?? (await decodeWithoutPriming(source))));
}

// The use owns the channels and may transfer them: it gets the kept copy, which is then no longer kept.
function takeDecodedSource<T>(source: Blob, use: DecodedSourceUse<T>): Promise<T> {
  return queued(async () => {
    const decoded = keptFor(source);
    if (decoded) kept = null;
    return use(decoded ?? (await decodeWithoutPriming(source)));
  });
}

function keepDecoded(source: Blob, decoded: DecodedSource): void {
  kept = { source, decoded };
}

function keepDecodedSource(source: Blob): Promise<void> {
  return withDecodedSource(source, (decoded) => keepDecoded(source, decoded));
}

function releaseDecodedSource(source: Blob): void {
  if (kept?.source === source) kept = null;
}

// A kept copy may have lent its channels out and back, which leaves the AudioBuffer itself empty.
function croppedAudioBuffer({ audio, startFrame, channels, sampleRate }: DecodedSource): AudioBuffer {
  if (audio.getChannelData(0).length === audio.length)
    return cropAudioBufferHead(audio, startFrame, sharedAudioContext());
  const cropped = sharedAudioContext().createBuffer(channels.length, channels[0]?.length ?? 0, sampleRate);
  channels.forEach((channel, index) => cropped.copyToChannel(channel, index));
  return cropped;
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

export {
  croppedAudioBuffer,
  decodePrimingCrop,
  keepDecoded,
  keepDecodedSource,
  primingDecodeTag,
  releaseDecodedSource,
  takeDecodedSource,
  withDecodedSource,
};
export type { DecodedSource };
