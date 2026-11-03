// Kimberley Jensen's Mel-Band RoFormer vocal model, as configured by ZFTurbo's MSST
// (configs/KimberleyJensen/config_vocals_mel_band_roformer_kj.yaml): 44.1 kHz stereo,
// an unnormalised STFT at 2048/441, 60 overlapping mel bands, 8 s chunks.

// -- Constants ----------------------------------------------------------------

const RF_FFT_SIZE = 2048;
const RF_HOP = 441;
/** One chunk, 8 s: the length the model was trained on. */
const RF_CHUNK = 352_800;
const RF_FRAMES = RF_CHUNK / RF_HOP + 1;
const RF_BINS = RF_FFT_SIZE / 2 + 1;

// The inclusive STFT bin range of each mel band, in model order. These are the bins
// librosa's 60-band mel filterbank (sr 44100, n_fft 2048) gives a non-zero weight,
// with the first and last bins forced in, as MelBandRoformer computes them.
const MEL_BAND_BINS: readonly (readonly [number, number])[] = [
  [0, 6],
  [4, 9],
  [7, 12],
  [10, 15],
  [13, 18],
  [16, 21],
  [19, 24],
  [22, 27],
  [25, 30],
  [28, 33],
  [31, 36],
  [34, 39],
  [37, 42],
  [40, 45],
  [43, 48],
  [46, 52],
  [49, 55],
  [53, 59],
  [56, 64],
  [60, 68],
  [65, 73],
  [69, 78],
  [74, 83],
  [79, 89],
  [84, 96],
  [90, 102],
  [97, 109],
  [103, 117],
  [110, 125],
  [118, 134],
  [126, 144],
  [135, 154],
  [145, 164],
  [155, 176],
  [165, 188],
  [177, 202],
  [189, 216],
  [203, 231],
  [217, 247],
  [232, 264],
  [248, 283],
  [265, 303],
  [284, 324],
  [304, 347],
  [325, 371],
  [348, 397],
  [372, 425],
  [398, 454],
  [426, 486],
  [455, 520],
  [487, 557],
  [521, 596],
  [558, 637],
  [597, 682],
  [638, 730],
  [683, 781],
  [731, 835],
  [782, 894],
  [836, 957],
  [895, 1024],
];

// -- Types --------------------------------------------------------------------

interface BandLayout {
  /** Per model feature: the STFT bin it reads. */
  bins: Int32Array;
  /** Per model feature: the channel it reads (0 left, 1 right). */
  channels: Uint8Array;
  /** Per STFT bin: how many bands cover it, which the masks are averaged over. */
  bandsPerBin: Float32Array;
}

// -- Layout -------------------------------------------------------------------

// Features run band by band, bin by bin, then channel: the model's `freq_indices` order.
function bandLayout(): BandLayout {
  const bins: number[] = [];
  const channels: number[] = [];
  const bandsPerBin = new Float32Array(RF_BINS);
  for (const [lo, hi] of MEL_BAND_BINS) {
    for (let bin = lo; bin <= hi; bin++) {
      bandsPerBin[bin] += 1;
      bins.push(bin, bin);
      channels.push(0, 1);
    }
  }
  return { bins: Int32Array.from(bins), channels: Uint8Array.from(channels), bandsPerBin };
}

// -- Exports ------------------------------------------------------------------

export { RF_BINS, RF_CHUNK, RF_FFT_SIZE, RF_FRAMES, RF_HOP, bandLayout };
export type { BandLayout };
