// Generates a valid 0.1-second 8 kHz mono PCM WAV (silence) at module load
// and exposes it as a real `File`. Tests use this for any code path that needs
// a playable audio source (audio engine, drop zone, etc.).

const SAMPLE_RATE = 8000;
const DURATION_SECONDS = 0.1;
const SAMPLE_COUNT = Math.round(SAMPLE_RATE * DURATION_SECONDS);

function buildSilentWav(): Uint8Array {
  const dataLength = SAMPLE_COUNT * 2;
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
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  return new Uint8Array(buffer);
}

const SILENT_WAV_BYTES = buildSilentWav();

function createAudioFile(name = "silence.wav"): File {
  return new File([SILENT_WAV_BYTES], name, { type: "audio/wav" });
}

export { createAudioFile };
