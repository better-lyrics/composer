import { parseLamePriming, stripLeading } from "@/audio/lame-priming";
import { encodeWav } from "@/audio/wav-encode";

const TARGET_SAMPLE_RATE = 44_100;
const TARGET_CHANNELS = 2;

interface DecodedAudio {
  channels: Float32Array[];
  sampleRate: number;
  numFrames: number;
}

interface DecodeOptions {
  stripPriming?: boolean;
}

async function decodeFileToFloat32(file: File | Blob, opts: DecodeOptions = {}): Promise<DecodedAudio> {
  const buf = await file.arrayBuffer();
  const shouldStrip = opts.stripPriming !== false;
  const priming = shouldStrip ? parseLamePriming(buf) : { samples: 0, sampleRate: 0 };
  const trimAtTarget =
    priming.samples > 0 && priming.sampleRate > 0
      ? Math.round((priming.samples * TARGET_SAMPLE_RATE) / priming.sampleRate)
      : 0;
  const applyStrip = (channels: Float32Array[]): Float32Array[] => stripLeading(channels, trimAtTarget);

  const ctx = new OfflineAudioContext(TARGET_CHANNELS, 1, TARGET_SAMPLE_RATE);
  const decoded = await ctx.decodeAudioData(buf);

  if (decoded.sampleRate === TARGET_SAMPLE_RATE && decoded.numberOfChannels === TARGET_CHANNELS) {
    const channels: Float32Array[] = [];
    for (let c = 0; c < TARGET_CHANNELS; c++) {
      const out = new Float32Array(decoded.length);
      decoded.copyFromChannel(out, c);
      channels.push(out);
    }
    const stripped = applyStrip(channels);
    return { channels: stripped, sampleRate: TARGET_SAMPLE_RATE, numFrames: stripped[0]?.length ?? 0 };
  }

  const durationSec = decoded.length / decoded.sampleRate;
  const targetFrames = Math.ceil(durationSec * TARGET_SAMPLE_RATE);
  const resampleCtx = new OfflineAudioContext(TARGET_CHANNELS, targetFrames, TARGET_SAMPLE_RATE);
  const source = resampleCtx.createBufferSource();

  if (decoded.numberOfChannels === 1) {
    const stereoBuffer = resampleCtx.createBuffer(TARGET_CHANNELS, decoded.length, decoded.sampleRate);
    const mono = decoded.getChannelData(0);
    stereoBuffer.copyToChannel(mono, 0);
    stereoBuffer.copyToChannel(mono, 1);
    source.buffer = stereoBuffer;
  } else {
    source.buffer = decoded;
  }
  source.connect(resampleCtx.destination);
  source.start();
  const rendered = await resampleCtx.startRendering();

  const channels: Float32Array[] = [];
  for (let c = 0; c < TARGET_CHANNELS; c++) {
    const out = new Float32Array(rendered.length);
    rendered.copyFromChannel(out, c);
    channels.push(out);
  }
  const stripped = applyStrip(channels);
  return { channels: stripped, sampleRate: TARGET_SAMPLE_RATE, numFrames: stripped[0]?.length ?? 0 };
}

function floatChannelsToWavBlob(channels: Float32Array[], sampleRate: number): Blob {
  return new Blob([encodeWav(channels, sampleRate)], { type: "audio/wav" });
}

async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashFile(file: File | Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  return sha256Hex(buf);
}

export { TARGET_SAMPLE_RATE, decodeFileToFloat32, floatChannelsToWavBlob, hashFile };
