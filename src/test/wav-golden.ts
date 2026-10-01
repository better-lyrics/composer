// Hashes recorded from the WAV encoder before it moved into the worker; the bytes must never change.
const GOLDEN_STEREO_WAV_SHA256 = "3297ceb0f3493b3bdf046f2b2fdcec6c44d3820ec86fc457f8713754a8fdc02c";
const GOLDEN_MONO_WAV_SHA256 = "6d771039cd41060d1611218c5e27b24ce349e802b3f322e8a7daa3a5539b7843";

function goldenChannel(length: number, seed: number): Float32Array {
  const out = new Float32Array(length);
  let state = seed;
  for (let i = 0; i < length; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    out[i] = (state / 0x100000000) * 3 - 1.5;
  }
  out.set([1, -1, 0, Number.NaN, 2, -2, 0.5, -0.5], 0);
  return out;
}

function goldenStereoInput(): { channels: Float32Array[]; sampleRate: number } {
  return { channels: [goldenChannel(4096, 1), goldenChannel(4096, 2)], sampleRate: 48_000 };
}

function goldenMonoInput(): { channels: Float32Array[]; sampleRate: number } {
  return { channels: [goldenChannel(1000, 9)], sampleRate: 44_100 };
}

export { GOLDEN_MONO_WAV_SHA256, GOLDEN_STEREO_WAV_SHA256, goldenMonoInput, goldenStereoInput };
