import { cropAudioBufferHead, parseLamePriming } from "@/audio/lame-priming";
import { encodeWavOffThread } from "@/audio/pcm-worker-host";

// -- Helpers ------------------------------------------------------------------

// Identifies inputs whose native <audio> seek is slow because the bitstream
// has no frame index. Today: raw mp3 (audio/mpeg, .mp3) and raw aac (audio/aac,
// .aac). m4a/mp4 carries AAC inside a container with its own seek atom, so
// audio/mp4 is intentionally NOT flagged here.
function needsWavConversion(file: File): boolean {
  if (file.type === "audio/mpeg" || file.type === "audio/mp3") return true;
  if (file.type === "audio/aac") return true;
  return /\.(mp3|aac)$/i.test(file.name);
}

function copyChannels(audio: AudioBuffer): Float32Array[] {
  return Array.from({ length: audio.numberOfChannels }, (_, channel) => {
    const copy = new Float32Array(audio.length);
    audio.copyFromChannel(copy, channel);
    return copy;
  });
}

// Decodes any File the browser can read into an uncompressed WAV blob. Used
// to swap a slow-seeking source (mp3, raw aac) for an O(1)-seekable WAV.
// Rejects if the browser cannot decode the file; the caller falls back to
// the original file.
async function decodeAudioToWav(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const priming = parseLamePriming(arrayBuffer);
  const ctx = new AudioContext();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const startSample =
      priming.samples > 0 && priming.sampleRate > 0
        ? Math.round((priming.samples * audioBuffer.sampleRate) / priming.sampleRate)
        : 0;
    const cropped = cropAudioBufferHead(audioBuffer, startSample, ctx);
    return encodeWavOffThread(copyChannels(cropped), cropped.sampleRate);
  } finally {
    void ctx.close();
  }
}

// -- Exports ------------------------------------------------------------------

export { decodeAudioToWav, needsWavConversion };
