// -- Constants ----------------------------------------------------------------

const SAMPLE_STEP = 2;

// -- Functions ----------------------------------------------------------------

function similarity(channels: Float32Array[], reference: number, candidate: number, length: number): number {
  let dot = 0;
  let energy = 0;
  for (const samples of channels) {
    for (let i = 0; i < length; i += SAMPLE_STEP) {
      const value = samples[candidate + i];
      dot += samples[reference + i] * value;
      energy += value * value;
    }
  }
  return energy > 0 ? dot / Math.sqrt(energy) : 0;
}

// Picks the start near `targetS` whose audio best matches what the previous grain plays during the crossfade,
// so overlapping grains add up in phase instead of cancelling into a hollow, robotic sound.
function alignedGrainOffset(
  channels: Float32Array[],
  sampleRate: number,
  referenceS: number,
  targetS: number,
  searchS: number,
  overlapS: number,
): number {
  const frames = channels[0]?.length ?? 0;
  const length = Math.round(overlapS * sampleRate);
  const reference = Math.round(referenceS * sampleRate);
  if (reference < 0 || reference + length > frames) return targetS;
  const target = Math.round(targetS * sampleRate);
  const search = Math.round(searchS * sampleRate);
  const first = Math.max(0, target - search);
  const last = Math.min(frames - length, target + search);
  // Silence scores zero everywhere, so the target wins any tie.
  let best = Math.min(Math.max(target, first), last);
  let bestScore = similarity(channels, reference, best, length);
  for (let candidate = first; candidate <= last; candidate++) {
    const score = similarity(channels, reference, candidate, length);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best / sampleRate;
}

// -- Exports ------------------------------------------------------------------

export { alignedGrainOffset };
