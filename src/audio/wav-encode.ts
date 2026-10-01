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

export { encodeWav };
