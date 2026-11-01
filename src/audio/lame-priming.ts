// -- Constants -----------------------------------------------------------------

const DECODER_DELAY_SAMPLES = 528;
const PRIMING_HARD_CAP = 8192;
const LOG_PREFIX = "[LamePriming]";
const XING_FRAMES_FLAG = 0x01;
const XING_FIELD_SIZES: readonly number[] = [4, 4, 100, 4];
const XING_HEADER_SIZE = 8;
const LEGACY_LAME_OFFSET = 0x78;
const SAMPLES_PER_FRAME_MPEG1 = 1152;
const SAMPLES_PER_FRAME_MPEG2 = 576;
// Trimmed and untrimmed lengths differ by delay + padding (at least 576); resampling moves a length by under 8.
const DECODED_LENGTH_TOLERANCE = 64;

const MPEG1_SAMPLE_RATES: readonly number[] = [44_100, 48_000, 32_000];
const MPEG2_SAMPLE_RATES: readonly number[] = [22_050, 24_000, 16_000];
const MPEG25_SAMPLE_RATES: readonly number[] = [11_025, 12_000, 8_000];

const TAG_OFFSET_MPEG1_STEREO = 0x24;
const TAG_OFFSET_MPEG1_MONO = 0x15;
const TAG_OFFSET_MPEG2_STEREO = 0x15;
const TAG_OFFSET_MPEG2_MONO = 0x0d;

const MPEG_VERSION_2_5 = 0;
const MPEG_VERSION_2 = 2;
const MPEG_VERSION_1 = 3;
const CHANNEL_MODE_MONO = 3;

// -- Types ---------------------------------------------------------------------

interface LamePriming {
  samples: number;
  sampleRate: number;
  encoderDelay: number;
  padding: number;
  frameCount: number | null;
  samplesPerFrame: number;
  legacySamples: number;
}

interface PrimingCrop {
  beforeSeconds: number;
  nowSeconds: number;
}

type LamePrimingDecode = "none" | "trimmed" | "untrimmed" | "unknown";

interface DecodedLength {
  length: number;
  sampleRate: number;
}

const NO_PRIMING: LamePriming = {
  samples: 0,
  sampleRate: 0,
  encoderDelay: 0,
  padding: 0,
  frameCount: null,
  samplesPerFrame: 0,
  legacySamples: 0,
};

// -- Functions -----------------------------------------------------------------

function findFirstMp3FrameOffset(bytes: Uint8Array): number {
  if (bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
    return 10 + size;
  }
  return 0;
}

function readSampleRate(versionBits: number, rateIdx: number): number {
  if (rateIdx === 3) return 0;
  if (versionBits === MPEG_VERSION_1) return MPEG1_SAMPLE_RATES[rateIdx] ?? 0;
  if (versionBits === MPEG_VERSION_2) return MPEG2_SAMPLE_RATES[rateIdx] ?? 0;
  if (versionBits === MPEG_VERSION_2_5) return MPEG25_SAMPLE_RATES[rateIdx] ?? 0;
  return 0;
}

function readTagOffset(versionBits: number, channelMode: number): number {
  const mono = channelMode === CHANNEL_MODE_MONO;
  if (versionBits === MPEG_VERSION_1) return mono ? TAG_OFFSET_MPEG1_MONO : TAG_OFFSET_MPEG1_STEREO;
  if (versionBits === MPEG_VERSION_2 || versionBits === MPEG_VERSION_2_5) {
    return mono ? TAG_OFFSET_MPEG2_MONO : TAG_OFFSET_MPEG2_STEREO;
  }
  return 0;
}

function readXingFlags(bytes: Uint8Array, tagOffset: number): number | null {
  if (tagOffset + XING_HEADER_SIZE > bytes.length) return null;
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(tagOffset + 4);
}

function readFrameCount(bytes: Uint8Array, tagOffset: number, flags: number): number | null {
  if (!(flags & XING_FRAMES_FLAG) || tagOffset + XING_HEADER_SIZE + 4 > bytes.length) return null;
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(tagOffset + XING_HEADER_SIZE);
}

// The LAME extension follows only the Xing fields (frames, bytes, TOC, quality) the flags declare.
function readLameOffset(tagOffset: number, flags: number): number {
  return XING_FIELD_SIZES.reduce(
    (offset, size, bit) => (flags & (1 << bit) ? offset + size : offset),
    tagOffset + XING_HEADER_SIZE,
  );
}

// The double-crop build read the delay at a fixed offset, which is right only when every Xing field is present.
function readLegacyPrimingSamples(bytes: Uint8Array, tagOffset: number): number {
  const lameOffset = tagOffset + LEGACY_LAME_OFFSET;
  if (lameOffset + 0x18 > bytes.length) return 0;
  const samples = ((bytes[lameOffset + 0x15] << 4) | (bytes[lameOffset + 0x16] >> 4)) + DECODER_DELAY_SAMPLES;
  return samples > PRIMING_HARD_CAP ? 0 : samples;
}

function parseLamePriming(input: ArrayBuffer | Uint8Array): LamePriming {
  let empty = NO_PRIMING;
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const frameOffset = findFirstMp3FrameOffset(bytes);
  if (frameOffset + 4 > bytes.length) return empty;
  const syncHigh = bytes[frameOffset];
  const syncLow = bytes[frameOffset + 1];
  if (syncHigh !== 0xff || (syncLow & 0xe0) !== 0xe0) return empty;

  const versionBits = (syncLow >> 3) & 0x03;
  const rateIdx = (bytes[frameOffset + 2] >> 2) & 0x03;
  const channelMode = (bytes[frameOffset + 3] >> 6) & 0x03;
  const sampleRate = readSampleRate(versionBits, rateIdx);
  if (sampleRate === 0) return empty;
  const tagFrameOffset = readTagOffset(versionBits, channelMode);
  if (tagFrameOffset === 0) return empty;

  const tagOffset = frameOffset + tagFrameOffset;
  if (tagOffset + 4 > bytes.length) return empty;
  const tag =
    String.fromCharCode(bytes[tagOffset]) +
    String.fromCharCode(bytes[tagOffset + 1]) +
    String.fromCharCode(bytes[tagOffset + 2]) +
    String.fromCharCode(bytes[tagOffset + 3]);
  if (tag !== "Xing" && tag !== "Info") return empty;
  const legacySamples = readLegacyPrimingSamples(bytes, tagOffset);
  empty = { ...NO_PRIMING, sampleRate, legacySamples };

  const flags = readXingFlags(bytes, tagOffset);
  if (flags === null) return empty;
  const lameOffset = readLameOffset(tagOffset, flags);
  if (lameOffset + 0x18 > bytes.length) return empty;
  const high = bytes[lameOffset + 0x15];
  const mixed = bytes[lameOffset + 0x16];
  const encoderDelay = (high << 4) | (mixed >> 4);
  const samples = encoderDelay + DECODER_DELAY_SAMPLES;
  if (samples > PRIMING_HARD_CAP) {
    console.warn(`${LOG_PREFIX} LAME priming over cap:`, samples);
    return empty;
  }
  return {
    samples,
    sampleRate,
    encoderDelay,
    padding: ((mixed & 0x0f) << 8) | bytes[lameOffset + 0x17],
    frameCount: readFrameCount(bytes, tagOffset, flags),
    samplesPerFrame: versionBits === MPEG_VERSION_1 ? SAMPLES_PER_FRAME_MPEG1 : SAMPLES_PER_FRAME_MPEG2,
    legacySamples,
  };
}

function lamePrimingDecode(priming: LamePriming, decoded: DecodedLength): LamePrimingDecode {
  if (priming.samples <= 0 || priming.sampleRate <= 0) return "none";
  if (!priming.frameCount || decoded.sampleRate <= 0) return "unknown";
  const sourceLength = (decoded.length * priming.sampleRate) / decoded.sampleRate;
  const encodedLength = priming.frameCount * priming.samplesPerFrame;
  const isNear = (target: number) => Math.abs(sourceLength - target) <= DECODED_LENGTH_TOLERANCE;
  if (isNear(encodedLength - priming.encoderDelay - priming.padding)) return "trimmed";
  if (isNear(encodedLength)) return "untrimmed";
  return "unknown";
}

// The double-crop build cut its legacy reading whenever a tag had one; this build cuts only an untrimmed decode.
function primingCrop(priming: LamePriming, decoded: DecodedLength): PrimingCrop {
  if (priming.sampleRate <= 0) return { beforeSeconds: 0, nowSeconds: 0 };
  const nowSamples = lamePrimingDecode(priming, decoded) === "untrimmed" ? priming.samples : 0;
  return { beforeSeconds: priming.legacySamples / priming.sampleRate, nowSeconds: nowSamples / priming.sampleRate };
}

function primingToCrop(priming: LamePriming, decoded: DecodedLength, outputSampleRate = decoded.sampleRate): number {
  const decode = lamePrimingDecode(priming, decoded);
  if (decode === "untrimmed") return Math.round((priming.samples * outputSampleRate) / priming.sampleRate);
  if (decode === "unknown") {
    console.warn(
      `${LOG_PREFIX} decoded length does not match the LAME tag; not cropping:`,
      decoded.length,
      decoded.sampleRate,
    );
  }
  return 0;
}

function stripLeading<T extends Float32Array>(channels: T[], n: number): T[] {
  if (n <= 0) return channels;
  return channels.map((c) => c.slice(n) as T);
}

function cropAudioBufferHead(audio: AudioBuffer, startSample: number, ctx: BaseAudioContext): AudioBuffer {
  if (startSample <= 0) return audio;
  if (startSample >= audio.length) {
    console.warn(`${LOG_PREFIX} priming meets or exceeds buffer length; skipping crop:`, startSample, audio.length);
    return audio;
  }
  const length = audio.length - startSample;
  const out = ctx.createBuffer(audio.numberOfChannels, length, audio.sampleRate);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const src = audio.getChannelData(c);
    out.getChannelData(c).set(src.subarray(startSample, startSample + length));
  }
  return out;
}

// -- Exports -------------------------------------------------------------------

export {
  cropAudioBufferHead,
  findFirstMp3FrameOffset,
  lamePrimingDecode,
  parseLamePriming,
  primingCrop,
  primingToCrop,
  stripLeading,
};
export type { PrimingCrop };
