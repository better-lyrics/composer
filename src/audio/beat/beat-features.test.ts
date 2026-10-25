import { BEAT_SAMPLE_RATE, N_MELS, logMel } from "@/audio/beat/beat-features";
import melReference from "@/audio/beat/test-fixtures/mel-reference.json";
import { describe, expect, it } from "vitest";

function referenceSignal(): Float32Array {
  const signal = new Float32Array(BEAT_SAMPLE_RATE);
  for (let n = 0; n < signal.length; n++) {
    const t = n / BEAT_SAMPLE_RATE;
    const click = n % 11025 === 0 ? 0.9 : 0;
    signal[n] = 0.5 * Math.sin(2 * Math.PI * 440 * t) + 0.3 * Math.sin(2 * Math.PI * (100 + 2000 * t) * t) + click;
  }
  return signal;
}

describe("logMel", () => {
  it("matches the upstream torchaudio front end", () => {
    const { mel, frames } = logMel(referenceSignal());
    expect(frames).toBe(melReference.frames);
    let maxError = 0;
    for (let t = 0; t < frames; t++) {
      for (let m = 0; m < N_MELS; m++) {
        maxError = Math.max(maxError, Math.abs(mel[t * N_MELS + m] - melReference.mel[t][m]));
      }
    }
    expect(maxError).toBeLessThan(2e-3);
  });

  it("gives one frame per hop plus one", () => {
    expect(logMel(new Float32Array(441 * 10)).frames).toBe(11);
    expect(logMel(new Float32Array(440)).frames).toBe(1);
  });

  it("is silent for silence", () => {
    expect(logMel(new Float32Array(4410)).mel.every((value) => value === 0)).toBe(true);
  });
});
