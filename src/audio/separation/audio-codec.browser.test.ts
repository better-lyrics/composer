import { decodeFileToFloat32 } from "@/audio/separation/audio-codec";
import { createAudioFile, createMp3File } from "@/test/audio-fixtures";
import { describe, expect, it } from "vitest";

describe("decodeFileToFloat32 LAME priming", () => {
  it("regression: does not crop an mp3 the browser already trimmed", async () => {
    const file = createMp3File();
    const decoded = await decodeFileToFloat32(file);
    const raw = await decodeFileToFloat32(file, { stripPriming: false });
    expect(decoded.numFrames).toBe(raw.numFrames);
    expect(decoded.channels[0].length).toBe(decoded.numFrames);
    expect(decoded.channels[1].length).toBe(decoded.numFrames);
  });

  it("is a no-op for a WAV file", async () => {
    const wav = createAudioFile();
    const decoded = await decodeFileToFloat32(wav);
    const undecorated = await decodeFileToFloat32(wav, { stripPriming: false });
    expect(decoded.numFrames).toBe(undecorated.numFrames);
  });

  it("returns 2 channels and the correct sample rate", async () => {
    const file = createMp3File();
    const decoded = await decodeFileToFloat32(file);
    expect(decoded.channels.length).toBe(2);
    expect(decoded.sampleRate).toBe(44100);
  });
});
