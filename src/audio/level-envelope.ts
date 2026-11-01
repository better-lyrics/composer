// -- Types --------------------------------------------------------------------

// Per channel, one value per window: the sample peak (for the LED strip) and the RMS (for the VU needles).
interface LevelEnvelope {
  windowsPerSecond: number;
  peaks: [Float32Array, Float32Array];
  rms: [Float32Array, Float32Array];
}

// -- Constants ----------------------------------------------------------------

const LEVEL_WINDOWS_PER_SECOND = 100;

// -- Functions ----------------------------------------------------------------

function windowLevels(samples: Float32Array, windowSize: number, windowCount: number) {
  const peaks = new Float32Array(windowCount);
  const rms = new Float32Array(windowCount);
  for (let window = 0; window < windowCount; window++) {
    const start = window * windowSize;
    const end = Math.min(samples.length, start + windowSize);
    let peak = 0;
    let energy = 0;
    for (let i = start; i < end; i++) {
      const sample = samples[i];
      const magnitude = Math.abs(sample);
      if (magnitude > peak) peak = magnitude;
      energy += sample * sample;
    }
    peaks[window] = Math.min(1, peak);
    rms[window] = end > start ? Math.sqrt(energy / (end - start)) : 0;
  }
  return { peaks, rms };
}

function computeLevelEnvelope(channels: readonly Float32Array[], sampleRate: number): LevelEnvelope {
  const windowSize = Math.max(1, Math.round(sampleRate / LEVEL_WINDOWS_PER_SECOND));
  const left = channels[0] ?? new Float32Array(0);
  const windowCount = Math.ceil(left.length / windowSize);
  const leftLevels = windowLevels(left, windowSize, windowCount);
  const rightLevels = channels[1] ? windowLevels(channels[1], windowSize, windowCount) : leftLevels;
  return {
    windowsPerSecond: sampleRate / windowSize,
    peaks: [leftLevels.peaks, rightLevels.peaks],
    rms: [leftLevels.rms, rightLevels.rms],
  };
}

function levelAt(levels: Float32Array, windowsPerSecond: number, time: number): number {
  const window = Math.floor(time * windowsPerSecond);
  return window >= 0 && window < levels.length ? levels[window] : 0;
}

// -- Exports ------------------------------------------------------------------

export { computeLevelEnvelope, levelAt };
export type { LevelEnvelope };
