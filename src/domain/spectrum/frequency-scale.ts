import type { FrequencyScale, SpectrumTop } from "@/domain/spectrum/settings";

// -- Types --------------------------------------------------------------------

interface RowBinTable {
  spanStart: Int32Array;
  spanEnd: Int32Array;
  fraction: Float32Array;
  tiltDb: Float32Array;
}

// -- Constants ----------------------------------------------------------------

const TOP_RANGES: Record<SpectrumTop, readonly [number, number]> = { full: [80, 18000], voice: [80, 8000] };
const TILT_PIVOT_HZ = 500;
const TILT_DB_PER_OCTAVE = 1.5;

const SCALES: Record<FrequencyScale, { forward: (hz: number) => number; inverse: (value: number) => number }> = {
  mel: { forward: (hz) => 2595 * Math.log10(1 + hz / 700), inverse: (mel) => 700 * (10 ** (mel / 2595) - 1) },
  log: { forward: Math.log, inverse: Math.exp },
  linear: { forward: (hz) => hz, inverse: (hz) => hz },
};

// -- Functions ----------------------------------------------------------------

function topFrequencyRange(top: SpectrumTop): readonly [number, number] {
  return TOP_RANGES[top];
}

function frequencyAtRow(scale: FrequencyScale, top: SpectrumTop, row: number, height: number): number {
  const [low, high] = TOP_RANGES[top];
  const { forward, inverse } = SCALES[scale];
  const bottom = forward(low);
  return inverse(bottom + (forward(high) - bottom) * (1 - row / height));
}

function rowOfFrequency(scale: FrequencyScale, top: SpectrumTop, hz: number, height: number): number {
  const [low, high] = TOP_RANGES[top];
  const { forward } = SCALES[scale];
  const bottom = forward(low);
  return (1 - (forward(hz) - bottom) / (forward(high) - bottom)) * height;
}

function rowBinTable(
  scale: FrequencyScale,
  top: SpectrumTop,
  height: number,
  fftSize: number,
  sampleRate: number,
): RowBinTable {
  const bins = fftSize / 2 + 1;
  const binHz = sampleRate / fftSize;
  const table: RowBinTable = {
    spanStart: new Int32Array(height),
    spanEnd: new Int32Array(height),
    fraction: new Float32Array(height),
    tiltDb: new Float32Array(height),
  };
  for (let row = 0; row < height; row++) {
    const highHz = frequencyAtRow(scale, top, row, height);
    const lowHz = frequencyAtRow(scale, top, row + 1, height);
    const lowBin = lowHz / binHz;
    const highBin = highHz / binHz;
    if (highBin - lowBin < 1) {
      const centre = (lowBin + highBin) / 2;
      table.spanStart[row] = Math.min(Math.floor(centre), bins - 2);
      table.spanEnd[row] = -1;
      table.fraction[row] = centre - Math.floor(centre);
    } else {
      table.spanStart[row] = Math.floor(lowBin);
      table.spanEnd[row] = Math.min(bins, Math.ceil(highBin));
    }
    table.tiltDb[row] =
      TILT_DB_PER_OCTAVE * Math.log2(Math.max(Math.sqrt(lowHz * highHz), TILT_PIVOT_HZ) / TILT_PIVOT_HZ);
  }
  return table;
}

// -- Exports ------------------------------------------------------------------

export { frequencyAtRow, rowBinTable, rowOfFrequency, topFrequencyRange };
export type { RowBinTable };
