// -- Constants -----------------------------------------------------------------

const DECODER_DELAY_SAMPLES = 528;
const PRIMING_HARD_CAP = 8192;
const LOG_PREFIX = "[Composer]";

// -- Functions -----------------------------------------------------------------

function findFirstMp3FrameOffset(bytes: Uint8Array): number {
  if (bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const size = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
    return 10 + size;
  }
  return 0;
}

function parseLamePriming(input: ArrayBuffer | Uint8Array): number {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const frameOffset = findFirstMp3FrameOffset(bytes);
  if (frameOffset + 4 > bytes.length) return 0;
  const syncHigh = bytes[frameOffset];
  const syncLow = bytes[frameOffset + 1];
  if (syncHigh !== 0xff || (syncLow & 0xe0) !== 0xe0) return 0;
  const tagOffset = frameOffset + 0x24;
  if (tagOffset + 4 > bytes.length) return 0;
  const tag =
    String.fromCharCode(bytes[tagOffset]) +
    String.fromCharCode(bytes[tagOffset + 1]) +
    String.fromCharCode(bytes[tagOffset + 2]) +
    String.fromCharCode(bytes[tagOffset + 3]);
  if (tag !== "Xing" && tag !== "Info") return 0;
  const lameOffset = tagOffset + 0x78;
  if (lameOffset + 0x18 > bytes.length) return 0;
  const high = bytes[lameOffset + 0x15];
  const mixed = bytes[lameOffset + 0x16];
  const encoderDelay = (high << 4) | (mixed >> 4);
  const priming = encoderDelay + DECODER_DELAY_SAMPLES;
  if (priming > PRIMING_HARD_CAP) {
    console.warn(`${LOG_PREFIX} LAME priming over cap:`, priming);
    return 0;
  }
  return priming;
}

function stripLeading<T extends Float32Array>(channels: T[], n: number): T[] {
  if (n <= 0) return channels;
  return channels.map((c) => c.slice(n) as T);
}

function cropAudioBufferHead(audio: AudioBuffer, startSample: number, ctx: BaseAudioContext): AudioBuffer {
  if (startSample <= 0) return audio;
  const length = Math.max(0, audio.length - startSample);
  const out = ctx.createBuffer(audio.numberOfChannels, length, audio.sampleRate);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const src = audio.getChannelData(c);
    out.getChannelData(c).set(src.subarray(startSample, startSample + length));
  }
  return out;
}

// -- Exports -------------------------------------------------------------------

export { cropAudioBufferHead, findFirstMp3FrameOffset, parseLamePriming, stripLeading };
