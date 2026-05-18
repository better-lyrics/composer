// -- Types --------------------------------------------------------------------

interface DecodedAudio {
  sampleRate: number;
  numberOfChannels: number;
  length: number;
  getChannelData(channel: number): Float32Array;
}

// -- Helpers ------------------------------------------------------------------

function isMp3File(file: File): boolean {
  return file.type === "audio/mpeg" || /\.mp3$/i.test(file.name);
}

// Re-wraps decoded PCM as an uncompressed 16-bit WAV blob. Uncompressed PCM
// has no frame index, so the browser seeks it in O(1) with no decoder flush,
// which is the whole point: it sidesteps the slow mp3 seek path.
function audioBufferToWav(audio: DecodedAudio): Blob {
  const { numberOfChannels, sampleRate, length } = audio;
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const dataLength = length * blockAlign;
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
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numberOfChannels; c++) channels.push(audio.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numberOfChannels; c++) {
      const clamped = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

// Decodes an mp3 File to an uncompressed WAV blob. Rejects if the browser
// cannot decode the file; the caller falls back to the original file.
async function decodeMp3ToWav(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return audioBufferToWav(audioBuffer);
  } finally {
    void ctx.close();
  }
}

// -- Exports ------------------------------------------------------------------

export { audioBufferToWav, decodeMp3ToWav, isMp3File };
