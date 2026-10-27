const WAV_HEADER_BYTES = 44;

// 16-bit PCM WAV: uncompressed, so the browser seeks it in O(1) with no decoder flush.
function encodeWav(channels: readonly Float32Array[], sampleRate: number): ArrayBuffer {
  const numChannels = channels.length;
  const numFrames = channels[0]?.length ?? 0;
  const blockAlign = numChannels * 2;
  const dataLength = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let frame = 0; frame < numFrames; frame++) {
    for (let c = 0; c < numChannels; c++) {
      const clamped = Math.max(-1, Math.min(1, channels[c][frame]));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return buffer;
}

function readsAscii(view: DataView, offset: number, text: string): boolean {
  for (let i = 0; i < text.length; i++) if (view.getUint8(offset + i) !== text.charCodeAt(i)) return false;
  return true;
}

interface WavLayout {
  sampleRate: number;
  frames: number;
}

// Only the canonical layout encodeWav writes is read; any other WAV returns null.
function readWavLayout(wav: ArrayBuffer): WavLayout | null {
  if (wav.byteLength < WAV_HEADER_BYTES) return null;
  const view = new DataView(wav);
  const isCanonical =
    readsAscii(view, 0, "RIFF") &&
    readsAscii(view, 8, "WAVE") &&
    readsAscii(view, 12, "fmt ") &&
    readsAscii(view, 36, "data") &&
    view.getUint16(20, true) === 1 &&
    view.getUint16(34, true) === 16 &&
    view.getUint32(40, true) === wav.byteLength - WAV_HEADER_BYTES;
  if (!isCanonical) return null;
  return { sampleRate: view.getUint32(24, true), frames: view.getUint32(40, true) / view.getUint16(32, true) };
}

function withLeadingSilence(wav: ArrayBuffer, frames: number): ArrayBuffer | null {
  if (!readWavLayout(wav)) return null;
  const silentBytes = Math.round(frames) * new DataView(wav).getUint16(32, true);
  if (silentBytes <= 0) return wav;
  const padded = new Uint8Array(wav.byteLength + silentBytes);
  padded.set(new Uint8Array(wav, 0, WAV_HEADER_BYTES));
  padded.set(new Uint8Array(wav, WAV_HEADER_BYTES), WAV_HEADER_BYTES + silentBytes);
  const paddedView = new DataView(padded.buffer);
  paddedView.setUint32(4, padded.byteLength - 8, true);
  paddedView.setUint32(40, padded.byteLength - WAV_HEADER_BYTES, true);
  return padded.buffer;
}

export { encodeWav, readWavLayout, withLeadingSilence };
export type { WavLayout };
