import { hashFile } from "@/audio/separation/audio-codec";
import { computeInstrumental } from "@/audio/separation/derived-stems";
import { encodeSeparatedStems } from "@/audio/separation/separated-stems";
import { encodeWav } from "@/audio/wav-encode";
import { GOLDEN_STEREO_WAV_SHA256, goldenStereoInput } from "@/test/wav-golden";
import { describe, expect, it } from "vitest";

function originalMix(length: number): Float32Array[] {
  return [0, 1].map((channel) => Float32Array.from({ length }, (_, i) => Math.sin((i + channel * 7) / 13) * 0.8));
}

describe("encodeSeparatedStems", () => {
  it("encodes the vocals with the same bytes as before the worker move", async () => {
    const { channels, sampleRate } = goldenStereoInput();
    const { vocals } = await encodeSeparatedStems(originalMix(channels[0].length), channels, sampleRate);
    expect(vocals.type).toBe("audio/wav");
    expect(await hashFile(vocals)).toBe(GOLDEN_STEREO_WAV_SHA256);
  });

  it("encodes the instrumental as the original minus the vocals", async () => {
    const { channels, sampleRate } = goldenStereoInput();
    const original = originalMix(channels[0].length);
    const expected = new Blob([encodeWav(computeInstrumental(original, channels), sampleRate)]);

    const { instrumental } = await encodeSeparatedStems(original, goldenStereoInput().channels, sampleRate);

    expect(await hashFile(instrumental)).toBe(await hashFile(expected));
  });

  describe("invariants", () => {
    it("hands the vocal buffers to the worker but leaves the original mix intact", async () => {
      const { channels, sampleRate } = goldenStereoInput();
      const original = originalMix(channels[0].length);
      const pending = encodeSeparatedStems(original, channels, sampleRate);
      expect(channels.map((channel) => channel.byteLength)).toEqual([0, 0]);
      expect(original.map((channel) => channel.length)).toEqual([4096, 4096]);
      await pending;
    });
  });

  describe("edge cases", () => {
    it("encodes empty stems as header-only wavs", async () => {
      const empty = [new Float32Array(0), new Float32Array(0)];
      const stems = await encodeSeparatedStems(empty, [new Float32Array(0), new Float32Array(0)], 44_100);
      expect([stems.vocals.size, stems.instrumental.size]).toEqual([44, 44]);
    });
  });
});
