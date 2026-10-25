// Log-mel front end of Beat This! (CPJKU/beat_this LogMelSpect), matched against torchaudio in beat-features.test.ts.

// -- Constants -----------------------------------------------------------------

const BEAT_SAMPLE_RATE = 22050;
const BEAT_FPS = 50;
const N_FFT = 1024;
const HOP = 441;
const N_MELS = 128;
const F_MIN = 30;
const F_MAX = 11000;
const LOG_MULTIPLIER = 1000;
const N_BINS = N_FFT / 2 + 1;

const SLANEY_HZ_PER_MEL = 200 / 3;
const SLANEY_MIN_LOG_HZ = 1000;
const SLANEY_MIN_LOG_MEL = SLANEY_MIN_LOG_HZ / SLANEY_HZ_PER_MEL;
const SLANEY_LOG_STEP = Math.log(6.4) / 27;

// -- Types ---------------------------------------------------------------------

interface LogMel {
  mel: Float32Array;
  frames: number;
}

interface SparseFilterbank {
  bandStart: Uint32Array;
  bins: Uint32Array;
  weights: Float64Array;
}

// -- Filterbank ----------------------------------------------------------------

function hzToMel(hz: number): number {
  if (hz < SLANEY_MIN_LOG_HZ) return hz / SLANEY_HZ_PER_MEL;
  return SLANEY_MIN_LOG_MEL + Math.log(hz / SLANEY_MIN_LOG_HZ) / SLANEY_LOG_STEP;
}

function melToHz(mel: number): number {
  if (mel < SLANEY_MIN_LOG_MEL) return SLANEY_HZ_PER_MEL * mel;
  return SLANEY_MIN_LOG_HZ * Math.exp(SLANEY_LOG_STEP * (mel - SLANEY_MIN_LOG_MEL));
}

function slaneyFilterbank(): SparseFilterbank {
  const nyquist = Math.floor(BEAT_SAMPLE_RATE / 2);
  const melMin = hzToMel(F_MIN);
  const melMax = hzToMel(F_MAX);
  const edges = Array.from({ length: N_MELS + 2 }, (_, i) => melToHz(melMin + ((melMax - melMin) * i) / (N_MELS + 1)));
  const bandStart = new Uint32Array(N_MELS + 1);
  const bins: number[] = [];
  const weights: number[] = [];
  for (let m = 0; m < N_MELS; m++) {
    bandStart[m] = bins.length;
    for (let b = 0; b < N_BINS; b++) {
      const hz = (b * nyquist) / (N_BINS - 1);
      const rising = (hz - edges[m]) / (edges[m + 1] - edges[m]);
      const falling = (edges[m + 2] - hz) / (edges[m + 2] - edges[m + 1]);
      const weight = Math.max(0, Math.min(rising, falling));
      if (weight > 0) {
        bins.push(b);
        weights.push(weight);
      }
    }
  }
  bandStart[N_MELS] = bins.length;
  return { bandStart, bins: Uint32Array.from(bins), weights: Float64Array.from(weights) };
}

// -- FFT -----------------------------------------------------------------------

function createFft(size: number): (real: Float64Array, imag: Float64Array) => void {
  const bits = Math.log2(size);
  const reversed = new Uint32Array(size);
  for (let i = 0; i < size; i++) {
    let r = 0;
    for (let b = 0, v = i; b < bits; b++, v >>>= 1) r = (r << 1) | (v & 1);
    reversed[i] = r;
  }
  const cos = new Float64Array(size / 2);
  const sin = new Float64Array(size / 2);
  for (let k = 0; k < size / 2; k++) {
    cos[k] = Math.cos((-2 * Math.PI * k) / size);
    sin[k] = Math.sin((-2 * Math.PI * k) / size);
  }
  return (real, imag) => {
    for (let i = 0; i < size; i++) {
      const j = reversed[i];
      if (j <= i) continue;
      const swapReal = real[i];
      real[i] = real[j];
      real[j] = swapReal;
      const swapImag = imag[i];
      imag[i] = imag[j];
      imag[j] = swapImag;
    }
    for (let span = 2; span <= size; span <<= 1) {
      const half = span >> 1;
      const stride = size / span;
      for (let start = 0; start < size; start += span) {
        for (let k = 0; k < half; k++) {
          const a = start + k;
          const b = a + half;
          const wr = cos[k * stride];
          const wi = sin[k * stride];
          const tr = wr * real[b] - wi * imag[b];
          const ti = wr * imag[b] + wi * real[b];
          real[b] = real[a] - tr;
          imag[b] = imag[a] - ti;
          real[a] += tr;
          imag[a] += ti;
        }
      }
    }
  };
}

// -- Log-mel -------------------------------------------------------------------

function reflectedSample(signal: Float32Array, index: number): number {
  const last = signal.length - 1;
  let i = index < 0 ? -index : index;
  if (i > last) i = 2 * last - i;
  return signal[Math.min(last, Math.max(0, i))] ?? 0;
}

function logMel(signal: Float32Array): LogMel {
  const frames = 1 + Math.floor(signal.length / HOP);
  const mel = new Float32Array(frames * N_MELS);
  if (signal.length === 0) return { mel, frames };
  const { bandStart, bins, weights } = slaneyFilterbank();
  const window = Float64Array.from({ length: N_FFT }, (_, i) => 0.5 * (1 - Math.cos((2 * Math.PI * i) / N_FFT)));
  const fft = createFft(N_FFT);
  const real = new Float64Array(N_FFT);
  const imag = new Float64Array(N_FFT);
  const magnitude = new Float64Array(N_BINS);
  const scale = 1 / Math.sqrt(N_FFT);
  const pad = N_FFT / 2;
  for (let t = 0; t < frames; t++) {
    const start = t * HOP - pad;
    for (let i = 0; i < N_FFT; i++) real[i] = reflectedSample(signal, start + i) * window[i];
    imag.fill(0);
    fft(real, imag);
    for (let b = 0; b < N_BINS; b++) magnitude[b] = Math.hypot(real[b], imag[b]) * scale;
    const row = t * N_MELS;
    for (let m = 0; m < N_MELS; m++) {
      let energy = 0;
      for (let j = bandStart[m]; j < bandStart[m + 1]; j++) energy += magnitude[bins[j]] * weights[j];
      mel[row + m] = Math.log1p(LOG_MULTIPLIER * energy);
    }
  }
  return { mel, frames };
}

// -- Exports -------------------------------------------------------------------

export { BEAT_FPS, BEAT_SAMPLE_RATE, N_MELS, logMel };
export type { LogMel };
