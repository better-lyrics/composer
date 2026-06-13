// -- Constants ----------------------------------------------------------------

const LCG_MULTIPLIER = 9301;
const LCG_INCREMENT = 49297;
const LCG_MODULUS = 233280;

// -- Helpers ------------------------------------------------------------------

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededRng(seed: number): () => number {
  let state = seed === 0 ? 1 : seed;
  return () => {
    state = (state * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS;
    return state / LCG_MODULUS;
  };
}

// -- Public -------------------------------------------------------------------

function synthPeaks(seed: string, count: number): number[] {
  if (count <= 0) return [];
  const rng = seededRng(hashSeed(seed));
  const peaks: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const envelope = Math.sin(t * Math.PI);
    const noise = rng() * 0.6 + 0.4;
    peaks[i] = envelope * noise;
  }
  return peaks;
}

// -- Exports ------------------------------------------------------------------

export { synthPeaks };
