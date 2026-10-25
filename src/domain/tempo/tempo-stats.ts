import type { BeatGrid } from "@/domain/tempo/beat-grid";
import { beatIntervals, median } from "@/domain/tempo/beat-intervals";

// -- Types ---------------------------------------------------------------------

interface TempoStats {
  bpm: number;
  low: number;
  high: number;
  steady: boolean;
  bars: number;
}

// -- Constants -----------------------------------------------------------------

const STEADY_SPREAD = 0.04;

// -- Stats ---------------------------------------------------------------------

function medianBpm(beats: readonly number[]): number {
  return 60 / median(beatIntervals(beats));
}

function barTempos(grid: BeatGrid): number[] {
  const tempos: number[] = [];
  const { beats, downbeatIndices } = grid;
  for (let i = 1; i < downbeatIndices.length; i++) {
    const start = downbeatIndices[i - 1];
    const end = downbeatIndices[i];
    tempos.push((60 * (end - start)) / (beats[end] - beats[start]));
  }
  return tempos.toSorted((a, b) => a - b);
}

function tempoStats(grid: BeatGrid): TempoStats | null {
  if (grid.beats.length < 2) return null;
  const tempos = barTempos(grid);
  const bpm = tempos.length > 0 ? tempos[Math.floor(tempos.length / 2)] : medianBpm(grid.beats);
  const low = tempos[Math.floor(tempos.length * 0.1)] ?? bpm;
  const high = tempos[Math.floor(tempos.length * 0.9)] ?? bpm;
  return { bpm, low, high, steady: (high - low) / bpm < STEADY_SPREAD, bars: grid.downbeatIndices.length };
}

// -- Exports -------------------------------------------------------------------

export { tempoStats };
export type { TempoStats };
