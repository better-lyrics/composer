import { withDecodedSource } from "@/audio/decoded-source-audio";
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

// Decodes any File the browser can read into an uncompressed WAV blob. Used
// to swap a slow-seeking source (mp3, raw aac) for an O(1)-seekable WAV.
// Rejects if the browser cannot decode the file; the caller falls back to
// the original file.
function decodeAudioToWav(file: File): Promise<Blob> {
  return withDecodedSource(file, (decoded) => encodeWavOffThread(decoded.channels, decoded.sampleRate));
}

// -- Exports ------------------------------------------------------------------

export { decodeAudioToWav, needsWavConversion };
