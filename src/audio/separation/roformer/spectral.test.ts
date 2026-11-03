import { bandLayout, RF_CHUNK } from "@/audio/separation/roformer/spec";
import { bandFeatures, chunkSpectrogram, maskedChannels } from "@/audio/separation/roformer/spectral";
import { describe, expect, it } from "vitest";

describe("RoFormer spectral path", () => {
  it("gathers the 7,916 features the model takes, covering every STFT bin", () => {
    const layout = bandLayout();
    expect(layout.bins.length * 2).toBe(7916);
    expect(layout.bandsPerBin.every((count) => count >= 1)).toBe(true);
  });

  it("gives back the chunk, minus its DC, through a mask of ones", () => {
    const layout = bandLayout();
    const chunk = [440, 3000].map((hz) =>
      Float32Array.from({ length: RF_CHUNK }, (_, i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / 44100)),
    );
    const specs = chunk.map(chunkSpectrogram);
    const features = bandFeatures(specs, layout);
    const ones = new Float32Array(features.length);
    for (let i = 0; i < ones.length; i += 2) ones[i] = 1;
    const out = maskedChannels(specs, ones, layout);
    for (let c = 0; c < 2; c++) {
      let err = 0;
      let ref = 0;
      for (let i = 4096; i < RF_CHUNK - 4096; i++) {
        err += (out[c][i] - chunk[c][i]) ** 2;
        ref += chunk[c][i] ** 2;
      }
      expect(10 * Math.log10(ref / err)).toBeGreaterThan(60);
    }
  });
});
