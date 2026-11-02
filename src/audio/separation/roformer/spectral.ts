import { type Spectrogram, forEachStftFrame, istft } from "@/audio/separation/stft";
import { type BandLayout, RF_BINS, RF_CHUNK, RF_FFT_SIZE, RF_FRAMES, RF_HOP } from "@/audio/separation/roformer/spec";

// -- Constants ----------------------------------------------------------------

const FRAMING = { fftSize: RF_FFT_SIZE, hop: RF_HOP };

// -- Transforms ---------------------------------------------------------------

/** Unnormalised, centred (reflect) STFT of one channel of a chunk, frames by bins. */
function chunkSpectrogram(chunk: Float32Array): Spectrogram {
  const real = new Float32Array(RF_FRAMES * RF_BINS);
  const imag = new Float32Array(RF_FRAMES * RF_BINS);
  forEachStftFrame(
    chunk,
    (frame, frameReal, frameImag) => {
      real.set(frameReal.subarray(0, RF_BINS), frame * RF_BINS);
      imag.set(frameImag.subarray(0, RF_BINS), frame * RF_BINS);
    },
    true,
    FRAMING,
  );
  return { real, imag, numFrames: RF_FRAMES, numBins: RF_BINS };
}

/** The model input, [frames, features, re/im]: each band's bins gathered from both channels. */
function bandFeatures(specs: readonly Spectrogram[], layout: BandLayout): Float32Array {
  const { bins, channels } = layout;
  const count = bins.length;
  const out = new Float32Array(RF_FRAMES * count * 2);
  for (let t = 0; t < RF_FRAMES; t++) {
    for (let g = 0; g < count; g++) {
      const spec = specs[channels[g]];
      const at = t * RF_BINS + bins[g];
      const o = (t * count + g) * 2;
      out[o] = spec.real[at];
      out[o + 1] = spec.imag[at];
    }
  }
  return out;
}

// Each bin's complex mask is the mean over the bands that cover it. The DC bin is zeroed, as the model does,
// and the inverse STFT ignores the Nyquist bin's imaginary part, as irfft does.
function maskedChannels(specs: readonly Spectrogram[], masks: Float32Array, layout: BandLayout): Float32Array[] {
  const { bins, channels, bandsPerBin } = layout;
  const count = bins.length;
  const sums = specs.map(() => ({
    re: new Float32Array(RF_FRAMES * RF_BINS),
    im: new Float32Array(RF_FRAMES * RF_BINS),
  }));
  for (let t = 0; t < RF_FRAMES; t++) {
    for (let g = 0; g < count; g++) {
      const sum = sums[channels[g]];
      const at = t * RF_BINS + bins[g];
      const o = (t * count + g) * 2;
      sum.re[at] += masks[o];
      sum.im[at] += masks[o + 1];
    }
  }
  return specs.map((spec, channel) => {
    const { re, im } = sums[channel];
    for (let t = 0; t < RF_FRAMES; t++) {
      for (let bin = 0; bin < RF_BINS; bin++) {
        const at = t * RF_BINS + bin;
        const d = Math.max(bandsPerBin[bin], 1e-8);
        const mr = re[at] / d;
        const mi = im[at] / d;
        const xr = spec.real[at];
        const xi = spec.imag[at];
        re[at] = bin === 0 ? 0 : xr * mr - xi * mi;
        im[at] = bin === 0 ? 0 : xr * mi + xi * mr;
      }
    }
    return istft({ real: re, imag: im, numFrames: RF_FRAMES, numBins: RF_BINS }, RF_CHUNK, {}, FRAMING);
  });
}

// -- Exports ------------------------------------------------------------------

export { bandFeatures, chunkSpectrogram, maskedChannels };
