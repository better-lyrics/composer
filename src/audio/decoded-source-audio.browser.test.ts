import { decodeSourceAudio } from "@/audio/decoded-source-audio";
import { parseLamePriming } from "@/audio/lame-priming";
import { createMp3File, encodeWav, makeSineBuffer } from "@/test/audio-fixtures";
import { describe, expect, it } from "vitest";

function sineWav(seconds: number): Blob {
  return new Blob([encodeWav(makeSineBuffer(seconds))], { type: "audio/wav" });
}

describe("decodeSourceAudio", () => {
  it("decodes a wav source into an AudioBuffer of the same duration", async () => {
    const decoded = await decodeSourceAudio(sineWav(1));
    expect(decoded.duration).toBeCloseTo(1, 1);
  });

  it("strips LAME priming from an mp3 source", async () => {
    const mp3 = createMp3File();
    const bytes = await mp3.arrayBuffer();
    const { samples, sampleRate } = parseLamePriming(bytes);
    expect(samples).toBeGreaterThan(0);
    const ctx = new AudioContext();
    const unstripped = await ctx.decodeAudioData(bytes.slice(0));
    await ctx.close();

    const decoded = await decodeSourceAudio(mp3);

    expect(decoded.length).toBe(unstripped.length - Math.round((samples * unstripped.sampleRate) / sampleRate));
  });

  describe("invariants", () => {
    it("decodes each source once and shares the buffer between callers", async () => {
      const source = sineWav(0.5);
      const [first, second] = await Promise.all([decodeSourceAudio(source), decodeSourceAudio(source)]);
      expect(second).toBe(first);
      expect(await decodeSourceAudio(source)).toBe(first);
    });

    it("keeps different sources apart", async () => {
      const first = await decodeSourceAudio(sineWav(0.5));
      const second = await decodeSourceAudio(sineWav(0.5));
      expect(second).not.toBe(first);
    });
  });

  describe("error paths", () => {
    it("rejects for bytes that are not audio and does not remember the failure", async () => {
      const garbage = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/wav" });
      await expect(decodeSourceAudio(garbage)).rejects.toBeDefined();
      await expect(decodeSourceAudio(garbage)).rejects.toBeDefined();
    });
  });
});
